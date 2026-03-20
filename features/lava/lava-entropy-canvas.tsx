"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { sendEntropySamples, cancelPendingEntropy } from "@/lib/entropy-client";

// Throttle: sample pixels and POST every N milliseconds.
const SAMPLE_INTERVAL_MS = 250;
// Render-target resolution. Smaller = faster readback, still plenty of entropy.
const RT_SIZE = 128;

// ─── GLSL shaders ─────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
void main() {
    gl_Position = vec4(position, 1.0);
}
`;

/**
 * Fragment shader: layered FBM noise with slow blob movement, giving a
 * convincing lava-lamp / fluid-chaos look without a full fluid solver.
 */
const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;

// ── Noise primitives ────────────────────────────────────────────────────────
vec3 hash3(vec2 p) {
    vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                  dot(p, vec2(269.5, 183.3)),
                  dot(p, vec2(419.2, 371.9)));
    return fract(sin(q) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash3(i + vec2(0,0)).xy, f - vec2(0,0)),
                   dot(hash3(i + vec2(1,0)).xy, f - vec2(1,0)), u.x),
               mix(dot(hash3(i + vec2(0,1)).xy, f - vec2(0,1)),
                   dot(hash3(i + vec2(1,1)).xy, f - vec2(1,1)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2  shift = vec2(100.0);
    mat2  rot   = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p  = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// ── Main ────────────────────────────────────────────────────────────────────
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    float t = uTime * 0.18;
    vec2 q = vec2(fbm(uv + vec2(0.0, t * 0.9)),
                  fbm(uv + vec2(5.2, t)));

    vec2 r = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2) + t * 0.15),
                  fbm(uv + 4.0 * q + vec2(8.3, 2.8) + t * 0.126));

    float f = fbm(uv + 4.5 * r);

    // Lava palette: dark reds → orange → bright white-yellow core
    vec3 color = mix(
        vec3(0.10, 0.01, 0.01),
        vec3(0.95, 0.35, 0.05),
        clamp(f * f * 4.0, 0.0, 1.0)
    );
    color = mix(color, vec3(1.0, 0.8, 0.2), clamp(length(q), 0.0, 1.0));
    color = mix(color, vec3(1.0, 0.95, 0.8), clamp(r.x * r.x, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
}
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface LavaEntropyCanvasProps {
    className?: string;
}

export default function LavaEntropyCanvas({ className }: LavaEntropyCanvasProps): React.JSX.Element {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // ── Three.js setup ──────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setPixelRatio(1);

        const w = mount.clientWidth || 640;
        const h = mount.clientHeight || 400;
        renderer.setSize(w, h);
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const uniforms = {
            uTime: { value: 0.0 },
            uResolution: { value: new THREE.Vector2(w, h) },
        };

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
        scene.add(new THREE.Mesh(geometry, material));

        // Small off-screen render target for pixel readback — keeps main canvas full res.
        const renderTarget = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        });

        // ── Animation loop ──────────────────────────────────────────────────
        let rafId = 0;
        const clock = new THREE.Clock();

        function animate(): void {
            rafId = requestAnimationFrame(animate);
            uniforms.uTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);
        }
        animate();

        // ── Throttled pixel readback → entropy POST ─────────────────────────
        const sampleBuffer = new Uint8Array(RT_SIZE * RT_SIZE * 4);

        const sampleInterval = setInterval(() => {
            // Render scene into small render target.
            renderer.setRenderTarget(renderTarget);
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);

            renderer.readRenderTargetPixels(renderTarget, 0, 0, RT_SIZE, RT_SIZE, sampleBuffer);

            // Extract every 4th byte (R channel) — reduces payload ~75%, still chaotic.
            const samples = new Uint8Array(RT_SIZE * RT_SIZE);
            for (let i = 0; i < samples.length; i++) {
                samples[i] = sampleBuffer[i * 4];
            }

            sendEntropySamples(samples);
        }, SAMPLE_INTERVAL_MS);

        // ── Resize handler ──────────────────────────────────────────────────
        function handleResize(): void {
            const nw = mount!.clientWidth;
            const nh = mount!.clientHeight;
            renderer.setSize(nw, nh);
            uniforms.uResolution.value.set(nw, nh);
        }
        window.addEventListener("resize", handleResize);

        // ── Cleanup ─────────────────────────────────────────────────────────
        return () => {
            cancelAnimationFrame(rafId);
            clearInterval(sampleInterval);
            cancelPendingEntropy();
            window.removeEventListener("resize", handleResize);
            renderTarget.dispose();
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            if (mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} className={className} style={{ width: "100%", height: "100%" }} />;
}

# LavaEntropy

**LavaEntropy** is a digital entropy engine that generates cryptographically strong random numbers by combining three independent entropy sources:

- **Visual chaos** — a WebGL lava-lamp simulation whose pixel values are inherently unpredictable across machines and over time
- **System entropy** — `crypto.randomBytes` backed by the OS CSPRNG
- **Timing jitter** — `process.hrtime.bigint()` high-resolution monotonic clock

These three sources are continuously mixed inside a server-side rolling entropy pool. A REST API hashes the pool on every draw and reseeds it after, producing 256-bit random values that are unpredictable, non-repeating, and resistant to deterministic attacks.

---

## Table of Contents

1. [Concept](#concept)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Project Structure](#project-structure)
5. [Tech Stack](#tech-stack)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Frontend: WebGL Lava Simulation](#frontend-webgl-lava-simulation)
10. [Server: Entropy Pool](#server-entropy-pool)
11. [Background Entropy Mixing](#background-entropy-mixing)
12. [Security Model](#security-model)
13. [Deployment](#deployment)
14. [Scaling](#scaling)
15. [Smoke Testing](#smoke-testing)
16. [Future Enhancements](#future-enhancements)

---

## Concept

LavaEntropy is inspired by [Cloudflare's LavaRand](https://blog.cloudflare.com/lavarand-in-production-the-nitty-gritty-technical-details/), which uses a wall of physical lava lamps as a source of visual entropy.

This project implements the same idea entirely in software:

```
LavaEntropy  =  Visual Chaos
             +  System Entropy
             +  Continuous Mixing
             ──────────────────
             →  Reliable Randomness API
```

The key security insight is that client-submitted pixel entropy is **never trusted alone**. The server always mixes it with `crypto.randomBytes(32)` before absorbing it into the pool. This means even a fully compromised or forged client submission cannot bias the output — the OS CSPRNG always dominates.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER (Client)                                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Three.js WebGLRenderer                                 │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  Fragment Shader (GLSL)                          │   │    │
│  │  │  6-octave FBM noise → lava-lamp blobs            │   │    │
│  │  │  uniform uTime (clock) + uResolution             │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  │         ↓ renders full-screen quad @ 60fps               │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  WebGLRenderTarget  128×128 px (off-screen)      │   │    │
│  │  │  readRenderTargetPixels → Uint8Array RGBA        │   │    │
│  │  │  R-channel extracted every 250 ms                │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │ POST /api/entropy                     │
│                          │ { samples: number[] }  (≤4096 bytes) │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  SERVER (Next.js Node.js runtime)                                │
│                                                                  │
│  POST /api/entropy                                               │
│  ├─ Zod schema validation (samples: int 0-255, max 4096 items)   │
│  ├─ clientBuf + crypto.randomBytes(32)                           │
│  └─ EntropyPool.add(combined)                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  EntropyPool (64-byte rolling SHA-256 chain)               │  │
│  │                                                            │  │
│  │  add(data):                                                │  │
│  │    hash = SHA-256(pool ‖ data)                             │  │
│  │    pool = concat(pool, hash)[-64 bytes]                    │  │
│  │                                                            │  │
│  │  ← also fed by background timers (if enabled):            │  │
│  │      every 100 ms: crypto.randomBytes(32)                  │  │
│  │      every  50 ms: process.hrtime.bigint()                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  GET /api/random?n=N                                             │
│  ├─ For each of N draws:                                         │
│  │    combined = pool.get() ‖ randomBytes(32) ‖ hrtime()        │
│  │    digest   = SHA-256(combined)  →  64-char hex              │
│  │    pool.add(digest)              ← reseed                    │
│  └─ Return { random: string | string[] }                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
[WebGL Fragment Shader]
        │ 60 fps render loop
        ▼
[WebGLRenderTarget 128×128]
        │ every 250 ms — readRenderTargetPixels
        ▼
[R-channel extraction]  →  16 384 bytes → slice to ≤4096
        │
        ▼ POST /api/entropy
[Zod validation on server]
        │ pass
        ▼
[clientBuf  +  crypto.randomBytes(32)]
        │
        ▼
[EntropyPool.add()]
        │  SHA-256(currentPool ‖ newMaterial) → slide window
        ▼
[EntropyPool  64-byte rolling state]
        │
        │         ← background: randomBytes every 100 ms
        │         ← background: hrtime every 50 ms
        ▼
  GET /api/random
        │
        ▼
[pool.get()  +  randomBytes(32)  +  hrtime.bigint()]
        │
        ▼
[SHA-256 digest]  →  "a3f8c2d4...64 hex chars..."
        │
        ▼
[pool.add(digest)]   ← reseed so next draw diverges
        │
        ▼
[{ random: "a3f8c2d4..." }]  →  API response
```

---

## Project Structure

```
lava-entropy/
│
├── app/                          Next.js App Router pages and API routes
│   ├── globals.css               Dark lava-themed global styles
│   ├── layout.tsx                Root layout with metadata
│   ├── page.tsx                  Home page (SSR shell + client canvas island)
│   ├── page.module.css           Home page styles (canvas overlay, title)
│   └── api/
│       ├── entropy/
│       │   └── route.ts          POST /api/entropy — ingest pixel samples
│       ├── random/
│       │   └── route.ts          GET  /api/random  — draw random values
│       └── docs/
│           └── route.ts          GET  /api/docs    — Swagger UI
│
├── features/
│   └── lava/
│       ├── lava-entropy-canvas.tsx   Three.js renderer + GLSL shader + readback
│       ├── lava-canvas-client.tsx    Client wrapper for ssr:false dynamic import
│       ├── random-display.tsx        UI panel: count input + Generate button
│       └── random-display.module.css
│
├── lib/
│   └── entropy-client.ts         sendEntropySamples() with in-flight guard
│
├── server/
│   └── entropy/
│       ├── entropy-pool.ts       EntropyPool class — 64-byte SHA-256 rolling pool
│       ├── mix-inputs.ts         systemEntropy(), timingEntropy(), sha256Hex()
│       ├── background-entropy.ts startBackgroundEntropyMixing() — opt-in timers
│       └── index.ts              Barrel export
│
├── types/
│   └── api.ts                    TypeScript interfaces for all API shapes
│
├── public/
│   └── openapi.yaml              OpenAPI 3.1 specification
│
├── instrumentation.ts            Next.js server startup hook (background mixing)
├── next.config.ts                Next.js config (Turbopack root)
├── tsconfig.json                 TypeScript strict mode
└── package.json
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR, API routes, static optimisation |
| Language | TypeScript (strict) | Type safety across client and server |
| 3D / WebGL | Three.js | WebGLRenderer, ShaderMaterial, RenderTarget |
| Shading | GLSL (fragment shader) | 6-octave FBM noise for lava-blob visuals |
| Validation | Zod | Runtime schema validation on API input |
| Cryptography | Node.js `crypto` (built-in) | SHA-256 hashing, `randomBytes`, CSPRNG |
| Styling | CSS Modules | Scoped component styles, dark lava palette |
| API Docs | OpenAPI 3.1 + Swagger UI | Browsable, try-it-out API documentation |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install and run

```bash
# from the workspace root
cd lava-entropy

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will see the lava simulation. The browser begins posting pixel entropy to the server automatically every 250 ms.

### Browse the API docs

Open [http://localhost:3000/api/docs](http://localhost:3000/api/docs) for the interactive Swagger UI.

The raw OpenAPI spec is served at [http://localhost:3000/openapi.yaml](http://localhost:3000/openapi.yaml).

### Build for production

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LAVA_BACKGROUND_MIX` | unset | Set to `1` to enable background entropy mixing timers (long-lived Node process only — see [Background Entropy Mixing](#background-entropy-mixing)) |
| `NODE_ENV` | `development` | Standard Next.js env flag |
| `NEXT_RUNTIME` | set by Next.js | Used internally by `instrumentation.ts` to guard Node-only features |

No secrets or API keys are required for the core flow.

---

## API Reference

Full documentation is available at `/api/docs`. Quick reference below.

### POST /api/entropy

Injects pixel-sample entropy into the server pool.

**Request body**

```json
{ "samples": [42, 128, 255, 0, 77, 190, 33] }
```

| Field | Type | Constraints | Description |
|---|---|---|---|
| `samples` | `number[]` | integers 0–255, 1–4096 items | Raw pixel byte values from the WebGL render target |

**Response 200**

```json
{ "ok": true }
```

**curl**

```bash
curl -X POST http://localhost:3000/api/entropy \
  -H "Content-Type: application/json" \
  -d '{"samples":[42,128,255,0,77,190,33]}'
```

---

### GET /api/random

Draws one or more random values from the entropy pool.

**Query parameters**

| Parameter | Type | Default | Range | Description |
|---|---|---|---|---|
| `n` | integer | `1` | 1–64 | Number of independent values to draw |

**Response 200 — single draw**

```json
{ "random": "a3f8c2d4e1b05a7f9c3d2e4f1a0b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1" }
```

**Response 200 — multiple draws**

```json
{
  "random": [
    "a3f8c2d4e1b05a7f9c3d2e4f1a0b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1",
    "b91d44c8f2a37e6d05c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2"
  ]
}
```

Each value is a **SHA-256 hex digest** — 64 lowercase hexadecimal characters representing 256 bits of entropy.

**curl**

```bash
# Single draw
curl http://localhost:3000/api/random

# Five draws
curl "http://localhost:3000/api/random?n=5"
```

---

### GET /api/docs

Returns the Swagger UI HTML page. Open in a browser.

---

### Error responses

| Status | Cause |
|---|---|
| `400` | Request body is not valid JSON |
| `422` | JSON body or query parameter fails Zod schema validation |
| `405` | Wrong HTTP method for the endpoint |
| `500` | Unexpected server error |

---

## Frontend: WebGL Lava Simulation

The lava canvas runs entirely in the browser as a client-only React component (`"use client"`, dynamically imported with `ssr: false`).

### Rendering pipeline

1. A `THREE.WebGLRenderer` mounts into a `div` ref.
2. An `OrthographicCamera` looks at a full-screen `PlaneGeometry(2, 2)` quad.
3. A `ShaderMaterial` runs the GLSL fragment shader on every frame.
4. A separate `WebGLRenderTarget` at 128×128 is rendered off-screen every 250 ms.

### Fragment shader — FBM lava

The shader implements **fractal Brownian motion (FBM)** — layered gradient noise that produces slow, organic blob movement resembling a lava lamp:

```glsl
// 6 octaves of gradient noise, each rotated and scaled
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// Two layers of domain-warped FBM → final color
vec2 q = vec2(fbm(uv + t), fbm(uv + t + 5.2));
vec2 r = vec2(fbm(uv + 4.0*q + t*0.15), ...);
float f = fbm(uv + 4.5 * r);
```

This multi-level domain warping creates self-similar complexity that is computationally irreversible from the output pixel — ideal as a visual entropy source.

### Pixel readback and sampling

Every 250 ms:
1. The shader scene renders into the 128×128 `WebGLRenderTarget`.
2. `readRenderTargetPixels` copies the RGBA buffer to a `Uint8Array` (65 536 bytes).
3. Only the **R channel** (every 4th byte) is kept — 16 384 bytes of entropy per sample.
4. The array is sent to `/api/entropy` via `sendEntropySamples()`.

### Client entropy helper — `lib/entropy-client.ts`

- Uses an **in-flight flag** and `AbortController` — if a POST is already pending, the next sample interval is skipped rather than queuing a second request.
- Network errors are silently swallowed because entropy injection is best-effort; the server remains secure through system entropy regardless.
- `cancelPendingEntropy()` is called on component unmount to cleanly abort any in-progress fetch.

---

## Server: Entropy Pool

### `EntropyPool` — `server/entropy/entropy-pool.ts`

A 64-byte rolling buffer maintained as a chained SHA-256 hash:

```
Initial state:   pool = crypto.randomBytes(64)

On add(data):
  hash = SHA-256(pool ‖ data)           // 32 bytes
  pool = concat(pool, hash)[-64 bytes]  // slide window
```

Properties:
- **Forward security** — knowing the current pool state does not reveal past inputs.
- **Always seeded** — the constructor calls `crypto.randomBytes(64)` on first load, so even a cold serverless start is immediately secure.
- **Singleton per process** — the module-level `export const pool` is shared across all requests in a long-lived Node process.

### `mix-inputs.ts`

Stateless helper functions used by both API routes and the background mixer:

| Function | Returns | Description |
|---|---|---|
| `systemEntropy()` | `Buffer` (32 bytes) | `crypto.randomBytes(32)` — OS CSPRNG |
| `timingEntropy()` | `Buffer` | `process.hrtime.bigint().toString()` as bytes |
| `combineForHash(...parts)` | `Buffer` | `Buffer.concat(parts)` |
| `sha256Hex(data)` | `string` | SHA-256 digest as 64 hex chars |

### Per-draw algorithm in `/api/random`

```
combined = pool.get()  ‖  randomBytes(32)  ‖  hrtime.bigint()
digest   = SHA-256(combined)
pool.add(Buffer.from(digest))   ← reseed before returning
return digest
```

The reseed step means consecutive draws within the same request are unlinkable — each one observes a different pool state.

---

## Background Entropy Mixing

When running as a long-lived Node process, two background timers can be enabled for extra freshness:

| Timer | Interval | Material |
|---|---|---|
| System | 100 ms | `crypto.randomBytes(32)` |
| Timing | 50 ms | `process.hrtime.bigint()` |

These are activated by `instrumentation.ts` (Next.js server startup hook) only when `LAVA_BACKGROUND_MIX=1` is set and `NEXT_RUNTIME === "nodejs"`.

```bash
# Enable background mixing
LAVA_BACKGROUND_MIX=1 npm start
```

**On serverless platforms (Vercel, Netlify, etc.):** these timers should not be enabled because process lifetime is not guaranteed across invocations. The API is fully correct without them — every route call independently mixes system entropy and timing at request time.

---

## Security Model

| Property | Implementation |
|---|---|
| Client entropy is advisory only | Server always mixes `crypto.randomBytes(32)` with client samples before pool.add |
| Pool cannot be biased by client | Combined input = clientBuf + systemEntropy; even a maximal malicious client cannot control the SHA-256 output |
| Forward security | SHA-256 chaining: past pool states cannot be recovered from the current state |
| Output unlinkability | Pool is reseeded with each draw's hash; consecutive outputs diverge |
| Input validation | Zod enforces integer type, 0–255 bounds, and max 4096 items; bad input returns 422 |
| No reliance on simulation alone | Even if WebGL is disabled, the API draws securely from system entropy + pool |

Recommended for production: add rate limiting at the infrastructure layer (nginx, Cloudflare, or Next.js middleware) to prevent exhaustion attacks on `/api/random`.

---

## Deployment

### Self-hosted Node (recommended for full features)

```bash
npm run build
LAVA_BACKGROUND_MIX=1 npm start
```

Background entropy mixing is active. The pool accumulates entropy continuously between requests.

### Serverless (Vercel, Netlify)

```bash
npm run build
# Deploy via platform CLI or Git integration
```

Do **not** set `LAVA_BACKGROUND_MIX=1`. Each request mixes system entropy independently — output quality is unaffected; the pool just starts fresh on each cold start.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
ENV LAVA_BACKGROUND_MIX=1
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Scaling

For multiple server instances where you need a shared, consistent entropy pool:

1. Replace the in-memory `EntropyPool` singleton with a Redis-backed implementation.
2. Use atomic Redis operations (`GETSET`, Lua scripts) to prevent race conditions on `add()` / `get()`.
3. Each instance still adds its own `crypto.randomBytes` at request time — the shared pool accumulates cross-instance entropy.

This is listed as a future enhancement and is not implemented in the current MVP.

---

## Smoke Testing

With the dev server running:

```bash
node temp/scripts/2026-03-20-smoke-test-random-api.mjs 20 http://localhost:3000
```

This hits `/api/random` 20 times and verifies:
- Every result is a 64-character lowercase hex string matching `/^[0-9a-f]{64}$/`
- No two results are identical (collision = statistical failure)

For formal randomness quality testing, use the [NIST Statistical Test Suite](https://csrc.nist.gov/projects/random-bit-generation/documentation-and-software) or [Dieharder](https://webhome.phy.duke.edu/~rgb/General/dieharder.php) on a large batch of `/api/random` output.

---

## Future Enhancements

| Enhancement | Notes |
|---|---|
| Redis-backed shared pool | Required for stateful multi-instance deployments |
| WebGPU simulation | Higher visual complexity, better GPU parallelism |
| Multi-node entropy mesh | Pool entries contributed by multiple independent servers |
| Verifiable randomness (VRF) | Clients can verify outputs were not backdated or manipulated |
| Public randomness beacon | Timestamped, signed random values published at regular intervals |
| NIST/Dieharder test harness | Automated statistical quality regression in CI |
| Rate limiting middleware | Per-IP token bucket at the Next.js edge layer |

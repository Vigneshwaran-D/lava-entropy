const MAX_SAMPLES = 4096;
const ENTROPY_ENDPOINT = "/api/entropy";

let inFlight = false;
let controller: AbortController | null = null;

/**
 * Posts a sampled pixel array to /api/entropy.
 * - Skips if a previous POST is still in flight (no queue build-up).
 * - Silently ignores network errors (entropy injection is best-effort;
 *   the server always mixes strong system entropy regardless).
 */
export async function sendEntropySamples(samples: Uint8Array): Promise<void> {
    if (inFlight) return;

    // Truncate to our bounded limit so the server Zod schema never rejects.
    const bounded = samples.length > MAX_SAMPLES ? samples.subarray(0, MAX_SAMPLES) : samples;
    const payload = Array.from(bounded);

    inFlight = true;
    controller = new AbortController();

    try {
        await fetch(ENTROPY_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ samples: payload }),
            signal: controller.signal,
        });
    } catch {
        // Network errors are intentionally swallowed.
    } finally {
        inFlight = false;
        controller = null;
    }
}

/** Cancel any in-flight request (call on component unmount). */
export function cancelPendingEntropy(): void {
    controller?.abort();
    inFlight = false;
    controller = null;
}

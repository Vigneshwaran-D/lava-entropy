import { pool, systemEntropy, timingEntropy } from "./index";

let started = false;

/**
 * Starts two background mixing intervals:
 *   - Every 100 ms: adds 32 bytes of fresh crypto.randomBytes.
 *   - Every 50 ms:  adds the current high-resolution monotonic clock value.
 *
 * IMPORTANT — call this only when running as a long-lived Node.js process (e.g. `next start`
 * behind a reverse proxy, or a custom server). On serverless platforms (Vercel, Netlify edge)
 * instances are ephemeral and setInterval is not guaranteed to fire across invocations.
 * In those environments the APIs remain correct because each route call always mixes fresh
 * system entropy and timing at request time; background mixing simply adds extra freshness
 * when the process is long-lived.
 */
export function startBackgroundEntropyMixing(): void {
    if (started) return;
    started = true;

    setInterval(() => {
        pool.add(systemEntropy());
    }, 100);

    setInterval(() => {
        pool.add(timingEntropy());
    }, 50);
}

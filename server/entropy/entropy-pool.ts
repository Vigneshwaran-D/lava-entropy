import crypto from "crypto";

const POOL_SIZE = 64;

/**
 * Rolling entropy pool that maintains a 64-byte sliding window of chained SHA-256 hashes.
 * Every call to `add` mixes new material into the pool; `get` returns the current state.
 * This class is a singleton per process. On serverless hosts, cold starts produce a fresh
 * pool seeded immediately with crypto.randomBytes — still secure because `get()` always
 * re-mixes with system entropy at the call site (see /api/random/route.ts).
 */
class EntropyPool {
    private pool: Buffer;

    constructor() {
        // Seed immediately with strong system entropy so first requests are safe.
        this.pool = crypto.randomBytes(POOL_SIZE);
    }

    add(data: Buffer): void {
        const hash = crypto.createHash("sha256").update(this.pool).update(data).digest();
        this.pool = Buffer.concat([this.pool, hash]).subarray(-POOL_SIZE);
    }

    get(): Buffer {
        return Buffer.from(this.pool);
    }
}

// Module-level singleton — shared across requests in a long-lived process.
export const pool = new EntropyPool();

import crypto from "crypto";

/** Returns 32 bytes of OS-level randomness. */
export function systemEntropy(): Buffer {
    return crypto.randomBytes(32);
}

/** Returns the current high-resolution monotonic time as a Buffer. */
export function timingEntropy(): Buffer {
    return Buffer.from(process.hrtime.bigint().toString());
}

/** Combines pool state, system entropy, and timing into one buffer ready for hashing. */
export function combineForHash(...parts: Buffer[]): Buffer {
    return Buffer.concat(parts);
}

/** SHA-256 digest of combined material, returned as a hex string. */
export function sha256Hex(data: Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
}

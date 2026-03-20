/** POST /api/entropy request body */
export interface EntropyBody {
    samples: number[];
}

/** POST /api/entropy success response */
export interface EntropyResponse {
    ok: true;
}

/** GET /api/random response — `random` is a hex string or array of hex strings */
export interface RandomResponse {
    random: string | string[];
}

/** Generic API error response */
export interface ApiError {
    error: string;
    details?: unknown;
}

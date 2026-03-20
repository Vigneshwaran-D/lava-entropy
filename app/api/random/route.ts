import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, systemEntropy, timingEntropy, combineForHash, sha256Hex } from "@/server/entropy";

export const runtime = "nodejs";

const QuerySchema = z.object({
    n: z.coerce.number().int().min(1).max(64).default(1),
});

function drawOne(): string {
    const combined = combineForHash(pool.get(), systemEntropy(), timingEntropy());
    const digest = sha256Hex(combined);
    // Reseed pool with the output hash so consecutive calls diverge.
    pool.add(Buffer.from(digest));
    return digest;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = req.nextUrl;
    const parsed = QuerySchema.safeParse({ n: searchParams.get("n") ?? 1 });

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 422 },
        );
    }

    const { n } = parsed.data;
    const values = Array.from({ length: n }, drawOne);

    return NextResponse.json(n === 1 ? { random: values[0] } : { random: values });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, systemEntropy } from "@/server/entropy";

export const runtime = "nodejs";

const MAX_SAMPLES = 4096;

const BodySchema = z.object({
    samples: z
        .array(z.number().int().min(0).max(255))
        .min(1)
        .max(MAX_SAMPLES),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 422 },
        );
    }

    const clientBuf = Buffer.from(Uint8Array.from(parsed.data.samples));

    // Mix client samples with fresh system entropy so client cannot manipulate pool alone.
    pool.add(Buffer.concat([clientBuf, systemEntropy()]));

    return NextResponse.json({ ok: true });
}

/**
 * Next.js Instrumentation hook — runs once per server process startup.
 * Background entropy mixing is only enabled when running as a long-lived Node
 * server (NODE_ENV=production with `next start`, or custom server). It is
 * intentionally a no-op on serverless/edge deployments where singletons and
 * timers are not reliable across invocations.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === "nodejs" && process.env.LAVA_BACKGROUND_MIX === "1") {
        const { startBackgroundEntropyMixing } = await import(
            "./server/entropy/background-entropy"
        );
        startBackgroundEntropyMixing();
    }
}

// Runs once when the Next.js server boots (dev and production).
// Start-of-day housekeeping: take the daily DB snapshot immediately, then start
// the Phase-3 background engine (the in-process ticker that keeps taking daily
// snapshots and sends the daily digest — see lib/engine.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { maybeSnapshot } = await import("@/lib/snapshots");
    void maybeSnapshot();
    const { startEngine } = await import("@/lib/engine");
    startEngine();
  }
}

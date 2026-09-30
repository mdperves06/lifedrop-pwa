// Starts the in-process scheduler for single-instance deployments (and local dev).
// On serverless hosts set RUN_JOBS_IN_PROCESS=false and call /api/cron/run from a cron service instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUN_JOBS_IN_PROCESS === "false" || process.env.VITEST) return;
  const g = globalThis as unknown as { __ldJobs?: NodeJS.Timeout };
  if (g.__ldJobs) return;
  const { runJobs } = await import("@/server/jobs");
  const tick = () => runJobs().catch((e) => console.error("[jobs]", e));
  setTimeout(tick, 15_000);
  g.__ldJobs = setInterval(tick, 5 * 60_000);
}

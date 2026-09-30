import "server-only";
import { expireStaleRequests } from "@/server/services/requests";
import { expireBatches } from "@/server/services/inventory";
import { sendAppointmentReminders } from "@/server/services/appointments";

let running = false;

/** Periodic maintenance: reminders, request expiry, batch expiry. Safe to run concurrently-ish (guarded + idempotent). */
export async function runJobs(now = new Date()) {
  if (running) return { skipped: true };
  running = true;
  try {
    const reminders = await sendAppointmentReminders(now);
    const expiredRequests = await expireStaleRequests(now);
    const expiredUnits = await expireBatches(now);
    return { skipped: false, ...reminders, expiredRequests, expiredUnits };
  } catch (err) {
    console.error("[jobs] failed", err);
    return { skipped: false, error: true };
  } finally {
    running = false;
  }
}

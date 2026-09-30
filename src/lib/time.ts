// The platform serves a single city, so all scheduling happens in that city's
// local time regardless of where the server runs. Bangladesh has no DST, so a
// fixed offset is exact. Override via NEXT_PUBLIC_TZ / NEXT_PUBLIC_TZ_OFFSET_MINUTES.

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_TZ || "Asia/Dhaka";
export const TZ_OFFSET_MIN = Number(process.env.NEXT_PUBLIC_TZ_OFFSET_MINUTES ?? 360);

export type LocalParts = { y: number; m: number; d: number; h: number; min: number; dow: number };

export function localParts(date: Date): LocalParts {
  const t = new Date(date.getTime() + TZ_OFFSET_MIN * 60_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), dow: t.getUTCDay() };
}

export function fromLocal(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min) - TZ_OFFSET_MIN * 60_000);
}

/** "YYYY-MM-DD" of the local calendar day. */
export function localDateKey(date: Date): string {
  const p = localParts(date);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function startOfLocalDay(date: Date): Date {
  const p = localParts(date);
  return fromLocal(p.y, p.m, p.d);
}

export function addDays(date: Date, n: number) {
  return new Date(date.getTime() + n * 86_400_000);
}

export function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Hourly booking slots: morning 08:00–13:00, evening 14:00–18:00 (clipped to center hours). */
export const MORNING_HOURS = [8, 9, 10, 11, 12];
export const EVENING_HOURS = [14, 15, 16, 17];

export function slotPeriod(hour: number): "MORNING" | "EVENING" {
  return hour < 13 ? "MORNING" : "EVENING";
}

export function formatDateTime(d: Date | string, locale = "en", opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: APP_TIMEZONE, ...opts }).format(new Date(d));
}

export function formatDate(d: Date | string, locale = "en") {
  return formatDateTime(d, locale, { dateStyle: "medium" });
}

export function formatTime(d: Date | string, locale = "en") {
  return formatDateTime(d, locale, { timeStyle: "short" });
}

export function relativeTime(d: Date | string, locale = "en", now = Date.now()) {
  const diff = (new Date(d).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "bn" ? "bn" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

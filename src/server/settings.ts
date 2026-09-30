import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { DEFAULT_DONATION_INTERVAL_DAYS } from "@/lib/eligibility";

export const settingsSchema = z.object({
  cityName: z.string().min(1).max(80),
  donationIntervalDays: z.number().int().min(28).max(365),
  emergencyRadiusKm: z.number().min(1).max(50),
  maxAutoNotify: z.number().int().min(1).max(200),
  lowStockUnits: z.number().int().min(1).max(1000),
  criticalStockUnits: z.number().int().min(0).max(1000),
  dailyDonationTarget: z.number().int().min(1).max(10_000),
  batchShelfLifeDays: z.number().int().min(1).max(365),
  requestExpiryHours: z.number().int().min(1).max(24 * 30),
  hotlinePhone: z.string().min(3).max(30),
  maxOpenRequestsUnverified: z.number().int().min(0).max(20),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  cityName: "Dhaka",
  donationIntervalDays: DEFAULT_DONATION_INTERVAL_DAYS,
  emergencyRadiusKm: 5,
  maxAutoNotify: 25,
  lowStockUnits: 15,
  criticalStockUnits: 5,
  dailyDonationTarget: 40,
  batchShelfLifeDays: 42,
  requestExpiryHours: 24,
  hotlinePhone: "16263",
  maxOpenRequestsUnverified: 2,
};

const KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(row.value) });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const next = settingsSchema.parse({ ...(await getSettings()), ...patch });
  await db.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

export function stockLevel(units: number, s: Pick<AppSettings, "lowStockUnits" | "criticalStockUnits">) {
  if (units <= s.criticalStockUnits) return "CRITICAL" as const;
  if (units < s.lowStockUnits) return "LOW" as const;
  return "ADEQUATE" as const;
}

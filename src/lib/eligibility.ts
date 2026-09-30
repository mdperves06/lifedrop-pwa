// General screening guidance used for the public eligibility checker and as a
// pre-booking sanity check. It is NOT a medical assessment — the donation
// center's medical screening is always the final decision.

export const DEFAULT_DONATION_INTERVAL_DAYS = 90;
export const MIN_AGE = 18;
export const MAX_AGE = 60;
export const MIN_WEIGHT_KG = 50;

export type EligibilityInput = {
  age?: number | null;
  weightKg?: number | null;
  lastDonationDate?: Date | string | null;
  feelingWell?: boolean;
  recentIllness?: boolean; // fever / infection in last 2 weeks
  recentTattoo?: boolean; // tattoo / piercing in last 6 months
  pregnant?: boolean; // pregnant or breastfeeding
  onAntibiotics?: boolean;
  chronicCondition?: boolean; // uncontrolled heart / blood / hepatitis / HIV etc.
};

export type EligibilityIssue =
  | "AGE_UNKNOWN"
  | "TOO_YOUNG"
  | "TOO_OLD"
  | "WEIGHT_UNKNOWN"
  | "UNDERWEIGHT"
  | "TOO_SOON"
  | "NOT_WELL"
  | "RECENT_ILLNESS"
  | "RECENT_TATTOO"
  | "PREGNANT"
  | "ANTIBIOTICS"
  | "CHRONIC";

export type EligibilityResult = {
  eligible: boolean;
  issues: EligibilityIssue[];
  nextEligibleDate: Date | null;
};

export function nextEligibleDate(
  lastDonationDate: Date | string | null | undefined,
  intervalDays = DEFAULT_DONATION_INTERVAL_DAYS,
): Date | null {
  if (!lastDonationDate) return null;
  const d = new Date(lastDonationDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + intervalDays * 86_400_000);
}

export function ageFromDob(dob: Date | string | null | undefined, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function checkEligibility(
  input: EligibilityInput,
  opts: { intervalDays?: number; now?: Date; requireAll?: boolean } = {},
): EligibilityResult {
  const now = opts.now ?? new Date();
  const issues: EligibilityIssue[] = [];

  if (input.age == null) {
    if (opts.requireAll) issues.push("AGE_UNKNOWN");
  } else if (input.age < MIN_AGE) issues.push("TOO_YOUNG");
  else if (input.age > MAX_AGE) issues.push("TOO_OLD");

  if (input.weightKg == null) {
    if (opts.requireAll) issues.push("WEIGHT_UNKNOWN");
  } else if (input.weightKg < MIN_WEIGHT_KG) issues.push("UNDERWEIGHT");

  const next = nextEligibleDate(input.lastDonationDate, opts.intervalDays);
  if (next && next > now) issues.push("TOO_SOON");

  if (input.feelingWell === false) issues.push("NOT_WELL");
  if (input.recentIllness) issues.push("RECENT_ILLNESS");
  if (input.recentTattoo) issues.push("RECENT_TATTOO");
  if (input.pregnant) issues.push("PREGNANT");
  if (input.onAntibiotics) issues.push("ANTIBIOTICS");
  if (input.chronicCondition) issues.push("CHRONIC");

  return { eligible: issues.length === 0, issues, nextEligibleDate: next && next > now ? next : null };
}

/** Achievement tier based on completed donations (private to the donor — no public leaderboard). */
export function badgeFor(count: number): "NONE" | "BRONZE" | "SILVER" | "GOLD" {
  if (count >= 10) return "GOLD";
  if (count >= 5) return "SILVER";
  if (count >= 1) return "BRONZE";
  return "NONE";
}

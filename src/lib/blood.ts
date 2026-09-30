// Blood-group helpers shared by client and server.
// Values mirror the Prisma `BloodGroup` enum; only these eight are accepted anywhere.

export const BLOOD_GROUPS = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "O_POS",
  "O_NEG",
  "AB_POS",
  "AB_NEG",
] as const;

export type BloodGroupCode = (typeof BLOOD_GROUPS)[number];

export const BLOOD_LABEL: Record<BloodGroupCode, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  O_POS: "O+",
  O_NEG: "O-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
};

const LABEL_TO_CODE: Record<string, BloodGroupCode> = Object.fromEntries(
  Object.entries(BLOOD_LABEL).map(([code, label]) => [label, code as BloodGroupCode]),
);

export function isBloodGroup(value: unknown): value is BloodGroupCode {
  return typeof value === "string" && (BLOOD_GROUPS as readonly string[]).includes(value);
}

/** Accepts either the enum code ("O_POS") or the label ("O+"). Returns null for anything else. */
export function parseBloodGroup(value: unknown): BloodGroupCode | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  if (isBloodGroup(v)) return v;
  return LABEL_TO_CODE[v] ?? null;
}

export function bloodLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return BLOOD_LABEL[code as BloodGroupCode] ?? "—";
}

/**
 * Red-cell compatibility: which recipient groups a donor group can give to.
 * This is general reference information only — final compatibility is always
 * confirmed by blood-bank cross-matching.
 */
export const CAN_DONATE_TO: Record<BloodGroupCode, BloodGroupCode[]> = {
  O_NEG: ["O_NEG", "O_POS", "A_NEG", "A_POS", "B_NEG", "B_POS", "AB_NEG", "AB_POS"],
  O_POS: ["O_POS", "A_POS", "B_POS", "AB_POS"],
  A_NEG: ["A_NEG", "A_POS", "AB_NEG", "AB_POS"],
  A_POS: ["A_POS", "AB_POS"],
  B_NEG: ["B_NEG", "B_POS", "AB_NEG", "AB_POS"],
  B_POS: ["B_POS", "AB_POS"],
  AB_NEG: ["AB_NEG", "AB_POS"],
  AB_POS: ["AB_POS"],
};

/** Donor groups whose red cells are generally compatible with the recipient group. */
export function compatibleDonorGroups(recipient: BloodGroupCode): BloodGroupCode[] {
  return BLOOD_GROUPS.filter((donor) => CAN_DONATE_TO[donor].includes(recipient));
}

export function canDonate(donor: BloodGroupCode, recipient: BloodGroupCode): boolean {
  return CAN_DONATE_TO[donor].includes(recipient);
}

/** Recipient groups a patient of this group can receive from (inverse view, for the chart). */
export function canReceiveFrom(recipient: BloodGroupCode): BloodGroupCode[] {
  return compatibleDonorGroups(recipient);
}

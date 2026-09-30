// Zod schemas shared by client forms and server route handlers.
// The server ALWAYS re-validates; client use is only for early feedback.
import { z } from "zod";
import { BLOOD_GROUPS } from "@/lib/blood";

export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, "");
  if (/^01\d{9}$/.test(p)) p = "+88" + p;
  else if (/^8801\d{9}$/.test(p)) p = "+" + p;
  return p;
}

const trimmed = (max: number) => z.string().trim().max(max);

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((p) => /^\+\d{8,15}$/.test(p), "Enter a valid phone number, e.g. 01712345678");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(160));

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Too long")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Include at least one letter and one number");

export const bloodGroupSchema = z.enum(BLOOD_GROUPS, "Select a valid blood group");
export const idSchema = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i, "Invalid id");

const dateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date")
  .transform((s) => new Date(s));

export const registerSchema = z.object({
  name: trimmed(80).min(2, "Enter your full name"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  bloodGroup: bloodGroupSchema,
  locationId: idSchema,
  dateOfBirth: dateString.refine((d) => d < new Date() && d.getFullYear() > 1900, "Enter a valid date of birth"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]).default("UNDISCLOSED"),
  weightKg: z.coerce.number().int().min(20, "Enter a realistic weight").max(300, "Enter a realistic weight"),
  lastDonationDate: dateString.refine((d) => d <= new Date(), "Cannot be in the future").optional().nullable(),
  healthDeclarationOk: z.boolean(),
  wantsToDonate: z.boolean().default(true),
  referralCode: trimmed(20).optional(),
  acceptTerms: z.literal(true, "You must accept the terms to continue"),
  locale: z.enum(["en", "bn"]).optional(),
});

export const loginSchema = z.object({
  identifier: trimmed(160).min(3, "Enter your email or phone"),
  password: z.string().min(1, "Enter your password").max(128),
});

export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const verifyPhoneSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export const profileUpdateSchema = z.object({
  name: trimmed(80).min(2).optional(),
  phone: phoneSchema.optional(),
  locationId: idSchema.optional(),
  organization: trimmed(120).optional().nullable(),
  note: trimmed(280).optional().nullable(),
  dateOfBirth: dateString.optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]).optional(),
  locale: z.enum(["en", "bn"]).optional(),
});

export const donorProfileSchema = z.object({
  bloodGroup: bloodGroupSchema.optional(),
  weightKg: z.coerce.number().int().min(20).max(300).optional().nullable(),
  availability: z.enum(["AVAILABLE", "TEMP_UNAVAILABLE", "NOT_AVAILABLE"]).optional(),
  emergencyAvailable: z.boolean().optional(),
  lastDonationDate: dateString.refine((d) => d <= new Date(), "Cannot be in the future").optional().nullable(),
  nextAvailableDate: dateString.optional().nullable(),
  healthDeclarationOk: z.boolean().optional(),
  sharePhoneAfterAccept: z.boolean().optional(),
  shareEmailAfterAccept: z.boolean().optional(),
  showInSearch: z.boolean().optional(),
});

export const donorSearchSchema = z.object({
  bloodGroup: bloodGroupSchema.optional(),
  compatible: z.enum(["1", "0"]).optional(),
  divisionId: idSchema.optional(),
  districtId: idSchema.optional(),
  areaId: idSchema.optional(),
  availableNow: z.enum(["1", "0"]).optional(),
  emergency: z.enum(["1", "0"]).optional(),
  recentlyActive: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const bloodRequestSchema = z.object({
  bloodGroup: bloodGroupSchema,
  units: z.coerce.number().int().min(1, "At least 1 unit").max(20, "Max 20 units per request"),
  patientName: trimmed(80).min(2, "Enter the patient's name"),
  hospitalName: trimmed(120).min(2, "Enter the hospital name"),
  hospitalAddress: trimmed(200).optional().nullable(),
  hospitalId: idSchema.optional().nullable(),
  locationId: idSchema,
  neededAt: dateString,
  priority: z.enum(["NORMAL", "URGENT", "EMERGENCY"]),
  notes: trimmed(500).optional().nullable(),
  contactPreference: z.enum(["IN_APP", "PHONE", "BOTH"]).default("IN_APP"),
  contactPhone: phoneSchema.optional().nullable(),
  saveAsDraft: z.boolean().optional(),
});

export const sendDonationRequestSchema = z.object({
  donorIds: z.array(idSchema).min(1, "Select at least one donor").max(20, "At most 20 donors at a time"),
  message: trimmed(300).optional(),
});

export const respondSchema = z.object({ action: z.enum(["ACCEPT", "DECLINE"]) });

export const requestActionSchema = z.object({
  action: z.enum(["PUBLISH", "CANCEL", "FULFILL", "CLOSE", "REOPEN"]),
  note: trimmed(300).optional(),
  unitsFulfilled: z.coerce.number().int().min(0).max(20).optional(),
});

export const appointmentSchema = z.object({
  centerId: idSchema,
  startsAt: dateString,
  notes: trimmed(300).optional(),
  campaignId: idSchema.optional().nullable(),
  walkIn: z.boolean().optional(),
});

export const rescheduleSchema = z.object({ startsAt: dateString });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: trimmed(500).optional(),
});

export const reportSchema = z
  .object({
    targetUserId: idSchema.optional(),
    bloodRequestId: idSchema.optional(),
    reason: z.enum(["FAKE_DONOR", "SPAM", "ABUSE", "FRAUD", "INCORRECT_INFO", "INAPPROPRIATE"]),
    details: trimmed(1000).optional(),
  })
  .refine((r) => r.targetUserId || r.bloodRequestId, "Nothing to report");

export const inventoryAdjustSchema = z.object({
  centerId: idSchema,
  bloodGroup: bloodGroupSchema,
  units: z.coerce.number().int().min(1).max(500),
  mode: z.enum(["ADD", "ISSUE", "DISCARD"]),
  collectedAt: dateString.optional(),
  note: trimmed(200).optional(),
  bloodRequestId: idSchema.optional(),
});

export const recordDonationSchema = z.object({
  appointmentId: idSchema.optional(),
  donorId: idSchema,
  centerId: idSchema,
  bloodGroup: bloodGroupSchema,
  volumeMl: z.coerce.number().int().min(200).max(550).default(450),
  notes: trimmed(300).optional(),
  bloodRequestId: idSchema.optional(),
});

export const campaignSchema = z.object({
  title: trimmed(120).min(3),
  description: trimmed(2000).min(10),
  venue: trimmed(200).min(3),
  locationId: idSchema,
  centerId: idSchema.optional().nullable(),
  startsAt: dateString,
  endsAt: dateString,
  targetDonors: z.coerce.number().int().min(1).max(10_000),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).default("PLANNED"),
});

export const announcementSchema = z.object({
  title: trimmed(120).min(3),
  message: trimmed(1000).min(5),
  audience: z.enum(["ALL", "DONORS", "HOSPITALS", "STAFF"]),
  push: z.boolean().default(true),
});

export const centerSchema = z.object({
  name: trimmed(120).min(3),
  address: trimmed(200).min(3),
  phone: phoneSchema,
  email: z.string().trim().max(160).optional().nullable(),
  locationId: idSchema,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  openDays: z.string().regex(/^[0-6](,[0-6])*$/),
  capacityPerSlot: z.coerce.number().int().min(1).max(100),
  staffCount: z.coerce.number().int().min(0).max(1000),
  beds: z.coerce.number().int().min(0).max(500),
  equipment: z.array(trimmed(60)).max(30).default([]),
  neededBloodGroups: z.array(bloodGroupSchema).default([]),
  statusOverride: z.enum(["AUTO", "OPEN", "CLOSED", "FULL"]).default("AUTO"),
  description: trimmed(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const locationSchema = z.object({
  name: trimmed(80).min(2),
  nameBn: trimmed(80).optional().nullable(),
  type: z.enum(["DIVISION", "DISTRICT", "AREA"]),
  parentId: idSchema.optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["DONOR", "CENTER_STAFF", "HOSPITAL", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
  centerId: idSchema.optional().nullable(),
  hospitalId: idSchema.optional().nullable(),
  verifyEmail: z.boolean().optional(),
  reason: trimmed(300).optional(),
});

export const reportResolveSchema = z.object({
  status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]),
  action: z.enum(["NONE", "WARN", "SUSPEND", "REMOVE"]).default("NONE"),
  adminNote: trimmed(500).optional(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { TokenType } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { ApiError } from "@/server/http";
import { audit } from "@/server/audit";
import { hashPassword, verifyPassword } from "@/server/auth/session";
import { sendEmail, sendSms } from "@/server/notify/channels";
import { assertAreaLocation } from "@/server/services/locations";
import { normalizePhone, type registerSchema } from "@/lib/validation";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function newReferralCode() {
  return randomBytes(5).toString("base64url").replace(/[-_]/g, "x").slice(0, 8).toUpperCase();
}

async function issueToken(userId: string, type: TokenType, ttlMs: number, value?: string) {
  const raw = value ?? randomBytes(32).toString("base64url");
  // One live token per user+type.
  await db.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
  // For OTPs the hash is salted with the user id so identical codes never collide.
  await db.verificationToken.create({
    data: { userId, type, tokenHash: sha256(type === "PHONE_OTP" ? `${userId}:${raw}` : raw), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return raw;
}

export async function sendEmailVerification(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFY", 48 * 3_600_000);
  const link = `${env.appUrl}/verify?token=${encodeURIComponent(token)}`;
  await sendEmail(user.email, "Verify your LifeDrop email", `Hi ${user.name},\n\nConfirm your email to start receiving donation requests:\n${link}\n\nThis link expires in 48 hours.`);
  return env.exposeDevSecrets ? link : undefined;
}

export async function sendPhoneOtp(user: { id: string; phone: string }) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await issueToken(user.id, "PHONE_OTP", 10 * 60_000, code);
  await sendSms(user.phone, `Your LifeDrop verification code is ${code}. It expires in 10 minutes.`);
  return env.exposeDevSecrets ? code : undefined;
}

export async function registerUser(input: z.infer<typeof registerSchema>, ip?: string) {
  if (!(await assertAreaLocation(input.locationId))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Select your area.", { locationId: "Select your area" });
  }
  const existing = await db.user.findFirst({ where: { OR: [{ email: input.email }, { phone: input.phone }] }, select: { email: true } });
  if (existing) {
    throw new ApiError(409, "ACCOUNT_EXISTS", "An account with this email or phone already exists. Try signing in.", {
      [existing.email === input.email ? "email" : "phone"]: "Already registered",
    });
  }
  const referrer = input.referralCode
    ? await db.user.findUnique({ where: { referralCode: input.referralCode.toUpperCase() }, select: { id: true } })
    : null;

  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: "DONOR", // roles can only be elevated by an admin, server-side
      locale: input.locale ?? "en",
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      locationId: input.locationId,
      referralCode: newReferralCode(),
      referredById: referrer?.id,
      donorProfile: {
        create: {
          bloodGroup: input.bloodGroup,
          weightKg: input.weightKg,
          lastDonationDate: input.lastDonationDate ?? null,
          healthDeclarationOk: input.healthDeclarationOk,
          availability: input.wantsToDonate ? "AVAILABLE" : "NOT_AVAILABLE",
          showInSearch: input.wantsToDonate,
          locationId: input.locationId,
        },
      },
    },
  });
  await audit({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id, ip });
  const devVerifyLink = await sendEmailVerification(user);
  return { user, devVerifyLink };
}

let dummyHash: string | undefined;

export async function authenticate(identifier: string, password: string, ip?: string) {
  const id = identifier.trim().toLowerCase();
  const user = await db.user.findFirst({
    where: id.includes("@") ? { email: id } : { phone: normalizePhone(identifier) },
  });
  // Constant-ish work whether or not the user exists.
  dummyHash ??= await hashPassword("timing-equaliser");
  const storedHash = user && user.passwordHash.startsWith("$2") ? user.passwordHash : dummyHash;
  const okPw = await verifyPassword(password, storedHash);
  if (!user || !okPw || user.deletedAt || storedHash === dummyHash) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email/phone or password is incorrect.");
  }
  if (user.status === "SUSPENDED") throw new ApiError(403, "SUSPENDED", "This account is suspended. Contact support if you believe this is a mistake.");
  if (user.status !== "ACTIVE") throw new ApiError(403, "INACTIVE", "This account is no longer active.");
  await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip });
  return user;
}

async function consumeToken(type: TokenType, hash: string, userId?: string) {
  const t = await db.verificationToken.findUnique({ where: { tokenHash: hash } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt < new Date() || (userId && t.userId !== userId)) return null;
  await db.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}

export async function verifyEmailToken(token: string) {
  const t = await consumeToken("EMAIL_VERIFY", sha256(token));
  if (!t) throw new ApiError(400, "INVALID_TOKEN", "This verification link is invalid or has expired.");
  await db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
  return t.userId;
}

export async function verifyPhoneCode(userId: string, code: string) {
  const live = await db.verificationToken.findFirst({ where: { userId, type: "PHONE_OTP", usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!live || live.expiresAt < new Date()) throw new ApiError(400, "INVALID_CODE", "The code has expired. Request a new one.");
  if (live.attempts >= 5) throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many wrong attempts. Request a new code.");
  if (live.tokenHash !== sha256(`${userId}:${code}`)) {
    await db.verificationToken.update({ where: { id: live.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, "INVALID_CODE", "That code is not correct.");
  }
  await db.verificationToken.update({ where: { id: live.id }, data: { usedAt: new Date() } });
  await db.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
}

export async function requestPasswordReset(email: string, ip?: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Always respond the same way to avoid account enumeration.
  if (!user || user.status !== "ACTIVE") return undefined;
  const token = await issueToken(user.id, "PASSWORD_RESET", 60 * 60_000);
  const link = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail(user.email, "Reset your LifeDrop password", `Hi ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`);
  await audit({ actorId: user.id, action: "auth.reset_requested", entityType: "User", entityId: user.id, ip });
  return env.exposeDevSecrets ? link : undefined;
}

export async function resetPassword(token: string, password: string, ip?: string) {
  const t = await consumeToken("PASSWORD_RESET", sha256(token));
  if (!t) throw new ApiError(400, "INVALID_TOKEN", "This reset link is invalid or has expired.");
  // Bumping tokenVersion signs out every existing session.
  const user = await db.user.update({
    where: { id: t.userId },
    data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 }, emailVerifiedAt: undefined },
  });
  await audit({ actorId: user.id, action: "auth.password_reset", entityType: "User", entityId: user.id, ip });
  return user;
}

/** Soft-delete: anonymise personal data, withdraw from active requests, keep donation history integrity. */
export async function deleteAccount(userId: string) {
  const anon = `deleted-${userId}`;
  const affected = await db.donationRequest.findMany({ where: { donorId: userId, status: { in: ["PENDING", "ACCEPTED"] } }, select: { id: true } });
  await db.$transaction(async (tx) => {
    await tx.donationRequest.updateMany({ where: { id: { in: affected.map((a) => a.id) } }, data: { status: "CANCELLED" } });
    const openReqs = await tx.bloodRequest.findMany({ where: { requesterId: userId, status: { in: ["DRAFT", "OPEN", "MATCHING", "DONOR_CONTACTED", "DONOR_ACCEPTED"] } } });
    for (const r of openReqs) {
      await tx.bloodRequest.update({ where: { id: r.id }, data: { status: "CANCELLED", closedAt: new Date(), patientName: "Removed", contactPhone: null } });
      await tx.requestStatusEvent.create({ data: { requestId: r.id, fromStatus: r.status, toStatus: "CANCELLED", note: "Requester deleted account" } });
      await tx.donationRequest.updateMany({ where: { bloodRequestId: r.id, status: { in: ["PENDING", "ACCEPTED"] } }, data: { status: "CANCELLED" } });
    }
    await tx.appointment.updateMany({ where: { donorId: userId, status: "BOOKED" }, data: { status: "CANCELLED", cancelledReason: "Account deleted" } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { userId } });
    await tx.donorProfile.updateMany({ where: { userId }, data: { availability: "NOT_AVAILABLE", showInSearch: false, healthNotes: null } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "REMOVED",
        deletedAt: new Date(),
        name: "Deleted user",
        email: `${anon}@deleted.invalid`,
        phone: `+0${userId.slice(-12)}`,
        passwordHash: "!",
        avatarPath: null,
        note: null,
        organization: null,
        dateOfBirth: null,
        tokenVersion: { increment: 1 },
      },
    });
  });
  await audit({ actorId: userId, action: "user.delete_self", entityType: "User", entityId: userId });
}

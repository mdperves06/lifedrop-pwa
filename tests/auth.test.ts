import { describe, expect, it, beforeAll } from "vitest";
import { hashPassword, verifyPassword, signSession, verifySessionToken, assertRole } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { authenticate, registerUser, requestPasswordReset, resetPassword, verifyEmailToken } from "@/server/services/auth";
import { db } from "@/server/db";
import { makeLocations, resetDb } from "./fixtures";

describe("password hashing & session tokens", () => {
  it("hashes with bcrypt and verifies", async () => {
    const h = await hashPassword("s3cret-pass");
    expect(h).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("s3cret-pass", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("signs and verifies JWT sessions; rejects tampering", async () => {
    const token = await signSession({ sub: "user1", role: "DONOR", tv: 0 });
    expect(await verifySessionToken(token)).toEqual({ sub: "user1", role: "DONOR", tv: 0 });
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "ADMIN" })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
  });
});

describe("authorization", () => {
  it("assertRole throws 403 for other roles", () => {
    expect(() => assertRole({ role: "ADMIN" }, "ADMIN")).not.toThrow();
    try {
      assertRole({ role: "DONOR" }, "ADMIN", "CENTER_STAFF");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(403);
    }
  });
});

describe("registration, login and password reset", () => {
  let areaId: string;
  beforeAll(async () => {
    await resetDb();
    areaId = (await makeLocations()).A.id;
  });
  const input = () => ({
    name: "Reg Test", email: "reg@test.local", phone: "+8801711000001", password: "Passw0rd!", bloodGroup: "B_POS" as const, locationId: areaId,
    dateOfBirth: new Date("1995-05-05"), gender: "UNDISCLOSED" as const, weightKg: 60, healthDeclarationOk: true, wantsToDonate: true, acceptTerms: true as const,
  });

  it("registers a donor with a profile, always as DONOR role", async () => {
    const { user, devVerifyLink } = await registerUser(input());
    expect(user.role).toBe("DONOR");
    const dp = await db.donorProfile.findUnique({ where: { userId: user.id } });
    expect(dp?.bloodGroup).toBe("B_POS");
    expect(devVerifyLink).toContain("/verify?token=");
    // Email verification
    const token = new URL(devVerifyLink!).searchParams.get("token")!;
    await verifyEmailToken(token);
    expect((await db.user.findUnique({ where: { id: user.id } }))?.emailVerifiedAt).not.toBeNull();
    await expect(verifyEmailToken(token)).rejects.toMatchObject({ code: "INVALID_TOKEN" }); // single use
  });

  it("rejects duplicate accounts and non-area locations", async () => {
    await expect(registerUser(input())).rejects.toMatchObject({ status: 409 });
    const div = await db.location.findFirst({ where: { type: "DIVISION" } });
    await expect(registerUser({ ...input(), email: "x@test.local", phone: "+8801711000002", locationId: div!.id })).rejects.toMatchObject({ status: 422 });
  });

  it("authenticates by email or phone and rejects bad passwords / suspended users", async () => {
    expect((await authenticate("REG@test.local", "Passw0rd!")).email).toBe("reg@test.local");
    expect((await authenticate("01711000001", "Passw0rd!")).email).toBe("reg@test.local");
    await expect(authenticate("reg@test.local", "nope")).rejects.toMatchObject({ status: 401 });
    await expect(authenticate("nobody@test.local", "Passw0rd!")).rejects.toMatchObject({ status: 401 });
    await db.user.update({ where: { email: "reg@test.local" }, data: { status: "SUSPENDED" } });
    await expect(authenticate("reg@test.local", "Passw0rd!")).rejects.toMatchObject({ status: 403 });
    await db.user.update({ where: { email: "reg@test.local" }, data: { status: "ACTIVE" } });
  });

  it("resets password with a single-use token and revokes sessions", async () => {
    const before = await db.user.findUnique({ where: { email: "reg@test.local" } });
    expect(await requestPasswordReset("unknown@test.local")).toBeUndefined(); // no enumeration
    const link = await requestPasswordReset("reg@test.local");
    const token = new URL(link!).searchParams.get("token")!;
    await resetPassword(token, "NewPassw0rd!");
    const after = await db.user.findUnique({ where: { email: "reg@test.local" } });
    expect(after!.tokenVersion).toBe(before!.tokenVersion + 1);
    expect((await authenticate("reg@test.local", "NewPassw0rd!")).id).toBe(before!.id);
    await expect(resetPassword(token, "Another1!")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});

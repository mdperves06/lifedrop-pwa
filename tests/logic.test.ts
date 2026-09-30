import { describe, expect, it } from "vitest";
import { BLOOD_GROUPS, canDonate, compatibleDonorGroups, isBloodGroup, parseBloodGroup } from "@/lib/blood";
import { badgeFor, checkEligibility, nextEligibleDate, ageFromDob } from "@/lib/eligibility";
import { canTransition, isActive, isTerminal } from "@/lib/lifecycle";
import { bloodRequestSchema, normalizePhone, registerSchema } from "@/lib/validation";
import { distanceKm } from "@/lib/geo";
import { fromLocal, localParts, localDateKey } from "@/lib/time";
import { safeNextPath } from "@/lib/safe-redirect";

describe("blood group validation", () => {
  it("accepts exactly the eight standard groups", () => {
    expect(BLOOD_GROUPS).toHaveLength(8);
    for (const g of BLOOD_GROUPS) expect(isBloodGroup(g)).toBe(true);
    for (const bad of ["O", "A+", "Z_POS", "", null, undefined, 42, "o_pos "]) expect(isBloodGroup(bad)).toBe(false);
  });
  it("parses labels and codes, rejects arbitrary strings", () => {
    expect(parseBloodGroup("O+")).toBe("O_POS");
    expect(parseBloodGroup("ab-")).toBe("AB_NEG");
    expect(parseBloodGroup("B_POS")).toBe("B_POS");
    expect(parseBloodGroup("C+")).toBeNull();
    expect(parseBloodGroup("<script>")).toBeNull();
  });
  it("rejects arbitrary groups in request payloads", () => {
    const base = { units: 1, patientName: "P", hospitalName: "Hospital", locationId: "abc123", neededAt: new Date().toISOString(), priority: "NORMAL" };
    expect(bloodRequestSchema.safeParse({ ...base, bloodGroup: "O+" }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...base, patientName: "Pa", bloodGroup: "O_POS" }).success).toBe(true);
  });
});

describe("compatibility", () => {
  it("O- is a universal red-cell donor, AB+ a universal recipient", () => {
    expect(compatibleDonorGroups("AB_POS")).toHaveLength(8);
    for (const g of BLOOD_GROUPS) expect(canDonate("O_NEG", g)).toBe(true);
    expect(compatibleDonorGroups("O_NEG")).toEqual(["O_NEG"]);
  });
  it("Rh-negative patients cannot receive Rh-positive blood", () => {
    expect(canDonate("O_POS", "A_NEG")).toBe(false);
    expect(canDonate("A_NEG", "A_POS")).toBe(true);
    expect(compatibleDonorGroups("B_NEG").sort()).toEqual(["B_NEG", "O_NEG"].sort());
  });
});

describe("eligibility guidance", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("computes next eligible date from last donation", () => {
    expect(nextEligibleDate("2026-03-01T00:00:00Z", 90)?.toISOString()).toBe("2026-05-30T00:00:00.000Z");
    expect(nextEligibleDate(null)).toBeNull();
  });
  it("flags age, weight, interval and health issues", () => {
    expect(checkEligibility({ age: 25, weightKg: 60 }, { now }).eligible).toBe(true);
    const r = checkEligibility({ age: 17, weightKg: 45, lastDonationDate: "2026-05-01", recentTattoo: true }, { now, intervalDays: 90 });
    expect(r.issues).toEqual(expect.arrayContaining(["TOO_YOUNG", "UNDERWEIGHT", "TOO_SOON", "RECENT_TATTOO"]));
    expect(r.nextEligibleDate).not.toBeNull();
    expect(checkEligibility({}, { requireAll: true }).issues).toEqual(expect.arrayContaining(["AGE_UNKNOWN", "WEIGHT_UNKNOWN"]));
  });
  it("computes age correctly around birthdays", () => {
    expect(ageFromDob("2000-06-02", now)).toBe(25);
    expect(ageFromDob("2000-06-01", now)).toBe(26);
  });
  it("assigns private achievement tiers", () => {
    expect([0, 1, 4, 5, 9, 10, 25].map(badgeFor)).toEqual(["NONE", "BRONZE", "BRONZE", "SILVER", "SILVER", "GOLD", "GOLD"]);
  });
});

describe("request lifecycle", () => {
  it("allows the happy path and blocks invalid jumps", () => {
    expect(canTransition("DRAFT", "OPEN")).toBe(true);
    expect(canTransition("OPEN", "MATCHING")).toBe(true);
    expect(canTransition("MATCHING", "DONOR_CONTACTED")).toBe(true);
    expect(canTransition("DONOR_CONTACTED", "DONOR_ACCEPTED")).toBe(true);
    expect(canTransition("DONOR_ACCEPTED", "FULFILLED")).toBe(true);
    expect(canTransition("FULFILLED", "CLOSED")).toBe(true);
    expect(canTransition("CANCELLED", "OPEN")).toBe(false);
    expect(canTransition("CLOSED", "OPEN")).toBe(false);
    expect(canTransition("FULFILLED", "CANCELLED")).toBe(false);
    expect(canTransition("EXPIRED", "OPEN")).toBe(true);
  });
  it("classifies active / terminal statuses", () => {
    expect(isActive("DONOR_CONTACTED")).toBe(true);
    expect(isActive("FULFILLED")).toBe(false);
    expect(isTerminal("EXPIRED")).toBe(true);
  });
});

describe("input validation", () => {
  it("normalises Bangladeshi phone numbers", () => {
    expect(normalizePhone("01712-345678")).toBe("+8801712345678");
    expect(normalizePhone("8801712345678")).toBe("+8801712345678");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
  });
  it("requires strong-enough passwords and consent at registration", () => {
    const base = { name: "Test User", email: "t@example.com", phone: "01712345678", bloodGroup: "O_POS", locationId: "abc", dateOfBirth: "1995-01-01", weightKg: 60, healthDeclarationOk: true, acceptTerms: true };
    expect(registerSchema.safeParse({ ...base, password: "password" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "passw0rd!" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "passw0rd!", acceptTerms: false }).success).toBe(false);
    // Role cannot be injected through the public schema.
    const parsed = registerSchema.parse({ ...base, password: "passw0rd!", role: "ADMIN" });
    expect("role" in parsed).toBe(false);
  });
});

describe("geo & time helpers", () => {
  it("measures distance in km", () => {
    const d = distanceKm({ lat: 23.7465, lng: 90.376 }, { lat: 23.7389, lng: 90.3957 });
    expect(d).toBeGreaterThan(1.5);
    expect(d).toBeLessThan(2.5);
  });
  it("converts between UTC and city local time (UTC+6)", () => {
    const d = fromLocal(2026, 1, 15, 8);
    expect(d.toISOString()).toBe("2026-01-15T02:00:00.000Z");
    expect(localParts(d).h).toBe(8);
    expect(localDateKey(new Date("2026-01-15T19:00:00Z"))).toBe("2026-01-16");
  });
});

describe("post-login redirect safety", () => {
  it("allows relative paths only", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/requests/new?priority=EMERGENCY")).toBe("/requests/new?priority=EMERGENCY");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a\nb", "", undefined]) {
      expect(safeNextPath(bad)).toBeUndefined();
    }
  });
});

import { describe, it, expect } from "vitest";
import { loginSchema, changePasswordSchema, mfaCodeSchema, safeNextPath } from "@/features/auth/schemas";
import { passwordSchema } from "@/server/auth/password";
import { parsePeriod, periodRange } from "@/features/dashboard/period";

describe("auth schemas", () => {
  it("rejects unknown keys (mass-assignment protection)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x", isAdmin: true }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "a", newPassword: "b".repeat(12), confirmPassword: "b".repeat(12), role: "SUPER_ADMIN" }).success).toBe(false);
  });

  it("validates login input", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ceo@nexus.local", password: "x" }).success).toBe(true);
  });

  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("password1234").success).toBe(false); // deny-list
    expect(passwordSchema.safeParse("aaaaaaaaaaaa").success).toBe(false); // repetition
    expect(passwordSchema.safeParse("correct horse battery staple").success).toBe(true);
  });

  it("accepts TOTP and recovery code shapes only", () => {
    expect(mfaCodeSchema.safeParse({ code: "123 456" }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: "ab12c-de34f-5a6b7-c8d9e" }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: "<script>" }).success).toBe(false);
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/projects", "/projects"],
    ["//evil.com", "/"],
    ["https://evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/api/auth/signout", "/"],
    [undefined, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("dashboard period", () => {
  it("falls back to month on garbage input", () => {
    expect(parsePeriod("drop table")).toBe("month");
    expect(parsePeriod("week")).toBe("week");
  });
  it("produces a contiguous previous window", () => {
    const r = periodRange("week", new Date("2026-11-04T12:00:00Z"));
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
    expect(r.start.getTime()).toBeGreaterThan(r.prevStart.getTime());
  });
});

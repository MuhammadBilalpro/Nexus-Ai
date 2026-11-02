/**
 * Security-focused integration tests against the test database:
 * password hashing, MFA (TOTP + recovery), session revocation and rate limiting.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { encryptSecret, decryptSecret, beginEnrollment, confirmEnrollment, verifyMfaChallenge, verifyTotp, disableMfa } from "@/server/auth/mfa";
import { createSession, findLiveSession, revokeSession, revokeAllUserSessions, markMfaVerified } from "@/server/auth/session-store";
import { rateLimit } from "@/server/security/rate-limit";

const email = `sec-test-${Date.now()}@test.local`;
let userId = "";

beforeAll(async () => {
  const u = await db.user.create({ data: { email, name: "Sec Test", passwordHash: await hashPassword("correct horse battery staple") } });
  userId = u.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email } });
  await db.rateLimit.deleteMany({ where: { key: { startsWith: "test:" } } });
  await db.$disconnect();
});

describe("password hashing", () => {
  it("produces Argon2id hashes and verifies them", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });
  it("never throws on malformed hashes", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("MFA", () => {
  it("encrypts secrets at rest with authenticated encryption", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
    const [iv, tag, body] = enc.split(".");
    expect(() => decryptSecret(`${iv}.${tag}.${body?.slice(0, -4)}AAAA`)).toThrow();
  });

  it("enrols, confirms with a live code, and accepts recovery codes once", async () => {
    const { secret, uri } = await beginEnrollment(userId, email);
    expect(uri).toContain("otpauth://totp/");
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).mfaEnabled).toBe(false);

    expect(await confirmEnrollment(userId, "000000")).toEqual({ ok: false });

    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    const result = await confirmEnrollment(userId, totp.generate());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recoveryCodes).toHaveLength(10);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).mfaEnabled).toBe(true);

    expect(await verifyMfaChallenge(userId, totp.generate())).toBe("totp");
    const code = result.recoveryCodes[0]!;
    expect(await verifyMfaChallenge(userId, code)).toBe("recovery");
    expect(await verifyMfaChallenge(userId, code)).toBeNull(); // single use
    expect(await verifyMfaChallenge(userId, "999999")).toBeNull();

    await disableMfa(userId);
    expect(await db.mfaSecret.count({ where: { userId } })).toBe(0);
    expect(await db.recoveryCode.count({ where: { userId } })).toBe(0);
  });

  it("rejects malformed TOTP input", () => {
    expect(verifyTotp("JBSWY3DPEHPK3PXP", "12345")).toBe(false);
    expect(verifyTotp("JBSWY3DPEHPK3PXP", "abcdef")).toBe(false);
  });
});

describe("sessions", () => {
  it("creates, resolves, marks MFA and revokes", async () => {
    const s = await createSession({ userId, mfaVerified: false, ipAddress: "127.0.0.1", userAgent: "vitest" });
    const live = await findLiveSession(s.id);
    expect(live?.user.email).toBe(email);
    expect(live?.mfaVerified).toBe(false);
    await markMfaVerified(s.id);
    // findLiveSession is request-cached in React; the DB row is the source of truth here.
    expect((await db.session.findUniqueOrThrow({ where: { id: s.id } })).mfaVerified).toBe(true);
    await revokeSession(s.id);
    expect(await db.session.count({ where: { id: s.id } })).toBe(0);
  });

  it("revokes all other sessions but keeps the current one", async () => {
    const a = await createSession({ userId, mfaVerified: true });
    await createSession({ userId, mfaVerified: true });
    await createSession({ userId, mfaVerified: true });
    const revoked = await revokeAllUserSessions(userId, a.id);
    expect(revoked).toBe(2);
    expect(await db.session.count({ where: { userId } })).toBe(1);
  });

  it("treats deactivated users as signed out", async () => {
    const s = await createSession({ userId, mfaVerified: true });
    await db.user.update({ where: { id: userId }, data: { isActive: false } });
    expect(await findLiveSession(s.id)).toBeNull();
    await db.user.update({ where: { id: userId }, data: { isActive: true } });
  });

  it("invalidates sessions created before a password change", async () => {
    const s = await createSession({ userId, mfaVerified: true });
    await db.user.update({ where: { id: userId }, data: { passwordChangedAt: new Date(Date.now() + 1000) } });
    expect(await findLiveSession(s.id)).toBeNull();
    await db.user.update({ where: { id: userId }, data: { passwordChangedAt: null } });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then blocks with a retry hint", async () => {
    const key = `test:rl:${Date.now()}`;
    const policy = { limit: 3, windowSeconds: 60 };
    expect((await rateLimit.hit(key, policy)).allowed).toBe(true);
    expect((await rateLimit.hit(key, policy)).allowed).toBe(true);
    expect((await rateLimit.hit(key, policy)).allowed).toBe(true);
    const blocked = await rateLimit.hit(key, policy);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    await rateLimit.reset(key);
    expect((await rateLimit.hit(key, policy)).allowed).toBe(true);
  });
});

describe("audit log immutability", () => {
  it("rejects UPDATE and DELETE at the database level", async () => {
    const row = await db.auditLog.create({ data: { action: "test.event", resourceType: "test" } });
    await expect(db.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } })).rejects.toThrow(/immutable/);
    await expect(db.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/immutable/);
  });
});

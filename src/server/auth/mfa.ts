import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";
import { env } from "@/lib/env";
import { db } from "@/server/db";

const ISSUER = "NEXUS AI";
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 10;

// ───────── secret encryption at rest (AES-256-GCM) ─────────

function key(): Buffer {
  return Buffer.from(env.MFA_ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encB64) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
}

// ───────── TOTP ─────────

function totpFor(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1", // broadest authenticator-app compatibility
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function otpauthUri(secretBase32: string, label: string): string {
  return totpFor(secretBase32, label).toString();
}

/** Accepts the current step and one step either side (±30s clock drift). */
export function verifyTotp(secretBase32: string, code: string, label = "user"): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const delta = totpFor(secretBase32, label).validate({ token: normalized, window: 1 });
  return delta !== null;
}

// ───────── recovery codes ─────────

function hashRecoveryCode(code: string): string {
  // Codes are 80-bit random values; SHA-256 is sufficient (no need for a slow hash).
  return createHash("sha256").update(code.replace(/-/g, "").toLowerCase()).digest("hex");
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const hex = randomBytes(10).toString("hex"); // 20 hex chars
    return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
  });
}

// ───────── enrollment flow ─────────

/** Step 1: create (or replace) a pending, unverified secret and return enrollment material. */
export async function beginEnrollment(userId: string, email: string): Promise<{ secret: string; uri: string }> {
  const secret = generateTotpSecret();
  await db.mfaSecret.upsert({
    where: { userId },
    update: { secretEnc: encryptSecret(secret), verifiedAt: null },
    create: { userId, secretEnc: encryptSecret(secret) },
  });
  return { secret, uri: otpauthUri(secret, email) };
}

/** Step 2: confirm with a live code; enables MFA and issues recovery codes (returned once, stored hashed). */
export async function confirmEnrollment(userId: string, code: string): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false }> {
  const row = await db.mfaSecret.findUnique({ where: { userId } });
  if (!row) return { ok: false };
  const secret = decryptSecret(row.secretEnc);
  if (!verifyTotp(secret, code)) return { ok: false };

  const codes = generateRecoveryCodes();
  await db.$transaction([
    db.mfaSecret.update({ where: { userId }, data: { verifiedAt: new Date() } }),
    db.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return { ok: true, recoveryCodes: codes };
}

export async function disableMfa(userId: string): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { mfaEnabled: false } }),
    db.mfaSecret.deleteMany({ where: { userId } }),
    db.recoveryCode.deleteMany({ where: { userId } }),
  ]);
}

/** Login step-up: verify a TOTP code or consume a recovery code. */
export async function verifyMfaChallenge(userId: string, code: string): Promise<"totp" | "recovery" | null> {
  const row = await db.mfaSecret.findUnique({ where: { userId } });
  if (row?.verifiedAt) {
    const secret = decryptSecret(row.secretEnc);
    if (verifyTotp(secret, code)) return "totp";
  }
  // Recovery code: constant-time compare against stored hashes
  const candidate = hashRecoveryCode(code);
  const codes = await db.recoveryCode.findMany({ where: { userId, usedAt: null }, select: { id: true, codeHash: true } });
  const match = codes.find((c) => {
    const a = Buffer.from(c.codeHash, "hex");
    const b = Buffer.from(candidate, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (match) {
    await db.recoveryCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
    return "recovery";
  }
  return null;
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return db.recoveryCode.count({ where: { userId, usedAt: null } });
}

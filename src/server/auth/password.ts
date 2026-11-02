import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

/**
 * Argon2id parameters follow the OWASP Password Storage Cheat Sheet
 * (m=64 MiB, t=3, p=4 — "first recommended option").
 */
const ARGON2_OPTIONS = {
  algorithm: 2 as const, // Algorithm.Argon2id (const enum; numeric value used because isolatedModules forbids ambient const enums)
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Constant-time verification handled by the argon2 implementation.
 * Returns false (never throws) on malformed hashes so callers behave
 * identically for "no such user" and "wrong password".
 */
export async function verifyPassword(encodedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(encodedHash, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/** Dummy hash used to equalise timing when the account does not exist. */
let dummyHashPromise: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("nexus-timing-equaliser-" + Math.random().toString(36));
  return dummyHashPromise;
}

const COMMON_ROOTS = new Set(["password", "passw0rd", "qwerty", "qwertyuiop", "letmein", "welcome", "admin", "administrator", "iloveyou", "changeme", "nexus", "nexusai", "abcdef", "abcdefgh", "monkey", "dragon", "football", "baseball", "sunshine", "princess"]);

/** Lower-case the password and strip digits/symbols to find its dictionary "root". */
function passwordRoot(p: string): string {
  return p.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Password policy: length over composition rules (NIST SP 800-63B),
 * plus a small deny-list and no obvious repetition.
 */
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((p) => !COMMON_ROOTS.has(passwordRoot(p)), "This password is too common")
  .refine((p) => passwordRoot(p).length >= 4 || /[^a-z0-9]/i.test(p), "Password cannot be mostly digits")
  .refine((p) => !/^(.)\1+$/.test(p), "Password cannot be a single repeated character")
  .refine((p) => new Set(p).size >= 5, "Password must use at least 5 distinct characters");

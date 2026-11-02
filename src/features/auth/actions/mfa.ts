"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/principal";
import { signOut, updateSession } from "@/server/auth";
import { verifyMfaChallenge, beginEnrollment, confirmEnrollment, disableMfa } from "@/server/auth/mfa";
import { markMfaVerified, revokeAllUserSessions } from "@/server/auth/session-store";
import { requestMeta } from "@/server/auth/request-meta";
import { verifyPassword } from "@/server/auth/password";
import { audit } from "@/server/audit/audit";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { mfaCodeSchema, safeNextPath } from "../schemas";

export interface MfaState {
  error?: string;
}

/** Login step-up: called from /mfa after a password login on an MFA-enabled account. */
export async function verifyMfaAction(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mfaEnabled || user.mfaVerified) redirect("/");

  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid code" };

  const meta = await requestMeta();
  const limit = await rateLimit.hit(`mfa:${user.id}`, RATE_LIMITS.mfaAttempt);
  if (!limit.allowed) {
    await audit.record({ actorId: user.id, action: "auth.mfa_verify", resourceType: "session", resourceId: user.sessionId, outcome: "denied", metadata: { reason: "rate_limited" }, ...meta });
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
  }

  const method = await verifyMfaChallenge(user.id, parsed.data.code);
  if (!method) {
    await audit.record({ actorId: user.id, action: "auth.mfa_verify", resourceType: "session", resourceId: user.sessionId, outcome: "denied", ...meta });
    return { error: "That code is not valid." };
  }

  await markMfaVerified(user.sessionId);
  await updateSession({ user: { mfaVerified: true } }); // refresh the JWT cookie's mfaPending flag
  await rateLimit.reset(`mfa:${user.id}`);
  await audit.record({ actorId: user.id, action: "auth.mfa_verify", resourceType: "session", resourceId: user.sessionId, metadata: { method }, ...meta });
  redirect(safeNextPath(String(formData.get("next") ?? "/")));
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

// ───────── Enrollment (Settings → Security) ─────────

export interface EnrollmentState {
  step: "idle" | "pending" | "done";
  secret?: string;
  uri?: string;
  qrSvg?: string;
  recoveryCodes?: string[];
  error?: string;
}

export async function beginMfaEnrollmentAction(): Promise<EnrollmentState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mfaEnabled) return { step: "idle", error: "MFA is already enabled." };

  const { secret, uri } = await beginEnrollment(user.id, user.email);
  const { toString } = await import("qrcode");
  const qrSvg = await toString(uri, { type: "svg", margin: 1, width: 196, color: { dark: "#e5e7eb", light: "#00000000" } });
  await audit.record({ actorId: user.id, action: "auth.mfa_enroll_begin", resourceType: "user", resourceId: user.id, ...(await requestMeta()) });
  return { step: "pending", secret, uri, qrSvg };
}

export async function confirmMfaEnrollmentAction(prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ...prev, error: parsed.error.issues[0]?.message ?? "Invalid code" };

  const result = await confirmEnrollment(user.id, parsed.data.code);
  const meta = await requestMeta();
  if (!result.ok) {
    await audit.record({ actorId: user.id, action: "auth.mfa_enroll_confirm", resourceType: "user", resourceId: user.id, outcome: "denied", ...meta });
    return { ...prev, error: "That code did not match. Check your authenticator app and try again." };
  }
  // The current session is now the verified one.
  await markMfaVerified(user.sessionId);
  await updateSession({ user: { mfaVerified: true } });
  await audit.record({ actorId: user.id, action: "auth.mfa_enroll_confirm", resourceType: "user", resourceId: user.id, ...meta });
  return { step: "done", recoveryCodes: result.recoveryCodes };
}

export interface DisableMfaState {
  error?: string;
  ok?: boolean;
}

export async function disableMfaAction(_prev: DisableMfaState, formData: FormData): Promise<DisableMfaState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const password = String(formData.get("password") ?? "");
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, password))) {
    return { error: "Incorrect password." };
  }
  await disableMfa(user.id);
  // Other sessions may have been established with MFA; revoke them to be safe.
  await revokeAllUserSessions(user.id, user.sessionId);
  await audit.record({ actorId: user.id, action: "auth.mfa_disable", resourceType: "user", resourceId: user.id, ...(await requestMeta()) });
  return { ok: true };
}

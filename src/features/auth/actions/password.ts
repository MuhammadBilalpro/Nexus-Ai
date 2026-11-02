"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/principal";
import { hashPassword, verifyPassword, passwordSchema } from "@/server/auth/password";
import { revokeAllUserSessions } from "@/server/auth/session-store";
import { requestMeta } from "@/server/auth/request-meta";
import { audit } from "@/server/audit/audit";
import { db } from "@/server/db";
import { changePasswordSchema } from "../schemas";

export interface ChangePasswordState {
  error?: string;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
  ok?: boolean;
  revoked?: number;
}

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isDemo) return { error: "This is a shared demo account — security settings are locked." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: ChangePasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "currentPassword" || k === "newPassword" || k === "confirmPassword") fieldErrors[k] ??= issue.message;
    }
    return { fieldErrors };
  }
  const policy = passwordSchema.safeParse(parsed.data.newPassword);
  if (!policy.success) return { fieldErrors: { newPassword: policy.error.issues[0]?.message } };
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return { fieldErrors: { newPassword: "New password must differ from the current one" } };
  }

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const meta = await requestMeta();
  if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, parsed.data.currentPassword))) {
    await audit.record({ actorId: user.id, action: "auth.password_change", resourceType: "user", resourceId: user.id, outcome: "denied", ...meta });
    return { fieldErrors: { currentPassword: "Incorrect password" } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword), passwordChangedAt: new Date() },
  });
  // Password change invalidates every other session (findLiveSession enforces passwordChangedAt > createdAt).
  const revoked = await revokeAllUserSessions(user.id, user.sessionId);
  // Keep the current session alive by re-stamping its creation time after the change.
  await db.session.update({ where: { id: user.sessionId }, data: { createdAt: new Date() } });
  await audit.record({ actorId: user.id, action: "auth.password_change", resourceType: "user", resourceId: user.id, metadata: { revokedSessions: revoked }, ...meta });
  return { ok: true, revoked };
}

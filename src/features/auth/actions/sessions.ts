"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/principal";
import { revokeSession, revokeAllUserSessions } from "@/server/auth/session-store";
import { requestMeta } from "@/server/auth/request-meta";
import { audit } from "@/server/audit/audit";
import { db } from "@/server/db";

const idSchema = z.string().cuid();

/** Revoke one of the caller's own sessions. Ownership is verified server-side (IDOR-safe). */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isDemo) return;
  const parsed = idSchema.safeParse(formData.get("sessionId"));
  if (!parsed.success) return;
  const owned = await db.session.findFirst({ where: { id: parsed.data, userId: user.id }, select: { id: true } });
  if (!owned) {
    await audit.record({ actorId: user.id, action: "auth.session_revoke", resourceType: "session", resourceId: parsed.data, outcome: "denied", metadata: { reason: "not_owner" }, ...(await requestMeta()) });
    return;
  }
  await revokeSession(owned.id);
  await audit.record({ actorId: user.id, action: "auth.session_revoke", resourceType: "session", resourceId: owned.id, ...(await requestMeta()) });
  revalidatePath("/settings/security");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isDemo) return;
  const count = await revokeAllUserSessions(user.id, user.sessionId);
  await audit.record({ actorId: user.id, action: "auth.session_revoke_all", resourceType: "user", resourceId: user.id, metadata: { count }, ...(await requestMeta()) });
  revalidatePath("/settings/security");
}

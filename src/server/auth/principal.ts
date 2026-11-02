import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { assertCan, type Permission, type Principal } from "@/server/policies";

export interface CurrentUser extends Principal {
  email: string;
  name: string | null;
  image: string | null;
  mfaEnabled: boolean;
  sessionId: string;
  /** Shared public demo account: security settings are locked. */
  isDemo: boolean;
}

/**
 * Resolve the signed-in user for this request (null if anonymous).
 * Cached per request so layouts, pages and actions share one lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name ?? null,
    image: u.image ?? null,
    roles: u.roles,
    mfaEnabled: u.mfaEnabled,
    mfaVerified: u.mfaVerified,
    sessionId: u.sessionId,
    isDemo: u.isDemo,
  };
});

/**
 * For pages/layouts: redirects to /login when anonymous and to /mfa when the
 * account has MFA enabled but this session has not completed the step-up.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mfaEnabled && !user.mfaVerified) redirect("/mfa");
  return user;
}

/** Like requireUser, but also enforces a permission (throws 403 AuthorizationError). */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, permission);
  return user;
}

/**
 * For Server Actions and Route Handlers: never redirects, always throws,
 * so callers can map errors to proper responses.
 */
export async function requirePermissionStrict(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  assertCan(user, permission);
  if (user.mfaEnabled && !user.mfaVerified) {
    // MFA not completed — treat as unauthenticated for protected operations
    assertCan(null, permission);
  }
  return user;
}

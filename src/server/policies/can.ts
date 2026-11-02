import type { RoleKey } from "@/generated/prisma/enums";
import { permissionsForRoles, type Permission } from "./permissions";

/** Minimal identity passed to policy checks. Built from the session, never from the client. */
export interface Principal {
  id: string;
  roles: readonly RoleKey[];
  mfaVerified: boolean;
}

/** Permissions that additionally require a completed MFA step-up in this session. */
const MFA_REQUIRED: ReadonlySet<Permission> = new Set<Permission>([
  "finance:write",
  "invoice:write",
  "expense:write",
  "role:assign",
  "user:manage",
  "settings:manage",
  "automation:manage",
  "agent:manage",
]);

export class AuthorizationError extends Error {
  readonly status = 403 as const;
  constructor(
    readonly permission: Permission,
    message = "You do not have permission to perform this action",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly status = 401 as const;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Pure policy decision. No I/O, fully unit-testable.
 * Returns false for an anonymous principal.
 */
export function can(principal: Principal | null | undefined, permission: Permission): boolean {
  if (!principal) return false;
  if (!permissionsForRoles(principal.roles).has(permission)) return false;
  if (MFA_REQUIRED.has(permission) && !principal.mfaVerified) return false;
  return true;
}

/** Throws AuthenticationError (401) or AuthorizationError (403). */
export function assertCan(principal: Principal | null | undefined, permission: Permission): asserts principal is Principal {
  if (!principal) throw new AuthenticationError();
  if (!can(principal, permission)) throw new AuthorizationError(permission);
}

export function requiresMfa(permission: Permission): boolean {
  return MFA_REQUIRED.has(permission);
}

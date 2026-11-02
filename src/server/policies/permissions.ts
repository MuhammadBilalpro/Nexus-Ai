import { RoleKey } from "@/generated/prisma/enums";

/**
 * Permission vocabulary: "<resource>:<action>".
 * Keep this list exhaustive — services and agent tool middleware
 * both authorise against it. Adding a feature means adding permissions here.
 */
export const PERMISSIONS = [
  // Dashboard
  "dashboard:view",
  "dashboard:view_financials",
  // Projects
  "project:read",
  "project:create",
  "project:update",
  "project:delete",
  "project:assign",
  // Tasks
  "task:read",
  "task:create",
  "task:update",
  "task:delete",
  // Finance
  "finance:read",
  "finance:write",
  "invoice:read",
  "invoice:write",
  "expense:read",
  "expense:write",
  // Team
  "team:read",
  "team:manage",
  "role:assign",
  // Clients
  "client:read",
  "client:write",
  // Approvals & automation (Phase 4 uses these)
  "approval:read",
  "approval:decide",
  "automation:read",
  "automation:manage",
  // Agents (Phase 3)
  "agent:use",
  "agent:manage",
  // Platform
  "audit:read",
  "settings:manage",
  "user:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const READ_ONLY_BUSINESS: readonly Permission[] = [
  "dashboard:view",
  "project:read",
  "task:read",
  "team:read",
  "client:read",
  "approval:read",
  "automation:read",
];

/**
 * Role → permissions. CEO is deliberately not a Super Admin:
 * executives see everything but platform/user administration stays separate.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  [RoleKey.SUPER_ADMIN]: ALL,
  [RoleKey.CEO]: ALL.filter((p) => p !== "user:manage" && p !== "settings:manage"),
  [RoleKey.PROJECT_MANAGER]: [
    ...READ_ONLY_BUSINESS,
    "project:create",
    "project:update",
    "project:assign",
    "task:create",
    "task:update",
    "task:delete",
    "client:write",
    "approval:decide",
    "agent:use",
  ],
  [RoleKey.FINANCE_MANAGER]: [
    ...READ_ONLY_BUSINESS,
    "dashboard:view_financials",
    "finance:read",
    "finance:write",
    "invoice:read",
    "invoice:write",
    "expense:read",
    "expense:write",
    "agent:use",
  ],
  [RoleKey.DEVELOPER]: [...READ_ONLY_BUSINESS, "task:update", "agent:use"],
  [RoleKey.QA_ENGINEER]: [...READ_ONLY_BUSINESS, "task:create", "task:update", "agent:use"],
  [RoleKey.VIEWER]: READ_ONLY_BUSINESS,
};

export function permissionsForRoles(roles: readonly RoleKey[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return set;
}

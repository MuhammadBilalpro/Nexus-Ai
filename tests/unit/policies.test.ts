import { describe, it, expect } from "vitest";
import { can, assertCan, AuthorizationError, AuthenticationError, PERMISSIONS, ROLE_PERMISSIONS, permissionsForRoles, type Principal } from "@/server/policies";
import { RoleKey } from "@/generated/prisma/enums";

const principal = (roles: RoleKey[], mfaVerified = true): Principal => ({ id: "u1", roles, mfaVerified });

describe("RBAC policy", () => {
  it("denies everything to anonymous principals", () => {
    for (const p of PERMISSIONS) expect(can(null, p)).toBe(false);
  });

  it("grants Super Admin every permission", () => {
    for (const p of PERMISSIONS) expect(can(principal([RoleKey.SUPER_ADMIN]), p)).toBe(true);
  });

  it("keeps platform administration away from the CEO", () => {
    const ceo = principal([RoleKey.CEO]);
    expect(can(ceo, "dashboard:view_financials")).toBe(true);
    expect(can(ceo, "approval:decide")).toBe(true);
    expect(can(ceo, "user:manage")).toBe(false);
    expect(can(ceo, "settings:manage")).toBe(false);
  });

  it("prevents developers and viewers from seeing financials or writing finance", () => {
    for (const role of [RoleKey.DEVELOPER, RoleKey.VIEWER, RoleKey.QA_ENGINEER, RoleKey.PROJECT_MANAGER]) {
      expect(can(principal([role]), "dashboard:view_financials")).toBe(false);
      expect(can(principal([role]), "finance:write")).toBe(false);
      expect(can(principal([role]), "invoice:read")).toBe(false);
    }
  });

  it("lets viewers read but never write", () => {
    const viewer = principal([RoleKey.VIEWER]);
    expect(can(viewer, "project:read")).toBe(true);
    expect(can(viewer, "project:create")).toBe(false);
    expect(can(viewer, "task:update")).toBe(false);
    expect(can(viewer, "agent:use")).toBe(false);
  });

  it("unions permissions across multiple roles", () => {
    const both = principal([RoleKey.DEVELOPER, RoleKey.FINANCE_MANAGER]);
    expect(can(both, "task:update")).toBe(true);
    expect(can(both, "invoice:write")).toBe(true);
  });

  it("requires MFA step-up for sensitive permissions", () => {
    const admin = principal([RoleKey.SUPER_ADMIN], false);
    expect(can(admin, "dashboard:view")).toBe(true);
    expect(can(admin, "finance:write")).toBe(false);
    expect(can(admin, "user:manage")).toBe(false);
    expect(can(principal([RoleKey.SUPER_ADMIN], true), "user:manage")).toBe(true);
  });

  it("assertCan throws typed errors", () => {
    expect(() => assertCan(null, "dashboard:view")).toThrow(AuthenticationError);
    expect(() => assertCan(principal([RoleKey.VIEWER]), "project:create")).toThrow(AuthorizationError);
    expect(() => assertCan(principal([RoleKey.CEO]), "project:create")).not.toThrow();
  });

  it("every role maps only to known permissions", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const perms of Object.values(ROLE_PERMISSIONS)) for (const p of perms) expect(known.has(p)).toBe(true);
    expect(permissionsForRoles([]).size).toBe(0);
  });
});

import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export type AuditOutcome = "success" | "denied" | "failure";

export interface AuditEvent {
  actorId?: string | null;
  action: string; // e.g. auth.login, project.update, agent.tool_call
  resourceType: string; // e.g. user, project, invoice
  resourceId?: string | null;
  outcome?: AuditOutcome;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append an audit record. The table is immutable at the database level.
 * Failures to audit are logged but never break the business operation —
 * except for `recordOrThrow`, used where auditing is mandatory.
 */
export async function record(event: AuditEvent): Promise<void> {
  try {
    await recordOrThrow(event);
  } catch (err) {
    console.error("[audit] failed to write audit record", { action: event.action, err });
  }
}

export async function recordOrThrow(event: AuditEvent): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: event.actorId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      outcome: event.outcome ?? "success",
      metadata: event.metadata,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent?.slice(0, 512) ?? null,
    },
  });
}

export const audit = { record, recordOrThrow };

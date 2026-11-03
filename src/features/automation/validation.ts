import { StepKind } from "@/generated/prisma/enums";
import { findBlock, integrationLabel, isConnected } from "./catalog";

/** Minimal step shape shared by DB rows and the UI view model. */
export interface StepLike {
  order: number;
  kind: StepKind;
  type: string;
  label: string;
}

export type ValidationLevel = "error" | "warning";

export interface ValidationItem {
  level: ValidationLevel;
  message: string;
  /** Step order the item refers to, if any. */
  stepOrder?: number;
}

export interface ValidationResult {
  items: ValidationItem[];
  /** True when there are no errors (warnings allowed). */
  ok: boolean;
  requiresHumanApproval: boolean;
  /** Orders of steps whose integration is not connected; the run would pause there. */
  pausesAt: number[];
}

/**
 * Pure chain validation used by the builder panel and the dry run.
 * Rules: starts with a TRIGGER, ends with an ACTION, exactly one trigger,
 * every type is in the catalog, disconnected integrations are flagged.
 */
export function validateChain(steps: readonly StepLike[]): ValidationResult {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const items: ValidationItem[] = [];
  const pausesAt: number[] = [];
  let requiresHumanApproval = false;

  if (sorted.length === 0) {
    items.push({ level: "error", message: "Add a trigger to start the workflow." });
  } else {
    if (sorted[0].kind !== StepKind.TRIGGER) items.push({ level: "error", message: "The first step must be a trigger.", stepOrder: sorted[0].order });
    const last = sorted[sorted.length - 1];
    if (last.kind !== StepKind.ACTION) items.push({ level: "error", message: "The last step must be an action.", stepOrder: last.order });
    const triggers = sorted.filter((s) => s.kind === StepKind.TRIGGER);
    if (triggers.length > 1) items.push({ level: "error", message: "Only one trigger is allowed per workflow.", stepOrder: triggers[1].order });
  }

  for (const s of sorted) {
    const block = findBlock(s.type);
    if (!block) {
      items.push({ level: "error", message: `"${s.label}" uses an unknown block (${s.type}).`, stepOrder: s.order });
      continue;
    }
    if (block.kind !== s.kind) items.push({ level: "error", message: `"${s.label}" is stored as ${s.kind.toLowerCase()} but the block is a ${block.kind.toLowerCase()}.`, stepOrder: s.order });
    if (block.requiresHumanApproval) requiresHumanApproval = true;
    if (!isConnected(block)) {
      pausesAt.push(s.order);
      items.push({ level: "warning", message: `${integrationLabel(block)} is not connected — the run will pause at "${block.label}".`, stepOrder: s.order });
    }
  }

  return { items, ok: items.every((i) => i.level !== "error"), requiresHumanApproval, pausesAt };
}

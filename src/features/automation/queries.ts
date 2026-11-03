import "server-only";
import { cache } from "react";
import { subDays } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import type { StepKind } from "@/generated/prisma/enums";
import { formatRelative } from "@/lib/format";
import { asConfig, findBlock, isConnected, summarizeConfig, type StepConfig } from "./catalog";
import { validateChain, type ValidationResult } from "./validation";

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

export type RunStatus = "succeeded" | "failed" | "awaiting_approval";

export interface StepView {
  id: string;
  order: number;
  kind: StepKind;
  type: string;
  label: string;
  config: StepConfig;
  /** Pre-computed on the server from the catalog. */
  configSummary: string | null;
  connected: boolean;
  known: boolean;
}

export interface RunView {
  id: string;
  status: RunStatus;
  summary: string;
  startedAtLabel: string;
  startedAtIso: string;
  durationMs: number | null;
}

export interface WorkflowListRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  steps: Pick<StepView, "id" | "kind" | "type" | "label" | "connected">[];
  runCount: number;
  lastRun: { status: RunStatus; label: string } | null;
}

export interface AutomationStats {
  enabled: number;
  total: number;
  runsLast7Days: number;
  awaitingApproval: number;
  failed: number;
}

export interface WorkflowDetail {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  isDemo: boolean;
  updatedAtLabel: string;
  steps: StepView[];
  runs: RunView[];
  validation: ValidationResult;
}

const toStatus = (s: string): RunStatus => (s === "failed" || s === "awaiting_approval" ? s : "succeeded");

function toStepView(s: { id: string; order: number; kind: StepKind; type: string; label: string; config: unknown }): StepView {
  const block = findBlock(s.type);
  const config = asConfig(s.config);
  return { id: s.id, order: s.order, kind: s.kind, type: s.type, label: s.label, config, configSummary: summarizeConfig(block, config), connected: isConnected(block), known: Boolean(block) };
}

export const getAutomationStats = cache(async (): Promise<AutomationStats> => {
  const demo = demoFilter();
  const since = subDays(new Date(), 7);
  const [total, enabled, runsLast7Days, awaitingApproval, failed] = await Promise.all([
    db.workflow.count({ where: demo }),
    db.workflow.count({ where: { ...demo, enabled: true } }),
    db.workflowRun.count({ where: { ...demo, startedAt: { gte: since } } }),
    db.workflowRun.count({ where: { ...demo, status: "awaiting_approval" } }),
    db.workflowRun.count({ where: { ...demo, status: "failed", startedAt: { gte: since } } }),
  ]);
  return { total, enabled, runsLast7Days, awaitingApproval, failed };
});

export const listWorkflows = cache(async (): Promise<WorkflowListRow[]> => {
  const rows = await db.workflow.findMany({
    where: demoFilter(),
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
    include: {
      steps: { orderBy: { order: "asc" }, select: { id: true, order: true, kind: true, type: true, label: true, config: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true, startedAt: true } },
      _count: { select: { runs: true } },
    },
  });
  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    enabled: w.enabled,
    steps: w.steps.map((s) => {
      const v = toStepView(s);
      return { id: v.id, kind: v.kind, type: v.type, label: v.label, connected: v.connected };
    }),
    runCount: w._count.runs,
    lastRun: w.runs[0] ? { status: toStatus(w.runs[0].status), label: formatRelative(w.runs[0].startedAt) } : null,
  }));
});

export const getWorkflow = cache(async (id: string): Promise<WorkflowDetail | null> => {
  const w = await db.workflow.findFirst({
    where: { id, ...demoFilter() },
    include: {
      steps: { orderBy: { order: "asc" } },
      runs: { orderBy: { startedAt: "desc" }, take: 25 },
    },
  });
  if (!w) return null;
  const steps = w.steps.map(toStepView);
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    enabled: w.enabled,
    isDemo: w.isDemo,
    updatedAtLabel: formatRelative(w.updatedAt),
    steps,
    runs: w.runs.map((r) => ({ id: r.id, status: toStatus(r.status), summary: r.summary, startedAtLabel: formatRelative(r.startedAt), startedAtIso: r.startedAt.toISOString(), durationMs: r.durationMs })),
    validation: validateChain(steps),
  };
});

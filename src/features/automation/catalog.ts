import { AgentKey, ProjectCategory, ProjectStatus, StepKind } from "@/generated/prisma/enums";

/**
 * The block catalog: the only source of truth for what can be placed in a
 * workflow. Safe to import from client components (no server imports).
 *
 * Integrations that are not connected are declared via `requires`; the UI must
 * show them as "Not connected" and never present them as functional.
 */
export type Integration = "github" | "email";

/** Connection state of external integrations. Nothing is wired up yet. */
export const INTEGRATIONS: Record<Integration, { label: string; connected: boolean }> = {
  github: { label: "GitHub", connected: false },
  email: { label: "Email", connected: false },
};

export type ConfigInput = "number" | "select" | "text";

export interface ConfigField {
  key: string;
  label: string;
  input: ConfigInput;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Appended after the value in summaries, e.g. "days", "%". */
  unit?: string;
  min?: number;
  max?: number;
}

export interface Block {
  type: string;
  label: string;
  description: string;
  kind: StepKind;
  configFields?: ConfigField[];
  /** External integration this block depends on. */
  requires?: Integration;
  /** AGENT blocks map to a specialised agent. */
  agentKey?: AgentKey;
  /** ACTION blocks that always hand off to a human before anything is sent. */
  requiresHumanApproval?: boolean;
}

const humanize = (k: string) => k.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: humanize(v) }));

export const CATALOG: readonly Block[] = [
  // ── Triggers ─────────────────────────────────────────────
  { kind: StepKind.TRIGGER, type: "project.deadline_approaching", label: "Project deadline approaching", description: "Fires once a project is within N days of its deadline.", configFields: [{ key: "days", label: "Days before deadline", input: "number", unit: "days", min: 1, max: 90 }] },
  { kind: StepKind.TRIGGER, type: "task.overdue", label: "Task becomes overdue", description: "Fires when a task passes its due date without being completed." },
  { kind: StepKind.TRIGGER, type: "approval.pending_days", label: "Approval pending too long", description: "Fires when a client approval has waited more than N days.", configFields: [{ key: "days", label: "Days pending", input: "number", unit: "days", min: 1, max: 60 }] },
  { kind: StepKind.TRIGGER, type: "project.budget_threshold", label: "Budget threshold reached", description: "Fires when recorded expenses exceed a percentage of the project budget.", configFields: [{ key: "percent", label: "Percent of budget", input: "number", unit: "%", min: 1, max: 200 }] },
  { kind: StepKind.TRIGGER, type: "invoice.overdue", label: "Invoice overdue", description: "Fires when a sent invoice passes its due date unpaid." },
  { kind: StepKind.TRIGGER, type: "github.pull_request_opened", label: "Pull request opened", description: "Fires when a pull request is opened on a connected repository.", requires: "github" },
  { kind: StepKind.TRIGGER, type: "schedule.daily", label: "Every day at a set time", description: "Runs on a daily schedule.", configFields: [{ key: "time", label: "Time (24h)", input: "text", placeholder: "09:00" }] },

  // ── Conditions ───────────────────────────────────────────
  { kind: StepKind.CONDITION, type: "project.status_is", label: "Project status is", description: "Continue only when the related project has this status.", configFields: [{ key: "status", label: "Status", input: "select", options: enumOptions(Object.values(ProjectStatus)) }] },
  { kind: StepKind.CONDITION, type: "project.category_is", label: "Project category is", description: "Continue only for projects in this category.", configFields: [{ key: "category", label: "Category", input: "select", options: enumOptions(Object.values(ProjectCategory)) }] },
  { kind: StepKind.CONDITION, type: "amount.greater_than", label: "Amount greater than", description: "Continue only when the related amount exceeds a value.", configFields: [{ key: "amount", label: "Amount (USD)", input: "number", min: 0 }] },
  { kind: StepKind.CONDITION, type: "client.is", label: "Client is", description: "Continue only for a specific client.", configFields: [{ key: "client", label: "Client name", input: "text", placeholder: "Helios Fintech" }] },

  // ── AI agents ────────────────────────────────────────────
  { kind: StepKind.AGENT, type: "agent.executive", label: "Executive Intelligence agent", description: "Produces a company-level summary of the situation for leadership.", agentKey: AgentKey.EXECUTIVE },
  { kind: StepKind.AGENT, type: "agent.project_manager", label: "Project Manager agent", description: "Assesses delivery readiness, open tasks and risks on the project.", agentKey: AgentKey.PROJECT_MANAGER },
  { kind: StepKind.AGENT, type: "agent.finance", label: "Finance agent", description: "Explains financial variance and proposes reminders or adjustments.", agentKey: AgentKey.FINANCE },
  { kind: StepKind.AGENT, type: "agent.game_qa", label: "Game QA agent", description: "Reviews build quality signals and outstanding defects.", agentKey: AgentKey.GAME_QA },
  { kind: StepKind.AGENT, type: "agent.development", label: "Development agent", description: "Summarises engineering activity and blockers.", agentKey: AgentKey.DEVELOPMENT },
  { kind: StepKind.AGENT, type: "agent.client_business", label: "Client & Business agent", description: "Drafts client communication and tracks account health.", agentKey: AgentKey.CLIENT_BUSINESS },

  // ── Actions ──────────────────────────────────────────────
  { kind: StepKind.ACTION, type: "notify.project_manager", label: "Notify project manager", description: "Sends an in-app notification to the project's manager." },
  { kind: StepKind.ACTION, type: "notify.ceo", label: "Notify CEO", description: "Sends an in-app notification to the CEO." },
  { kind: StepKind.ACTION, type: "notify.finance", label: "Notify finance", description: "Sends an in-app notification to the finance department." },
  { kind: StepKind.ACTION, type: "task.flag", label: "Flag task for review", description: "Marks the task and adds it to the review queue." },
  { kind: StepKind.ACTION, type: "activity.record", label: "Record project activity", description: "Adds an entry to the project timeline." },
  { kind: StepKind.ACTION, type: "approval.request_human", label: "Request human approval", description: "Pauses the workflow until a person approves the proposed action.", requiresHumanApproval: true },
  { kind: StepKind.ACTION, type: "draft.email", label: "Draft email", description: "Prepares an email draft for review in the connected mailbox.", requires: "email" },
];

const BY_TYPE = new Map(CATALOG.map((b) => [b.type, b]));

export function findBlock(type: string): Block | undefined {
  return BY_TYPE.get(type);
}

export const KIND_ORDER: readonly StepKind[] = [StepKind.TRIGGER, StepKind.CONDITION, StepKind.AGENT, StepKind.ACTION];

export const KIND_LABEL: Record<StepKind, string> = {
  TRIGGER: "Trigger",
  CONDITION: "Condition",
  AGENT: "AI agent",
  ACTION: "Action",
};

export function blocksByKind(kind: StepKind): Block[] {
  return CATALOG.filter((b) => b.kind === kind);
}

/** Whether a block can run today. Unknown types (legacy data) count as unavailable. */
export function isConnected(block: Block | undefined): boolean {
  if (!block) return false;
  if (!block.requires) return true;
  return INTEGRATIONS[block.requires].connected;
}

export function integrationLabel(block: Block | undefined): string | null {
  return block?.requires ? INTEGRATIONS[block.requires].label : null;
}

export type StepConfig = Record<string, string | number | null | undefined>;

export function asConfig(value: unknown): StepConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: StepConfig = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number" || v === null) out[k] = v;
  }
  return out;
}

/** Short, human-readable summary of a step's configuration ("7 days · Status: Active"). */
export function summarizeConfig(block: Block | undefined, config: StepConfig): string | null {
  if (!block?.configFields?.length) return null;
  const parts: string[] = [];
  for (const f of block.configFields) {
    const v = config[f.key];
    if (v === undefined || v === null || v === "") continue;
    if (f.input === "select") {
      const opt = f.options?.find((o) => o.value === String(v));
      parts.push(`${f.label}: ${opt?.label ?? String(v)}`);
    } else if (f.unit) {
      parts.push(f.unit === "%" ? `${v}%` : `${v} ${f.unit}`);
    } else {
      parts.push(`${f.label}: ${v}`);
    }
  }
  return parts.length ? parts.join(" · ") : "Not configured";
}

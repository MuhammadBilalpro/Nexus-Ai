import type { AgentKey } from "@/generated/prisma/enums";

/** Human meaning of each tool-permission string an agent can hold. Unknown strings are shown as-is. */
export const PERMISSION_MEANINGS: Record<string, string> = {
  "read:projects": "Read projects, tasks and milestones",
  "read:finance": "Read invoices, expenses and budgets",
  "read:team": "Read team members and their workload",
  "read:clients": "Read client records and approvals",
  "read:qa": "Read QA reports and bug records",
  "read:github": "Read repositories and pull requests (requires a GitHub connection)",
  "propose:action": "Propose actions that wait for your approval",
  "propose:followup": "Draft follow-ups for client approvals",
  "propose:invoice_followup": "Propose payment reminders for overdue invoices",
  "propose:task_assignment": "Propose moving tasks between people",
  "draft:proposal": "Draft commercial proposals for review",
};

/** Hard operational boundary per agent. These are statements of what the agent can never do. */
export const AGENT_BOUNDARIES: Record<AgentKey, string[]> = {
  EXECUTIVE: ["Read-only across the company", "Never modifies financial or project records", "Every recommendation cites the records it was derived from"],
  PROJECT_MANAGER: ["Cannot change deadlines, budgets or scope", "Task reassignments are proposals until a human approves them", "Never contacts clients"],
  FINANCE: ["Never modifies financial records", "Cannot issue, void or mark invoices as paid", "Payment reminders are drafted, never sent without approval"],
  GAME_QA: ["Read-only over build and bug records", "Cannot close, reprioritise or assign bugs", "Cannot trigger builds or deployments"],
  DEVELOPMENT: ["Cannot modify or deploy code", "Cannot merge, close or comment on pull requests", "Requires a GitHub connection, which is not configured"],
  CLIENT_BUSINESS: ["Never sends messages to clients directly", "Cannot change contract terms or pricing", "Proposals and reminders are drafts for human review"],
};

/** External dependencies, shown honestly. Only the Development agent has one today. */
export const AGENT_INTEGRATIONS: Partial<Record<AgentKey, { name: string; connected: boolean; note: string }[]>> = {
  DEVELOPMENT: [{ name: "GitHub", connected: false, note: "Repository and pull-request visibility is unavailable until an administrator connects GitHub." }],
};

export const RISK_TONE = { low: "neutral", medium: "warning", high: "danger" } as const;

export function riskTone(risk: string): "neutral" | "warning" | "danger" {
  return RISK_TONE[risk as keyof typeof RISK_TONE] ?? "neutral";
}

export const TRIGGER_LABEL: Record<string, string> = { assistant: "Assistant", schedule: "Scheduled", workflow: "Workflow" };

export function triggerLabel(trigger: string): string {
  const base = trigger.split(":")[0] ?? trigger;
  return TRIGGER_LABEL[base] ?? trigger;
}

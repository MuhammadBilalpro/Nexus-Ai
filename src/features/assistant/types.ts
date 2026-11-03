import type { AgentKey, ActionStatus } from "@/generated/prisma/enums";

/**
 * Shape of the structured answer stored in Message.structured and rendered by
 * the assistant UI. Everything here is derived from database records by the
 * deterministic engine in src/server/assistant/engine.ts — no narration layer
 * exists yet, so the UI must present it honestly as a records-based answer.
 */
export type Intent = "status" | "delayed" | "profit" | "revenue" | "pending_payments" | "workload" | "report" | "fallback" | "forbidden";

export interface Fact {
  label: string;
  value: string;
  href?: string;
}

export interface SeriesPointDTO {
  label: string;
  value: number;
}

export interface AnswerSeries {
  type: "bars" | "area";
  data: SeriesPointDTO[];
  dataKey: "value";
  name: string;
  money: boolean;
}

export type ActionRisk = "low" | "medium" | "high";

/** A proposal the engine wants to persist. The id is attached once it is stored. */
export interface ProposedActionDraft {
  kind: string;
  title: string;
  rationale: string;
  risk: ActionRisk;
  payload: Record<string, string | number | boolean | null>;
}

export interface ProposedActionRef extends ProposedActionDraft {
  id: string;
  status: ActionStatus;
}

export interface StructuredAnswer {
  intent: Intent;
  agentKey: AgentKey;
  agentName: string;
  summary: string;
  facts: Fact[];
  series?: AnswerSeries;
  sources: string[];
  proposedActions?: ProposedActionRef[];
  followUps: string[];
  /** ISO timestamp of when the engine ran. */
  answeredAt: string;
}

export interface MessageDTO {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  structured: StructuredAnswer | null;
  createdAt: string;
}

export interface ConversationSummaryDTO {
  id: string;
  title: string;
  agentKey: AgentKey | null;
  updatedAt: string;
  /** Pre-formatted on the server so client components never call Date.now(). */
  updatedLabel: string;
}

export interface ConversationDTO extends ConversationSummaryDTO {
  messages: MessageDTO[];
}

export interface AgentOption {
  key: AgentKey;
  name: string;
  purpose: string;
}

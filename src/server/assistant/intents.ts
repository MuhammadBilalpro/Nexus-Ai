import type { Intent } from "@/features/assistant/types";
import type { AgentKey } from "@/generated/prisma/enums";

/**
 * Deterministic intent router. Pure: lower-cases the question, scores each
 * intent by keyword hits and returns the best match. No model, no network.
 *
 * Order matters only for ties; the first rule listed wins a tie, so the
 * broader "report" intent is placed after the specific finance intents.
 */
const RULES: { intent: Intent; keywords: string[]; weight?: number }[] = [
  { intent: "pending_payments", keywords: ["pending payment", "pending payments", "outstanding", "overdue invoice", "overdue invoices", "owe", "owes", "unpaid", "receivable", "collect", "late payment", "who hasn't paid", "pay us"] },
  { intent: "profit", keywords: ["profit", "profitable", "margin", "most money", "highest earning", "best performing project"] },
  { intent: "revenue", keywords: ["revenue", "total revenue", "income", "sales", "earned", "billed", "how much did we make", "how much have we made"] },
  { intent: "workload", keywords: ["overloaded", "overload", "workload", "capacity", "busy", "too many tasks", "bandwidth", "burnout", "who is free", "available team"] },
  { intent: "delayed", keywords: ["delayed", "delay", "late", "behind", "blocking", "blocked", "slipping", "off track", "past deadline", "missed deadline", "at risk", "stuck"] },
  { intent: "report", keywords: ["report", "performance", "summary of the company", "full picture", "complete", "briefing"] },
  { intent: "status", keywords: ["what is happening", "what's happening", "today", "overview", "attention", "status", "going on", "how are we doing", "health", "priorities", "focus on"] },
];

export function routeIntent(question: string): Intent {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  if (!q) return "fallback";
  let best: { intent: Intent; score: number } = { intent: "fallback", score: 0 };
  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (q.includes(kw)) score += kw.includes(" ") ? 2 : 1; // phrases are stronger signals than single words
    }
    if (score > best.score) best = { intent: rule.intent, score };
  }
  return best.intent;
}

/** Which agent naturally owns each intent. The caller may override with an explicit selection. */
export const INTENT_AGENT: Record<Intent, AgentKey> = {
  status: "EXECUTIVE",
  report: "EXECUTIVE",
  delayed: "PROJECT_MANAGER",
  workload: "PROJECT_MANAGER",
  profit: "FINANCE",
  revenue: "FINANCE",
  pending_payments: "FINANCE",
  fallback: "EXECUTIVE",
  forbidden: "EXECUTIVE",
};

/** Intents whose answers expose money figures and therefore need the financial permission. */
export const FINANCIAL_INTENTS: ReadonlySet<Intent> = new Set<Intent>(["profit", "revenue", "pending_payments"]);

/**
 * Try to find the project the question refers to. Matches on the longest
 * project name (or slug) contained in the question, requiring at least one
 * distinctive word of 4+ characters so "app" alone never matches.
 */
export function findProjectMention(question: string, projects: { id: string; name: string; slug: string }[]): { id: string; name: string; slug: string } | null {
  const q = question.toLowerCase();
  let best: { project: (typeof projects)[number]; len: number } | null = null;
  for (const p of projects) {
    const name = p.name.toLowerCase();
    const slug = p.slug.toLowerCase();
    const candidates = [name, slug, ...name.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERIC.has(w))];
    for (const c of candidates) {
      if (c && q.includes(c) && (!best || c.length > best.len)) best = { project: p, len: c.length };
    }
  }
  return best?.project ?? null;
}

const GENERIC = new Set(["project", "platform", "service", "system", "mobile", "application", "internal", "design", "open", "world", "collection"]);

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { SUGGESTED_QUESTIONS } from "@/components/dashboard/command-palette";
import { askAction, deleteConversationAction } from "../actions";
import { AssistantAnswer } from "./answer";
import type { AgentOption, ConversationDTO, ConversationSummaryDTO } from "../types";
import type { AgentKey } from "@/generated/prisma/enums";

interface Props {
  conversations: ConversationSummaryDTO[];
  active: ConversationDTO | null;
  agents: AgentOption[];
  /** Question arriving via /assistant?q=… — submitted once on mount. */
  initialQuestion: string | null;
  initialAgent: AgentKey | null;
  canDecide: boolean;
  userName: string | null;
}

/**
 * The conversational workspace. Server data arrives as props; this component
 * owns the composer, the pending state and navigation between conversations.
 */
export function AssistantWorkspace({ conversations, active, agents, initialQuestion, initialAgent, canDecide, userName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [agentKey, setAgentKey] = useState<AgentKey | null>(initialAgent ?? active?.agentKey ?? null);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const focusInput = () => composerRef.current?.querySelector("textarea")?.focus();
  const endRef = useRef<HTMLDivElement>(null);
  const autoSubmitted = useRef(false);

  const submit = (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setOptimistic(q);
    setDraft("");
    start(async () => {
      const res = await askAction(active?.id ?? null, q, agentKey);
      if ("error" in res) {
        setError(res.error);
        setOptimistic(null);
        setDraft(q);
        return;
      }
      if (!active || res.conversationId !== active.id) router.replace(`/assistant?c=${res.conversationId}`);
      else router.refresh();
    });
  };

  // Auto-submit a question handed over from the command palette or an insight link.
  useEffect(() => {
    if (initialQuestion && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  // The optimistic echo is only shown while the transition is pending: once the
  // navigation/refresh settles, the server data already holds the message.
  const lastMessageId = active?.messages[active.messages.length - 1]?.id ?? null;
  const echo = pending ? optimistic : null;
  useEffect(() => {
    if (!pending) focusInput();
  }, [pending, lastMessageId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId, echo]);

  const messages = active?.messages ?? [];
  const showHero = messages.length === 0 && !echo;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Conversation list — sidebar on lg, select below */}
      <aside className="lg:w-60 lg:shrink-0" aria-label="Conversations">
        <div className="hidden lg:block">
          <Link href="/assistant" className="block">
            <Button variant="secondary" size="sm" className="w-full justify-start" tabIndex={-1}><Plus className="h-3.5 w-3.5" aria-hidden /> New conversation</Button>
          </Link>
          {conversations.length === 0 ? (
            <p className="mt-4 px-1 text-xs text-fg-subtle">Your conversations will appear here.</p>
          ) : (
            <ul className="mt-3 space-y-0.5">
              {conversations.map((c) => {
                const current = c.id === active?.id;
                return (
                  <li key={c.id} className="group relative">
                    <Link href={`/assistant?c=${c.id}`} aria-current={current ? "page" : undefined} className={cn("block rounded-md px-2.5 py-2 pr-8 transition-colors", current ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2/60 hover:text-fg")}>
                      <span className="block truncate text-[13px]">{c.title}</span>
                      <span className="block text-[11px] text-fg-subtle">{c.updatedLabel}</span>
                    </Link>
                    <DeleteButton id={c.id} title={c.title} onDeleted={() => (current ? router.replace("/assistant") : router.refresh())} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex gap-2 lg:hidden">
          <Select aria-label="Conversation" value={active?.id ?? ""} onChange={(e) => router.push(e.target.value ? `/assistant?c=${e.target.value}` : "/assistant")} className="flex-1">
            <option value="">New conversation</option>
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </div>
      </aside>

      {/* Centre */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <div className="flex-1">
          {showHero ? (
            <Hero userName={userName} suggestions={SUGGESTED_QUESTIONS} onPick={submit} pending={pending} />
          ) : (
            <ol className="space-y-8 pb-6">
              {messages.map((m) =>
                m.role === "USER" ? (
                  <li key={m.id} className="flex justify-end">
                    <p className="max-w-[80%] rounded-lg rounded-br-sm border border-line bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-fg">{m.content}</p>
                  </li>
                ) : (
                  <li key={m.id}>{m.structured ? <AssistantAnswer answer={m.structured} canDecide={canDecide} onFollowUp={submit} animate={m.id === lastMessageId} /> : <p className="text-[14px] text-fg">{m.content}</p>}</li>
                ),
              )}
              {echo && (
                <li className="flex justify-end animate-fade-up">
                  <p className="max-w-[80%] rounded-lg rounded-br-sm border border-line bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-fg">{echo}</p>
                </li>
              )}
              {pending && <Thinking />}
              <div ref={endRef} />
            </ol>
          )}
        </div>

        {/* Composer */}
        <div ref={composerRef} className="sticky bottom-0 -mx-1 mt-auto bg-bg px-1 pb-1 pt-3">
          {error && <p role="alert" className="mb-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
          <form
            className="surface p-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <label htmlFor="assistant-question" className="sr-only">Ask a question about the company</label>
            <Textarea
              id="assistant-question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={showHero ? "Ask anything about projects, finance, team or clients…" : "Ask a follow-up…"}
              rows={showHero ? 3 : 2}
              autoFocus
              disabled={pending}
              maxLength={600}
              className="min-h-0 resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] focus:ring-0"
              aria-describedby="assistant-honesty"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
              <div role="radiogroup" aria-label="Answer with agent" className="flex flex-wrap items-center gap-1">
                <AgentChip label="Auto" active={agentKey === null} onClick={() => setAgentKey(null)} />
                {agents.map((a) => (
                  <AgentChip key={a.key} label={a.name} title={a.purpose} active={agentKey === a.key} onClick={() => setAgentKey(a.key)} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] text-fg-subtle sm:inline-flex sm:items-center sm:gap-1"><Kbd>↵</Kbd> send · <Kbd>⇧↵</Kbd> newline</span>
                <Button type="submit" size="icon" variant="primary" loading={pending} disabled={!draft.trim()} aria-label="Send question">
                  {!pending && <ArrowUp className="h-4 w-4" aria-hidden />}
                </Button>
              </div>
            </div>
          </form>
          <p id="assistant-honesty" className="mt-2 text-center text-[11px] text-fg-subtle">Deterministic answer engine · every figure comes from company records · LLM narration arrives in Phase 3</p>
        </div>
      </section>
    </div>
  );
}

function AgentChip({ label, title, active, onClick }: { label: string; title?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={active} title={title} onClick={onClick} className={cn("h-7 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg")}>
      {label}
    </button>
  );
}

function Hero({ userName, suggestions, onPick, pending }: { userName: string | null; suggestions: string[]; onPick: (q: string) => void; pending: boolean }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col justify-center pt-10 lg:pt-20">
      <div className="flex items-center gap-2 text-xs text-fg-subtle">
        <span className="ai-dot" aria-hidden /> NEXUS Assistant
      </div>
      <h1 className="mt-3 text-[26px] font-semibold tracking-tight text-fg">{userName ? `What would you like to know, ${userName.split(" ")[0]}?` : "What would you like to know?"}</h1>
      <p className="mt-1.5 text-[15px] text-fg-muted">Ask in plain language. Answers are built from your projects, invoices, tasks and clients, with every fact linked to its record.</p>
      <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Suggested questions">
        {suggestions.map((q, i) => (
          <li key={q} className="animate-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
            <button type="button" disabled={pending} onClick={() => onPick(q)} className="group flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-left text-[13px] text-fg-muted transition-[border-color,color] hover:border-line-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span>{q}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thinking() {
  return (
    <li className="max-w-3xl animate-fade-in" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-xs">
        <span className="ai-dot" aria-hidden />
        <span className="text-fg-muted">Thinking…</span>
        <span className="sr-only">Querying company records</span>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-[85%]" />
        <Skeleton className="h-3.5 w-[70%]" />
        <Skeleton className="h-3.5 w-[40%]" />
      </div>
    </li>
  );
}

function DeleteButton({ id, title, onDeleted }: { id: string; title: string; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete conversation: ${title}`}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await deleteConversationAction(id);
          if ("ok" in res) onDeleted();
        });
      }}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-fg-subtle opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 disabled:opacity-50"
    >
      {pending ? <MessageSquare className="h-3.5 w-3.5 animate-pulse" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { StepKind } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { CATALOG, KIND_LABEL, KIND_ORDER, integrationLabel, isConnected, type Block } from "../catalog";
import { KIND_ICON } from "./step-visuals";

interface Props {
  /** Called with the chosen block type. */
  onPick: (type: string) => void;
  /** Kinds that make sense at this position are listed first; others still available. */
  suggestedKind?: StepKind;
  disabled?: boolean;
  label: string;
}

/**
 * Quiet "+" affordance that opens a searchable, keyboard-navigable block menu
 * grouped by kind. Arrow keys move, Enter picks, Escape closes.
 */
export function BlockPicker({ onPick, suggestedKind, disabled, label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const order = suggestedKind ? [suggestedKind, ...KIND_ORDER.filter((k) => k !== suggestedKind)] : KIND_ORDER;
    return order
      .map((kind) => ({ kind, blocks: CATALOG.filter((b) => b.kind === kind && (!q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.type.includes(q))) }))
      .filter((g) => g.blocks.length > 0);
  }, [query, suggestedKind]);
  const flat = useMemo(() => groups.flatMap((g) => g.blocks), [groups]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[id="${id}-opt-${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  const pick = (b: Block) => {
    setOpen(false);
    setQuery("");
    onPick(b.type);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const b = flat[active];
      if (b) pick(b);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative flex justify-center">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => { setOpen((o) => !o); setActive(0); }}
        className={cn("group flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-fg-subtle transition-[border-color,color,background-color] duration-150 hover:border-line-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40", open && "border-line-strong text-fg")}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>

      {open && (
        <div role="dialog" aria-label="Add a block" className="absolute left-1/2 top-8 z-30 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-line bg-surface shadow-md animate-fade-in" onKeyDown={onKeyDown}>
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-activedescendant={flat[active] ? `${id}-opt-${active}` : undefined}
              aria-autocomplete="list"
              aria-label="Search blocks"
              placeholder="Search triggers, conditions, agents, actions…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              className="h-8 pl-8 text-[13px]"
            />
          </div>
          <ul id={`${id}-list`} ref={listRef} role="listbox" aria-label="Available blocks" className="max-h-[320px] overflow-y-auto p-1.5 scrollbar-thin">
            {flat.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-fg-subtle">No blocks match &ldquo;{query}&rdquo;.</li>}
            {groups.map((g) => (
              <li key={g.kind} role="presentation">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">{KIND_LABEL[g.kind]}</p>
                <ul role="group" aria-label={KIND_LABEL[g.kind]}>
                  {g.blocks.map((b) => {
                    const i = flat.indexOf(b);
                    const Icon = KIND_ICON[b.kind];
                    const connected = isConnected(b);
                    return (
                      <li
                        key={b.type}
                        id={`${id}-opt-${i}`}
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(b)}
                        className={cn("flex cursor-pointer items-start gap-2.5 rounded-sm px-2.5 py-2 transition-colors duration-100", i === active ? "bg-surface-2" : "hover:bg-surface-2/60")}
                      >
                        <span className={cn("mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-line bg-surface", b.kind === StepKind.AGENT ? "text-accent" : "text-fg-muted")} aria-hidden>
                          <Icon className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-fg">{b.label}</span>
                            {!connected && <Badge tone="warning">{integrationLabel(b)} not connected</Badge>}
                            {b.requiresHumanApproval && <Badge tone="outline">Human approval</Badge>}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{b.description}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-fg-subtle">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> add</span>
            <span className="flex items-center gap-1"><Kbd>esc</Kbd> close</span>
          </div>
        </div>
      )}
    </div>
  );
}

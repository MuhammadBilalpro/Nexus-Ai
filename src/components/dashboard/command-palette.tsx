"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, CornerDownLeft } from "lucide-react";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-config";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

const QUESTIONS = [
  "What is happening in my company today?",
  "Which projects are delayed?",
  "Which project is generating the highest profit?",
  "What is our total revenue this month?",
  "Which clients have pending payments?",
  "Which team members are overloaded?",
  "What requires my attention today?",
  "Give me a complete company performance report",
];

interface Item {
  id: string;
  label: string;
  hint?: string;
  kind: "page" | "question";
  run: () => void;
}

/** ⌘K palette: navigate anywhere or send a question straight to the assistant. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = () => {
    setQuery("");
    setIndex(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setQuery("");
            setIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
          }
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const pages: Item[] = [...PRIMARY_NAV, ...SECONDARY_NAV].map((n) => ({ id: `page:${n.href}`, label: n.label, hint: n.description, kind: "page", run: go(n.href) }));
    const questions: Item[] = QUESTIONS.map((q) => ({ id: `q:${q}`, label: q, kind: "question", run: go(`/assistant?q=${encodeURIComponent(q)}`) }));
    const q = query.trim().toLowerCase();
    const all = [...pages, ...questions].filter((i) => !q || i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
    if (q && !all.some((i) => i.kind === "question" && i.label.toLowerCase() === q)) {
      all.push({ id: "ask", label: `Ask the assistant: “${query.trim()}”`, kind: "question", run: go(`/assistant?q=${encodeURIComponent(query.trim())}`) });
    }
    return all;
  }, [query, router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[index]?.run();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={openPalette}
        className="flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
        aria-label="Search or ask (⌘K)"
      >
        <Search className="h-3.5 w-3.5" aria-hidden />
        <span className="flex-1 text-left">Search or ask anything…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-fg/20 p-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Command palette" className="surface w-full max-w-xl overflow-hidden shadow-md animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-3.5">
              <Search className="h-4 w-4 text-fg-subtle" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Go to a page or ask a question…"
                className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
                aria-activedescendant={items[index]?.id}
                aria-controls="cmdk-list"
              />
              <Kbd>esc</Kbd>
            </div>
            <ul id="cmdk-list" role="listbox" className="max-h-[360px] overflow-y-auto p-1.5 scrollbar-thin">
              {items.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-fg-subtle">Nothing matches.</li>}
              {items.map((item, i) => (
                <li
                  key={item.id}
                  id={item.id}
                  role="option"
                  aria-selected={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={item.run}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-sm px-2.5 py-2 text-[13px]", i === index ? "bg-surface-2 text-fg" : "text-fg-muted")}
                >
                  {item.kind === "question" ? <Sparkles className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden /> : <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-medium text-fg-subtle">→</span>}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="hidden truncate text-xs text-fg-subtle sm:block">{item.hint}</span>}
                  {i === index && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export { QUESTIONS as SUGGESTED_QUESTIONS };

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-config";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  const Icon = item.icon;

  if (item.phase) {
    return (
      <li>
        <div aria-disabled="true" className="flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-subtle">
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{item.label}</span>
          <span className="ml-auto rounded-full border border-line px-1.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Phase {item.phase}</span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
          active ? "bg-glass-strong text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-fg-muted hover:bg-glass hover:text-fg",
        )}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[linear-gradient(180deg,var(--accent-blue),var(--accent-violet))]" aria-hidden />}
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-blue" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

export function SidebarContent({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--accent-blue),var(--accent-violet))] shadow-glow-blue">
          <Sparkles className="h-4 w-4 text-white" aria-hidden />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          NEXUS <span className="text-fg-muted">AI</span>
        </span>
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-fg-muted hover:bg-glass hover:text-fg lg:hidden" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Primary">
        <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Operations</p>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        <p className="px-3 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Account</p>
        <ul className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
      <div className="border-t border-line p-4">
        <p className="text-[11px] text-fg-subtle">Phase 1 · Foundation</p>
      </div>
    </div>
  );
}

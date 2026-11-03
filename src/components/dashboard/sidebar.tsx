"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-config";
import { Logo } from "./logo";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-8 items-center gap-2.5 rounded-sm px-2 text-[13px] transition-colors duration-100",
          active ? "bg-surface-3/80 font-medium text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-fg" : "text-fg-subtle group-hover:text-fg-muted")} strokeWidth={1.75} aria-hidden />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

export function SidebarContent({ onNavigate, onClose, pendingApprovals = 0 }: { onNavigate?: () => void; onClose?: () => void; pendingApprovals?: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4">
        <Logo />
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-sm p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-2 pb-4 pt-1 scrollbar-thin" aria-label="Primary">
        <ul className="space-y-px">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        <div>
          <p className="mb-1 px-2 text-[11px] font-medium text-fg-subtle">Account</p>
          <ul className="space-y-px">
            {SECONDARY_NAV.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      </nav>
      {pendingApprovals > 0 && (
        <Link href="/agents?tab=approvals" onClick={onNavigate} className="mx-3 mb-3 flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] transition-colors hover:border-line-strong">
          <span className="ai-dot" aria-hidden />
          <span className="text-fg">
            {pendingApprovals} {pendingApprovals === 1 ? "action awaits" : "actions await"} your approval
          </span>
        </Link>
      )}
    </div>
  );
}

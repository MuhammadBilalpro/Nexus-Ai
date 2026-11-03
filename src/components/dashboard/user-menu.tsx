"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { roleLabel } from "@/lib/format";
import { logoutAction } from "@/features/auth/actions/mfa";

export function UserMenu({ name, email, roles, mfaEnabled }: { name: string | null; email: string; roles: readonly string[]; mfaEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-surface-2" aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={name ?? email} size="sm" />
        <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-fg sm:block">{name ?? email}</span>
        <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="surface absolute right-0 z-50 mt-1.5 w-64 p-1.5 shadow-md animate-fade-up">
          <div className="px-2.5 pb-2.5 pt-2">
            <p className="truncate text-sm font-medium text-fg">{name ?? "—"}</p>
            <p className="truncate text-xs text-fg-muted">{email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r}>{roleLabel(r)}</Badge>
              ))}
              <Badge tone={mfaEnabled ? "success" : "warning"} dot>{mfaEnabled ? "MFA on" : "MFA off"}</Badge>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="text-[13px] text-fg-muted">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href="/settings/security" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Security settings
          </Link>
          <form action={logoutAction}>
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg">
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

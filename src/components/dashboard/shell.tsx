"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { SidebarContent } from "./sidebar";

/**
 * Application shell: a quiet fixed sidebar on desktop, a slide-over on
 * smaller screens. Topbar content is passed from the server layout so it
 * can carry session-derived data without the shell touching the server.
 */
export function DashboardShell({ topbar, children, pendingApprovals }: { topbar: React.ReactNode; children: React.ReactNode; pendingApprovals: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-line bg-bg lg:block" aria-label="Sidebar">
        <SidebarContent pendingApprovals={pendingApprovals} />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="scrim" className="fixed inset-0 z-40 bg-fg/30 backdrop-blur-[2px] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setOpen(false)} aria-hidden />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-line bg-bg shadow-md lg:hidden"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 480, damping: 40 }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <SidebarContent onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} pendingApprovals={pendingApprovals} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button onClick={() => setOpen(true)} className="-ml-1 rounded-sm p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden" aria-label="Open navigation" aria-expanded={open}>
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">{topbar}</div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

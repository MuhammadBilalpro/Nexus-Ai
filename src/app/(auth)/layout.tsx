import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-[-20%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.22),transparent)] blur-2xl" />
      </div>
      <div className="relative w-full max-w-[420px] animate-fade-up">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--accent-blue),var(--accent-violet))] shadow-glow-blue">
            <Sparkles className="h-4.5 w-4.5 text-white" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">NEXUS <span className="text-fg-muted">AI</span></span>
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-fg-subtle">Authorised personnel only. All access is logged.</p>
      </div>
    </main>
  );
}

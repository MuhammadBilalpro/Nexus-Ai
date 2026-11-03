import { FlaskConical } from "lucide-react";

/** Shown whenever DEMO_MODE is on so demo figures are never mistaken for real ones. */
export function DemoBanner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-center text-xs text-fg-muted">
      <FlaskConical className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
      <span>
        <span className="font-medium text-fg">Demonstration data.</span> Figures include labelled demo records. Set <code className="font-mono">DEMO_MODE=false</code> to show real company data only.
      </span>
    </div>
  );
}

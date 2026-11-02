import { FlaskConical } from "lucide-react";

/** Rendered whenever DEMO_MODE is on so demo figures are never mistaken for real ones. */
export function DemoBanner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-amber/30 bg-amber/10 px-4 py-1.5 text-center text-xs text-amber">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      <span>
        <strong className="font-semibold">Demonstration mode.</strong> Figures include clearly-labelled demo records. Set <code className="font-mono">DEMO_MODE=false</code> to show only real company data.
      </span>
    </div>
  );
}

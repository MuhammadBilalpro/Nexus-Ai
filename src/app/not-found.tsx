import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-xl p-8 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-fg-subtle">404</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-fg-muted">The link may be outdated, or you may not have access to this area.</p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}

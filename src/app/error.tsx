"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalRouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Client-side log only; stack traces are never rendered to the user.
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <ErrorState onRetry={retry} description={digest ? `An unexpected error occurred. Reference: ${digest}` : undefined} />
      </div>
    </main>
  );
}

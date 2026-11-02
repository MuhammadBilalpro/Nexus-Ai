import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNextPath } from "@/features/auth/schemas";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  return (
    <div className="glass-strong rounded-xl p-7">
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-fg-muted">Sign in to your company headquarters.</p>
      <div className="mt-6">
        <LoginForm next={safeNext !== "/" ? safeNext : undefined} />
      </div>
      {env.DEMO_MODE && (
        <div className="mt-5 rounded-md border border-amber/30 bg-amber/10 px-3 py-2.5 text-xs text-fg-muted">
          <p className="font-medium text-amber">Demo access</p>
          <p className="mt-1">
            Email <code className="font-mono text-fg">demo@nexus.local</code> · Password <code className="font-mono text-fg">NexusDemo-2026!</code>
          </p>
          <p className="mt-1 text-fg-subtle">Shared read-only executive account on demo data.</p>
        </div>
      )}
    </div>
  );
}

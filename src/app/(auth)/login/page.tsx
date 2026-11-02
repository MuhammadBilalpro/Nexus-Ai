import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNextPath } from "@/features/auth/schemas";

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
    </div>
  );
}

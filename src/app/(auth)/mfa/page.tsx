import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/principal";
import { MfaForm } from "@/features/auth/components/mfa-form";
import { safeNextPath } from "@/features/auth/schemas";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mfaEnabled || user.mfaVerified) redirect("/");
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  return (
    <div className="glass-strong rounded-xl p-7">
      <h1 className="text-xl font-semibold tracking-tight">Two-factor verification</h1>
      <p className="mt-1 text-sm text-fg-muted">Signed in as <span className="text-fg">{user.email}</span>. One more step to continue.</p>
      <div className="mt-6">
        <MfaForm next={safeNext !== "/" ? safeNext : undefined} />
      </div>
    </div>
  );
}

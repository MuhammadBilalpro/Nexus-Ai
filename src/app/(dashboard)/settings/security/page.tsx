import type { Metadata } from "next";
import { Monitor, LogOut } from "lucide-react";
import { requireUser } from "@/server/auth/principal";
import { listUserSessions } from "@/server/auth/session-store";
import { remainingRecoveryCodes } from "@/server/auth/mfa";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MfaEnrollment } from "@/features/auth/components/mfa-enrollment";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { revokeSessionAction, revokeOtherSessionsAction } from "@/features/auth/actions/sessions";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Security" };

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function SecurityPage() {
  const user = await requireUser();
  const [sessions, recovery] = await Promise.all([listUserSessions(user.id), remainingRecoveryCodes(user.id)]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Security" description="Protect your account with two-factor authentication and manage where you're signed in." />

      <Card as="section" aria-labelledby="mfa-heading">
        <CardHeader title={<span id="mfa-heading">Two-factor authentication</span>} description="Time-based one-time codes from an authenticator app, plus single-use recovery codes." />
        <MfaEnrollment enabled={user.mfaEnabled} recoveryRemaining={recovery} />
      </Card>

      <Card as="section" aria-labelledby="pw-heading">
        <CardHeader title={<span id="pw-heading">Password</span>} description="Changing your password signs out every other session." />
        <ChangePasswordForm />
      </Card>

      <Card as="section" aria-labelledby="sessions-heading">
        <CardHeader
          title={<span id="sessions-heading">Active sessions</span>}
          description="Devices currently signed in to your account."
          action={
            sessions.length > 1 ? (
              <form action={revokeOtherSessionsAction}>
                <Button type="submit" variant="secondary" size="sm"><LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out other sessions</Button>
              </form>
            ) : null
          }
        />
        <ul className="divide-y divide-line/60">
          {sessions.map((s) => {
            const current = s.id === user.sessionId;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-surface-2 text-fg-muted"><Monitor className="h-4 w-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
                    {describeAgent(s.userAgent)}
                    {current && <Badge tone="accent">This device</Badge>}
                    {!s.mfaVerified && user.mfaEnabled && <Badge tone="warning">MFA pending</Badge>}
                  </p>
                  <p className="text-xs text-fg-subtle">{s.ipAddress ?? "IP unknown"} · signed in {formatRelative(s.createdAt)} · expires {formatRelative(s.expires)}</p>
                </div>
                {!current && (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm">Revoke</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

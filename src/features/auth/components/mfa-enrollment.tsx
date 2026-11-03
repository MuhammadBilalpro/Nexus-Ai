"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, KeyRound } from "lucide-react";
import { beginMfaEnrollmentAction, confirmMfaEnrollmentAction, disableMfaAction, type EnrollmentState, type DisableMfaState } from "../actions/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function MfaEnrollment({ enabled, recoveryRemaining }: { enabled: boolean; recoveryRemaining: number }) {
  const [current, setCurrent] = useState<EnrollmentState>({ step: "idle" });
  const [starting, startTransition] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const [disableState, disableAction, disabling] = useActionState<DisableMfaState, FormData>(disableMfaAction, {});
  const id = useId();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const confirmAction = (fd: FormData) => {
    startConfirm(async () => {
      setCurrent(await confirmMfaEnrollmentAction(current, fd));
    });
  };

  if (disableState.ok) {
    return <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">Two-factor authentication has been disabled. Reload the page to re-enrol.</p>;
  }

  if (current.step === "done") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-success"><ShieldCheck className="h-4 w-4" aria-hidden /> Two-factor authentication is now enabled.</div>
        <div className="rounded-md border border-warning/30 bg-warning-soft p-4">
          <p className="text-sm font-medium text-warning">Save your recovery codes now</p>
          <p className="mt-1 text-xs text-fg-muted">Each code works once. They are shown only this one time; store them somewhere safe and offline.</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm tabular">
            {current.recoveryCodes?.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="mt-3"><CopyButton text={(current.recoveryCodes ?? []).join("\n")} label="Copy recovery codes" /></div>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success" dot>Enabled</Badge>
          <span className="text-xs text-fg-muted">{recoveryRemaining} recovery {recoveryRemaining === 1 ? "code" : "codes"} remaining</span>
        </div>
        <form action={disableAction} className="space-y-3 rounded-md border border-line bg-surface-2 p-4">
          <p className="text-sm font-medium text-fg">Disable two-factor authentication</p>
          <p className="text-xs text-fg-muted">Confirm your password. Other active sessions will be signed out.</p>
          <div>
            <Label htmlFor={`${id}-pw`}>Current password</Label>
            <Input id={`${id}-pw`} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 max-w-xs" invalid={Boolean(disableState.error)} />
            <FieldError>{disableState.error}</FieldError>
          </div>
          <Button type="submit" variant="danger" size="sm" loading={disabling}><ShieldOff className="h-3.5 w-3.5" aria-hidden /> Disable MFA</Button>
        </form>
      </div>
    );
  }

  if (current.step === "pending") {
    return (
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-md border border-line bg-white p-3" dangerouslySetInnerHTML={{ __html: current.qrSvg ?? "" }} aria-label="QR code for authenticator app" role="img" />
          <p className="text-[11px] text-fg-subtle">Scan with Google Authenticator, 1Password, Authy…</p>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-fg-muted">Can&apos;t scan? Enter this key manually:</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded-sm border border-line bg-surface-2 px-2 py-1 font-mono text-xs tracking-wider">{current.secret}</code>
              <CopyButton text={current.secret ?? ""} label="Copy setup key" />
            </div>
          </div>
          <form action={confirmAction} className="space-y-3" noValidate>
            <div>
              <Label htmlFor={`${id}-code`}>Enter the 6-digit code to confirm</Label>
              <Input id={`${id}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1.5 max-w-[200px] font-mono tracking-[0.25em]" invalid={Boolean(current.error)} />
              <FieldError>{current.error}</FieldError>
            </div>
            <Button type="submit" size="sm" loading={confirming}><KeyRound className="h-3.5 w-3.5" aria-hidden /> Activate</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-2"><Badge tone="warning" dot>Not enabled</Badge><span className="text-xs text-fg-muted">Strongly recommended for every account with financial or administrative access.</span></div>
      {current.error && <FieldError>{current.error}</FieldError>}
      <Button
        size="sm"
        loading={starting}
        onClick={() =>
          startTransition(async () => {
            setCurrent(await beginMfaEnrollmentAction());
          })
        }
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Set up authenticator app
      </Button>
    </div>
  );
}

"use client";

import { useActionState, useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { verifyMfaAction, logoutAction, type MfaState } from "../actions/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";

export function MfaForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<MfaState, FormData>(verifyMfaAction, {});
  const id = useId();
  const [code, setCode] = useState("");
  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <Label htmlFor={`${id}-code`}>Authentication code</Label>
          <Input id={`${id}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123 456" required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1.5 text-center font-mono text-lg tracking-[0.3em]" invalid={Boolean(state.error)} aria-describedby={state.error ? `${id}-err` : undefined} />
          <FieldError id={`${id}-err`}>{state.error}</FieldError>
          <p className="mt-2 text-xs text-fg-subtle">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          <ShieldCheck className="h-4 w-4" aria-hidden /> Verify
        </Button>
      </form>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">Use a different account</Button>
      </form>
    </div>
  );
}

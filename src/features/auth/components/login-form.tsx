"use client";

import { useActionState, useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { loginAction, type LoginState } from "../actions/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const id = useId();
  // Controlled fields: React 19 resets uncontrolled inputs after an action settles,
  // which would wipe the email on a failed attempt.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </div>
      )}
      <div>
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email ? `${id}-email-err` : undefined} />
        <FieldError id={`${id}-email-err`}>{state.fieldErrors?.email}</FieldError>
      </div>
      <div>
        <Label htmlFor={`${id}-password`}>Password</Label>
        <Input id={`${id}-password`} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password ? `${id}-password-err` : undefined} />
        <FieldError id={`${id}-password-err`}>{state.fieldErrors?.password}</FieldError>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useId, useState } from "react";
import { changePasswordAction, type ChangePasswordState } from "../actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  const id = useId();
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const bind = (k: keyof typeof values) => ({ value: values[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value })) });
  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      {state.ok && (
        <p role="status" className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
          Password updated. {state.revoked ? `${state.revoked} other session${state.revoked === 1 ? "" : "s"} signed out.` : ""}
        </p>
      )}
      <div>
        <Label htmlFor={`${id}-cur`}>Current password</Label>
        <Input id={`${id}-cur`} name="currentPassword" type="password" autoComplete="current-password" required {...bind("currentPassword")} className="mt-1.5" invalid={Boolean(state.fieldErrors?.currentPassword)} />
        <FieldError>{state.fieldErrors?.currentPassword}</FieldError>
      </div>
      <div>
        <Label htmlFor={`${id}-new`}>New password</Label>
        <Input id={`${id}-new`} name="newPassword" type="password" autoComplete="new-password" required minLength={12} {...bind("newPassword")} className="mt-1.5" invalid={Boolean(state.fieldErrors?.newPassword)} aria-describedby={`${id}-hint`} />
        <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-fg-subtle">At least 12 characters. Length matters more than symbols — a short phrase works well.</p>
        <FieldError>{state.fieldErrors?.newPassword}</FieldError>
      </div>
      <div>
        <Label htmlFor={`${id}-conf`}>Confirm new password</Label>
        <Input id={`${id}-conf`} name="confirmPassword" type="password" autoComplete="new-password" required {...bind("confirmPassword")} className="mt-1.5" invalid={Boolean(state.fieldErrors?.confirmPassword)} />
        <FieldError>{state.fieldErrors?.confirmPassword}</FieldError>
      </div>
      <Button type="submit" size="sm" loading={pending}>Update password</Button>
    </form>
  );
}

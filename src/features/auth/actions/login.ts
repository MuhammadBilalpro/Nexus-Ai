"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/server/auth";
import { db } from "@/server/db";
import { loginSchema, safeNextPath } from "../schemas";

export interface LoginState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  too_many_attempts: "Too many sign-in attempts. Please wait 15 minutes and try again.",
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" || key === "password") fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  try {
    // redirect: false → cookies are set, no redirect thrown; we choose the destination below.
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = "code" in err && typeof err.code === "string" ? err.code : "invalid_credentials";
      return { error: MESSAGES[code] ?? MESSAGES["invalid_credentials"] };
    }
    console.error("[auth] unexpected login failure", err);
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }

  // Decide the landing page explicitly so the client URL matches the rendered page
  // (a proxy-level redirect of an action redirect would otherwise leave the URL stale).
  const next = safeNextPath(parsed.data.next);
  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, select: { mfaEnabled: true } });
  if (user?.mfaEnabled) {
    redirect(next === "/" ? "/mfa" : `/mfa?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

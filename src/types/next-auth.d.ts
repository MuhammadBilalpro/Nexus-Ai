import type { RoleKey } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** Set by the proxy-safe config only: token says MFA step-up is still pending. */
    mfaPending?: boolean;
    user: {
      id: string;
      roles: RoleKey[];
      mfaEnabled: boolean;
      mfaVerified: boolean;
      sessionId: string;
    } & DefaultSession["user"];
  }

  interface User {
    sessionId?: string;
    mfaPending?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sid?: string;
    uid?: string;
    mfaPending?: boolean;
  }
}

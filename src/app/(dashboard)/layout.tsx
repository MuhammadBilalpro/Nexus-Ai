import { requireUser } from "@/server/auth/principal";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { DashboardShell } from "@/components/dashboard/shell";
import { UserMenu } from "@/components/dashboard/user-menu";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { can } from "@/server/policies";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pendingApprovals = can(user, "approval:read") ? await db.proposedAction.count({ where: { status: "PENDING", ...(env.DEMO_MODE ? {} : { isDemo: false }) } }) : 0;
  return (
    <>
      {env.DEMO_MODE && <DemoBanner />}
      <DashboardShell
        pendingApprovals={pendingApprovals}
        topbar={
          <>
            <CommandPalette />
            <UserMenu name={user.name} email={user.email} roles={user.roles} mfaEnabled={user.mfaEnabled} />
          </>
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}

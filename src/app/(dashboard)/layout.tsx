import { Suspense } from "react";
import { requireUser } from "@/server/auth/principal";
import { env } from "@/lib/env";
import { DashboardShell } from "@/components/dashboard/shell";
import { UserMenu } from "@/components/dashboard/user-menu";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { PeriodFilter } from "@/features/dashboard/components/period-filter";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      {env.DEMO_MODE && <DemoBanner />}
      <DashboardShell
        topbar={
          <>
            <Suspense fallback={<div className="h-9 w-72 skeleton" />}>
              <PeriodFilter />
            </Suspense>
            <UserMenu name={user.name} email={user.email} roles={user.roles} mfaEnabled={user.mfaEnabled} />
          </>
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}

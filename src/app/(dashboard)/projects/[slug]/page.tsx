import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { Tabs } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getProjectBySlug, getUserOptions } from "@/features/projects/queries";
import { ProjectHeader, OverviewTab, TasksTab, TeamTab, ActivityTab } from "@/features/projects/components/detail";

const TABS = ["overview", "tasks", "team", "activity"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { overview: "Overview", tasks: "Tasks", team: "Team", activity: "Activity" };

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const user = await requirePermission("project:read");
  const [{ slug }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const p = await getProjectBySlug(slug);
  if (!p) notFound();
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "overview";

  const canUpdate = can(user, "project:update");
  const canAssign = can(user, "project:assign");
  const canTaskUpdate = can(user, "task:update");
  const canTaskCreate = can(user, "task:create");
  const needsUsers = tab === "tasks" || tab === "team";
  const users = needsUsers ? await getUserOptions() : [];

  const openTasks = p.tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div>
      <ProjectHeader p={p} />
      <div className="mb-4">
        <Suspense fallback={<div className="h-8 w-72 skeleton" />}>
          <Tabs
            param="tab"
            defaultValue="overview"
            size="sm"
            items={TABS.map((t) => ({ label: TAB_LABELS[t], value: t, count: t === "tasks" ? openTasks : t === "team" ? p.members.length : undefined }))}
          />
        </Suspense>
      </div>
      <Suspense key={tab} fallback={<CardSkeleton rows={6} />}>
        <div className="animate-fade-in">
          {tab === "overview" && <OverviewTab p={p} canUpdate={canUpdate} />}
          {tab === "tasks" && <TasksTab p={p} users={users} canUpdate={canTaskUpdate} canCreate={canTaskCreate} />}
          {tab === "team" && <TeamTab p={p} users={users} canAssign={canAssign} />}
          {tab === "activity" && <ActivityTab p={p} />}
        </div>
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ProjectStatus } from "@/generated/prisma/enums";
import { getProjects, getUserOptions, sortProjects, SORT_KEYS, type SortKey } from "@/features/projects/queries";
import { NewProjectButton } from "@/features/projects/components/new-project-form";
import { Board } from "@/features/projects/components/board";
import { ProjectsTable } from "@/features/projects/components/table-view";
import { Timeline } from "@/features/projects/components/timeline";

export const metadata: Metadata = { title: "Projects" };

const VIEWS = ["board", "table", "timeline"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { board: "Board", table: "Table", timeline: "Timeline" };

interface Params {
  view?: string;
  sort?: string;
  dir?: string;
  status?: string;
}

function parseView(v: string | undefined): View {
  return (VIEWS as readonly string[]).includes(v ?? "") ? (v as View) : "board";
}

async function BoardView({ canMove }: { canMove: boolean }) {
  return <Board rows={await getProjects()} canMove={canMove} />;
}

async function TableView({ params }: { params: Params }) {
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(params.sort ?? "") ? (params.sort as SortKey) : "deadline";
  const dir = params.dir === "desc" ? "desc" : "asc";
  const status = (Object.values(ProjectStatus) as string[]).includes(params.status ?? "") ? (params.status as string) : "";
  const all = await getProjects();
  const counts: Record<string, number> = {};
  for (const p of all) counts[p.status] = (counts[p.status] ?? 0) + 1;
  const rows = sortProjects(status ? all.filter((p) => p.status === status) : all, sort, dir);
  return <ProjectsTable rows={rows} sort={sort} dir={dir} status={status} counts={counts} />;
}

async function TimelineView() {
  return <Timeline rows={await getProjects()} now={new Date()} />;
}

async function NewProject() {
  return <NewProjectButton managers={await getUserOptions()} />;
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission("project:read");
  const params = await searchParams;
  const view = parseView(params.view);
  const canCreate = can(user, "project:create");
  const canMove = can(user, "project:update");

  const skeleton = view === "board" ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} rows={3} />)}</div> : <CardSkeleton rows={8} />;

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Delivery across every engagement: status, health, deadlines and milestones."
        actions={
          <>
            <Suspense fallback={<div className="h-8 w-56 skeleton" />}>
              <Tabs param="view" defaultValue="board" size="sm" items={VIEWS.map((v) => ({ label: VIEW_LABELS[v], value: v }))} />
            </Suspense>
            {canCreate && (
              <Suspense fallback={<div className="h-8 w-28 skeleton" />}>
                <NewProject />
              </Suspense>
            )}
          </>
        }
      />
      <Suspense key={view} fallback={skeleton}>
        {view === "board" && <BoardView canMove={canMove} />}
        {view === "table" && <TableView params={params} />}
        {view === "timeline" && <TimelineView />}
      </Suspense>
    </div>
  );
}

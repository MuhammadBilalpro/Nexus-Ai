import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getWorkflow } from "@/features/automation/queries";
import { FlowCanvas } from "@/features/automation/components/flow-canvas";
import { WorkflowSettings } from "@/features/automation/components/workflow-settings";
import { RunHistory } from "@/features/automation/components/run-history";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const wf = await getWorkflow(id);
  return { title: wf ? `${wf.name} · Automation` : "Workflow" };
}

async function Builder({ id, canManage }: { id: string; canManage: boolean }) {
  const wf = await getWorkflow(id);
  if (!wf) notFound();
  const errorCount = wf.validation.items.filter((i) => i.level === "error").length;
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/automation" className="inline-flex items-center gap-1 normal-case tracking-normal text-fg-subtle hover:text-fg">
            <ArrowLeft className="h-3 w-3" aria-hidden /> Automation
          </Link>
        }
        title={wf.name}
        description={wf.description ?? "No description yet."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={wf.enabled ? "success" : "neutral"} dot>{wf.enabled ? "Enabled" : "Disabled"}</Badge>
            <Badge tone={errorCount ? "danger" : "success"}>{errorCount ? `${errorCount} validation ${errorCount === 1 ? "issue" : "issues"}` : "Valid chain"}</Badge>
            {wf.validation.requiresHumanApproval && <Badge tone="outline">Requires human approval</Badge>}
            <span className="text-xs tabular text-fg-subtle">{wf.steps.length} {wf.steps.length === 1 ? "step" : "steps"}</span>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FlowCanvas workflowId={wf.id} steps={wf.steps} canManage={canManage} validation={wf.validation.items} />
        </div>
        <div className="space-y-4">
          <WorkflowSettings workflow={wf} canManage={canManage} />
          <RunHistory runs={wf.runs} />
        </div>
      </div>
    </>
  );
}

export default async function WorkflowPage({ params }: { params: Params }) {
  const user = await requirePermission("automation:read");
  const canManage = can(user, "automation:manage");
  const { id } = await params;
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-7 w-72 skeleton" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <CardSkeleton className="xl:col-span-2" rows={4} />
              <div className="space-y-4"><CardSkeleton rows={4} /><CardSkeleton rows={3} /></div>
            </div>
          </div>
        }
      >
        <Builder id={id} canManage={canManage} />
      </Suspense>
    </div>
  );
}

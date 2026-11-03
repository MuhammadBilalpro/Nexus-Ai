import Link from "next/link";
import { Workflow } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function WorkflowNotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState icon={Workflow} title="Workflow not found" description="It may have been deleted, or the link is wrong." action={<Link href="/automation"><Button variant="secondary" size="sm">Back to Automation</Button></Link>} />
    </div>
  );
}

import Link from "next/link";
import { FolderX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <EmptyState icon={FolderX} title="Project not found" description="It may have been renamed or you may not have access to it." action={<Link href="/projects"><Button variant="secondary" size="sm">Back to projects</Button></Link>} />
    </div>
  );
}

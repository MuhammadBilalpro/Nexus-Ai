-- Milestones, AI agents, proposed actions, assistant conversations, automation workflows.

CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MISSED');
CREATE TYPE "AgentKey" AS ENUM ('EXECUTIVE', 'PROJECT_MANAGER', 'FINANCE', 'GAME_QA', 'DEVELOPMENT', 'CLIENT_BUSINESS');
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "RunStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'AWAITING_APPROVAL');
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "StepKind" AS ENUM ('TRIGGER', 'CONDITION', 'AGENT', 'ACTION');

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "key" "AgentKey" NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposedAction" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "runId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "payload" JSONB,
    "risk" TEXT NOT NULL DEFAULT 'low',
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProposedAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agentKey" "AgentKey",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structured" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "StepKind" NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB,
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agent_key_key" ON "Agent"("key");
CREATE UNIQUE INDEX "WorkflowStep_workflowId_order_key" ON "WorkflowStep"("workflowId", "order");
CREATE INDEX "Milestone_projectId_dueDate_idx" ON "Milestone"("projectId", "dueDate");
CREATE INDEX "AgentRun_agentId_startedAt_idx" ON "AgentRun"("agentId", "startedAt");
CREATE INDEX "ProposedAction_status_createdAt_idx" ON "ProposedAction"("status", "createdAt");
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "WorkflowRun_workflowId_startedAt_idx" ON "WorkflowRun"("workflowId", "startedAt");

ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposedAction" ADD CONSTRAINT "ProposedAction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposedAction" ADD CONSTRAINT "ProposedAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

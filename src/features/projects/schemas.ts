import { z } from "zod";
import { ProjectCategory, ProjectStatus, TaskStatus, TaskPriority } from "@/generated/prisma/enums";

/** Shared between client forms and Server Actions. Keep free of server imports. */
const id = z.string().cuid();
const optionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), id.optional());
const optionalDate = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.iso.date().optional());
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
    category: z.enum(ProjectCategory),
    budget: z
      .string()
      .trim()
      .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount such as 25000 or 25000.50"),
    deadline: optionalDate,
    startDate: optionalDate,
    managerId: optionalId,
    description: optionalText(2000),
  })
  .strict();

export const updateProjectStatusSchema = z.object({ projectId: id, status: z.enum(ProjectStatus) }).strict();

export const createTaskSchema = z
  .object({
    projectId: id,
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
    priority: z.enum(TaskPriority),
    assigneeId: optionalId,
    dueDate: optionalDate,
  })
  .strict();

export const updateTaskStatusSchema = z.object({ taskId: id, status: z.enum(TaskStatus) }).strict();

export const addProjectMemberSchema = z.object({ projectId: id, userId: id, role: optionalText(60) }).strict();

export const completeMilestoneSchema = z.object({ milestoneId: id }).strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Database seed.
 *
 * Always: roles, departments, and (if no users exist) the initial Super Admin
 * from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 *
 * Only when DEMO_MODE=true: a realistic, clearly-labelled demo dataset
 * (every row has isDemo = true). The dashboard excludes these rows whenever
 * DEMO_MODE is off, so demo figures can never be mistaken for real ones.
 */
import "dotenv/config";
import { subDays, addDays, subMonths, startOfMonth } from "date-fns";
import { db } from "../src/server/db";
import { env } from "../src/lib/env";
import { hashPassword, passwordSchema } from "../src/server/auth/password";
import {
  RoleKey,
  ProjectCategory,
  ProjectStatus,
  ProjectHealth,
  TaskStatus,
  TaskPriority,
  InvoiceStatus,
  ExpenseCategory,
  MilestoneStatus,
  AgentKey,
  RunStatus,
  StepKind,
} from "../src/generated/prisma/enums";

const ROLES: { key: RoleKey; name: string; description: string }[] = [
  { key: RoleKey.SUPER_ADMIN, name: "Super Admin", description: "Full platform administration" },
  { key: RoleKey.CEO, name: "CEO", description: "Executive access to all company data and approvals" },
  { key: RoleKey.PROJECT_MANAGER, name: "Project Manager", description: "Manages projects, tasks and team assignments" },
  { key: RoleKey.FINANCE_MANAGER, name: "Finance Manager", description: "Manages invoices, expenses and financial reports" },
  { key: RoleKey.DEVELOPER, name: "Developer", description: "Works on assigned projects and tasks" },
  { key: RoleKey.QA_ENGINEER, name: "QA Engineer", description: "Tests builds and reports defects" },
  { key: RoleKey.VIEWER, name: "Viewer", description: "Read-only access to non-sensitive dashboards" },
];

const DEPARTMENTS = [
  { name: "Executive", slug: "executive" },
  { name: "Game Development", slug: "game-development" },
  { name: "Web Development", slug: "web-development" },
  { name: "Software Engineering", slug: "software-engineering" },
  { name: "Design", slug: "design" },
  { name: "Quality Assurance", slug: "qa" },
  { name: "Finance", slug: "finance" },
  { name: "Business Development", slug: "business-development" },
];

async function seedRolesAndDepartments(): Promise<void> {
  for (const role of ROLES) {
    await db.role.upsert({ where: { key: role.key }, update: { name: role.name, description: role.description }, create: role });
  }
  for (const dept of DEPARTMENTS) {
    await db.department.upsert({ where: { slug: dept.slug }, update: { name: dept.name }, create: dept });
  }
  console.log(`✓ ${ROLES.length} roles, ${DEPARTMENTS.length} departments`);
}

async function seedAdmin(): Promise<void> {
  const existing = await db.user.count();
  if (existing > 0) {
    console.log("• users already exist — skipping admin bootstrap");
    return;
  }
  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("• SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no admin created");
    return;
  }
  const check = passwordSchema.safeParse(password);
  if (!check.success) {
    throw new Error(`SEED_ADMIN_PASSWORD rejected by policy: ${check.error.issues[0]?.message}`);
  }
  const [superAdmin, ceo] = await Promise.all([
    db.role.findUniqueOrThrow({ where: { key: RoleKey.SUPER_ADMIN } }),
    db.role.findUniqueOrThrow({ where: { key: RoleKey.CEO } }),
  ]);
  const exec = await db.department.findUniqueOrThrow({ where: { slug: "executive" } });
  await db.user.create({
    data: {
      email: email.toLowerCase(),
      name: "Chief Executive",
      title: "CEO",
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      emailVerified: new Date(),
      departmentId: exec.id,
      roles: { create: [{ roleId: superAdmin.id }, { roleId: ceo.id }] },
    },
  });
  console.log(`✓ admin user ${email} (Super Admin + CEO)`);
}

// ───────────────────────── Demo data ─────────────────────────

type DemoUser = { email: string; name: string; title: string; dept: string; role: RoleKey };

const DEMO_USERS: DemoUser[] = [
  { email: "sara.pm@demo.nexus", name: "Sara Haddad", title: "Senior Project Manager", dept: "game-development", role: RoleKey.PROJECT_MANAGER },
  { email: "omar.pm@demo.nexus", name: "Omar Qureshi", title: "Project Manager", dept: "web-development", role: RoleKey.PROJECT_MANAGER },
  { email: "lina.fin@demo.nexus", name: "Lina Farouk", title: "Finance Manager", dept: "finance", role: RoleKey.FINANCE_MANAGER },
  { email: "ali.dev@demo.nexus", name: "Ali Raza", title: "Unreal Engine Developer", dept: "game-development", role: RoleKey.DEVELOPER },
  { email: "noor.dev@demo.nexus", name: "Noor Saleh", title: "Full-Stack Developer", dept: "web-development", role: RoleKey.DEVELOPER },
  { email: "hassan.dev@demo.nexus", name: "Hassan Malik", title: "Backend Engineer", dept: "software-engineering", role: RoleKey.DEVELOPER },
  { email: "maya.design@demo.nexus", name: "Maya Khalil", title: "Lead Product Designer", dept: "design", role: RoleKey.DEVELOPER },
  { email: "zain.qa@demo.nexus", name: "Zain Ahmed", title: "QA Engineer", dept: "qa", role: RoleKey.QA_ENGINEER },
  { email: "dina.bd@demo.nexus", name: "Dina Mansour", title: "Business Development Lead", dept: "business-development", role: RoleKey.VIEWER },
];

async function seedDemo(): Promise<void> {
  const already = await db.project.count({ where: { isDemo: true } });
  if (already > 0) {
    console.log("• demo data already present — skipping");
    return;
  }
  const now = new Date();
  const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id])) as Record<RoleKey, string>;
  const depts = Object.fromEntries((await db.department.findMany()).map((d) => [d.slug, d.id]));

  // Users (no passwords — demo users cannot log in)
  const users: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const created = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        title: u.title,
        departmentId: depts[u.dept],
        isDemo: true,
        emailVerified: now,
        roles: { create: [{ roleId: roles[u.role] }] },
      },
    });
    users[u.email] = created.id;
  }

  // Clients
  const clients = await Promise.all(
    [
      { name: "Faisal Al-Otaibi", company: "Riyadh Interactive", email: "faisal@demo.nexus" },
      { name: "Elena Marchetti", company: "Northwind Retail", email: "elena@demo.nexus" },
      { name: "Daniel Okoro", company: "Helios Fintech", email: "daniel@demo.nexus" },
      { name: "Hana Yamamoto", company: "Kiro Studios", email: "hana@demo.nexus" },
    ].map((c) => db.client.create({ data: { ...c, isDemo: true } })),
  );

  type P = {
    name: string; slug: string; category: ProjectCategory; status: ProjectStatus; health: ProjectHealth;
    budget: string; progress: number; start: number; deadline: number; manager: string; client: number; completedDaysAgo?: number;
  };
  const projectsSpec: P[] = [
    { name: "Dune Raiders — Open World RPG", slug: "dune-raiders", category: ProjectCategory.GAME_DEVELOPMENT, status: ProjectStatus.ACTIVE, health: ProjectHealth.AT_RISK, budget: "420000.00", progress: 58, start: 210, deadline: 95, manager: "sara.pm@demo.nexus", client: 0 },
    { name: "Northwind Commerce Platform", slug: "northwind-commerce", category: ProjectCategory.WEB_DEVELOPMENT, status: ProjectStatus.ACTIVE, health: ProjectHealth.ON_TRACK, budget: "145000.00", progress: 72, start: 120, deadline: 40, manager: "omar.pm@demo.nexus", client: 1 },
    { name: "Helios Banking App (iOS/Android)", slug: "helios-mobile", category: ProjectCategory.MOBILE_APPLICATION, status: ProjectStatus.ACTIVE, health: ProjectHealth.DELAYED, budget: "260000.00", progress: 44, start: 180, deadline: -12, manager: "omar.pm@demo.nexus", client: 2 },
    { name: "Kiro Puzzle Collection", slug: "kiro-puzzles", category: ProjectCategory.GAME_DEVELOPMENT, status: ProjectStatus.ACTIVE, health: ProjectHealth.ON_TRACK, budget: "88000.00", progress: 81, start: 150, deadline: 25, manager: "sara.pm@demo.nexus", client: 3 },
    { name: "Internal Asset Pipeline Service", slug: "asset-pipeline", category: ProjectCategory.SOFTWARE_DEVELOPMENT, status: ProjectStatus.ACTIVE, health: ProjectHealth.ON_TRACK, budget: "60000.00", progress: 35, start: 45, deadline: 75, manager: "omar.pm@demo.nexus", client: 0 },
    { name: "Helios Design System", slug: "helios-design-system", category: ProjectCategory.UI_UX_DESIGN, status: ProjectStatus.COMPLETED, health: ProjectHealth.ON_TRACK, budget: "52000.00", progress: 100, start: 160, deadline: 30, manager: "omar.pm@demo.nexus", client: 2, completedDaysAgo: 34 },
    { name: "Riyadh Interactive Brand Portal", slug: "riyadh-portal", category: ProjectCategory.WEB_DEVELOPMENT, status: ProjectStatus.COMPLETED, health: ProjectHealth.ON_TRACK, budget: "74000.00", progress: 100, start: 300, deadline: 140, manager: "omar.pm@demo.nexus", client: 0, completedDaysAgo: 150 },
    { name: "Northwind Loyalty Mobile", slug: "northwind-loyalty", category: ProjectCategory.MOBILE_APPLICATION, status: ProjectStatus.ON_HOLD, health: ProjectHealth.AT_RISK, budget: "110000.00", progress: 20, start: 90, deadline: 120, manager: "sara.pm@demo.nexus", client: 1 },
    { name: "Dune Raiders — Multiplayer Prototype", slug: "dune-raiders-mp", category: ProjectCategory.GAME_DEVELOPMENT, status: ProjectStatus.PLANNING, health: ProjectHealth.ON_TRACK, budget: "150000.00", progress: 5, start: -20, deadline: 200, manager: "sara.pm@demo.nexus", client: 0 },
  ];

  const projects: Record<string, string> = {};
  for (const p of projectsSpec) {
    const created = await db.project.create({
      data: {
        name: p.name, slug: p.slug, category: p.category, status: p.status, health: p.health,
        budget: p.budget, progress: p.progress, isDemo: true,
        startDate: subDays(now, p.start),
        deadline: addDays(now, p.deadline),
        completedAt: p.completedDaysAgo ? subDays(now, p.completedDaysAgo) : null,
        managerId: users[p.manager],
        clientId: clients[p.client]!.id,
        description: `Demo project: ${p.name}.`,
      },
    });
    projects[p.slug] = created.id;
  }

  // Memberships
  const membership: [string, string[]][] = [
    ["dune-raiders", ["ali.dev@demo.nexus", "maya.design@demo.nexus", "zain.qa@demo.nexus", "hassan.dev@demo.nexus"]],
    ["northwind-commerce", ["noor.dev@demo.nexus", "hassan.dev@demo.nexus", "maya.design@demo.nexus"]],
    ["helios-mobile", ["noor.dev@demo.nexus", "hassan.dev@demo.nexus", "zain.qa@demo.nexus"]],
    ["kiro-puzzles", ["ali.dev@demo.nexus", "zain.qa@demo.nexus"]],
    ["asset-pipeline", ["hassan.dev@demo.nexus"]],
    ["northwind-loyalty", ["noor.dev@demo.nexus"]],
    ["dune-raiders-mp", ["ali.dev@demo.nexus"]],
  ];
  for (const [slug, emails] of membership) {
    await db.projectMember.createMany({ data: emails.map((e) => ({ projectId: projects[slug]!, userId: users[e]! })) });
  }

  // Tasks — spread statuses, some overdue, some due soon
  const taskTitles = [
    "Implement inventory system", "Optimise shader compilation", "Fix memory leak in level streaming", "Checkout flow A/B test",
    "Payment gateway integration", "Biometric login", "Accessibility audit", "Localisation (AR/EN)", "Crash reporting pipeline",
    "Leaderboard backend", "Design tokens v2", "Onboarding screens", "Performance profiling", "CI pipeline hardening",
    "Analytics events", "Push notifications", "Save-game cloud sync", "Admin dashboard filters",
  ];
  const assignees = Object.values(users).filter((_, i) => i >= 3 && i <= 7);
  const taskStatuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE];
  const priorities = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL];
  const activeSlugs = ["dune-raiders", "northwind-commerce", "helios-mobile", "kiro-puzzles", "asset-pipeline"];
  let t = 0;
  for (const slug of activeSlugs) {
    for (let i = 0; i < 7; i++) {
      const status = taskStatuses[(t + i) % 4]!;
      const dueOffset = ((t * 7 + i * 5) % 40) - 10; // -10..29 days
      await db.task.create({
        data: {
          projectId: projects[slug]!,
          title: taskTitles[(t + i) % taskTitles.length]!,
          status,
          priority: priorities[(t + i * 2) % 4]!,
          assigneeId: assignees[(t + i) % assignees.length]!,
          dueDate: addDays(now, dueOffset),
          completedAt: status === TaskStatus.DONE ? subDays(now, (i % 6) + 1) : null,
          isDemo: true,
        },
      });
      t++;
    }
  }
  // Give Noor a visible overload: 6 extra in-progress tasks
  for (let i = 0; i < 6; i++) {
    await db.task.create({
      data: {
        projectId: projects["helios-mobile"]!, title: `Helios hotfix #${i + 1}`, status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH, assigneeId: users["noor.dev@demo.nexus"]!, dueDate: addDays(now, i + 2), isDemo: true,
      },
    });
  }

  // Invoices across the last 12 months — monthly instalments so revenue reads as a trend
  const invoiceSpec: { slug: string; client: number; amount: string; monthsAgo: number; status: InvoiceStatus }[] = [];
  const revenueBySlug: [string, number, string, number, number][] = [
    // slug, client, total, instalments, first month ago
    ["riyadh-portal", 0, "74000.00", 4, 11],
    ["helios-design-system", 2, "52000.00", 3, 7],
    ["northwind-commerce", 1, "145000.00", 5, 5],
    ["dune-raiders", 0, "420000.00", 8, 7],
    ["helios-mobile", 2, "260000.00", 6, 6],
    ["kiro-puzzles", 3, "88000.00", 4, 4],
  ];
  for (const [slug, client, total, instalments, first] of revenueBySlug) {
    const totalNum = Number(total);
    for (let k = 0; k < instalments; k++) {
      const monthsAgo = Math.max(0, first - k);
      const weight = 1 + ((k * 7 + slug.length) % 3) * 0.25; // vary instalment sizes
      const amount = ((totalNum / instalments) * weight).toFixed(2);
      let status: InvoiceStatus = InvoiceStatus.PAID;
      if (slug === "dune-raiders" && k === instalments - 2) status = InvoiceStatus.SENT;
      if (slug === "helios-mobile" && k >= instalments - 2) status = k === instalments - 2 ? InvoiceStatus.OVERDUE : InvoiceStatus.DRAFT;
      if (slug === "kiro-puzzles" && k === instalments - 1) status = InvoiceStatus.SENT;
      if (slug === "northwind-commerce" && k === instalments - 2) status = InvoiceStatus.OVERDUE;
      invoiceSpec.push({ slug, client, amount, monthsAgo, status });
    }
  }
  let inv = 1001;
  const clamp = (d: Date, maxDaysAgo: number) => (d > subDays(now, maxDaysAgo) ? subDays(now, maxDaysAgo) : d);
  for (const s of invoiceSpec) {
    const issuedAt = clamp(addDays(startOfMonth(subMonths(now, s.monthsAgo)), 3 + (inv % 9)), 3);
    const dueAt = addDays(issuedAt, 30);
    const paidAt = s.status === InvoiceStatus.PAID ? clamp(addDays(issuedAt, 10 + (inv % 15)), 1) : null;
    await db.invoice.create({
      data: { number: `DEMO-INV-${inv++}`, projectId: projects[s.slug]!, clientId: clients[s.client]!.id, amount: s.amount, status: s.status, issuedAt, dueAt, paidAt, isDemo: true },
    });
  }

  // Expenses: monthly salaries + variable costs for the last 12 months
  const expenseCats = [ExpenseCategory.SOFTWARE, ExpenseCategory.INFRASTRUCTURE, ExpenseCategory.MARKETING, ExpenseCategory.CONTRACTORS, ExpenseCategory.OFFICE];
  for (let m = 11; m >= 0; m--) {
    const month = startOfMonth(subMonths(now, m));
    const salariesAt = addDays(month, 25) > now ? subDays(now, 1) : addDays(month, 25);
    await db.expense.create({ data: { category: ExpenseCategory.SALARIES, description: "Monthly payroll", amount: "38500.00", incurredAt: salariesAt, isDemo: true } });
    for (let c = 0; c < 3; c++) {
      const cat = expenseCats[(m + c) % expenseCats.length]!;
      const amount = (1800 + ((m * 37 + c * 91) % 5200)).toFixed(2);
      const slug = activeSlugs[(m + c) % activeSlugs.length]!;
      const at = addDays(month, 5 + c * 6) > now ? subDays(now, c + 1) : addDays(month, 5 + c * 6);
      await db.expense.create({ data: { category: cat, description: `${cat.toLowerCase()} — ${slug}`, amount, incurredAt: at, projectId: projects[slug]!, isDemo: true } });
    }
  }

  // Pending client approvals
  await db.clientApproval.createMany({
    data: [
      { projectId: projects["dune-raiders"]!, clientId: clients[0]!.id, title: "Milestone 3 vertical slice sign-off", requestedAt: subDays(now, 6), isDemo: true },
      { projectId: projects["northwind-commerce"]!, clientId: clients[1]!.id, title: "Checkout redesign approval", requestedAt: subDays(now, 2), isDemo: true },
      { projectId: projects["helios-mobile"]!, clientId: clients[2]!.id, title: "Revised timeline & change order", requestedAt: subDays(now, 11), isDemo: true },
      { projectId: projects["kiro-puzzles"]!, clientId: clients[3]!.id, title: "Store listing assets", requestedAt: subDays(now, 1), isDemo: true },
    ],
  });

  // Recent activity feed
  const activity: [string, string, string, string, number][] = [
    ["task.completed", "Zain Ahmed completed “Crash reporting pipeline”", "zain.qa@demo.nexus", "helios-mobile", 1],
    ["invoice.overdue", "Invoice DEMO-INV-1018 for Northwind Commerce Platform is overdue", "lina.fin@demo.nexus", "northwind-commerce", 2],
    ["project.health", "Dune Raiders moved to At Risk — milestone 3 slipping", "sara.pm@demo.nexus", "dune-raiders", 3],
    ["approval.requested", "Checkout redesign sent to Northwind Retail for approval", "omar.pm@demo.nexus", "northwind-commerce", 5],
    ["task.created", "Maya Khalil opened “Design tokens v2”", "maya.design@demo.nexus", "dune-raiders", 8],
    ["project.created", "Dune Raiders — Multiplayer Prototype entered planning", "sara.pm@demo.nexus", "dune-raiders-mp", 20],
    ["invoice.paid", "Invoice DEMO-INV-1011 paid by Kiro Studios", "lina.fin@demo.nexus", "kiro-puzzles", 26],
    ["project.completed", "Helios Design System delivered", "omar.pm@demo.nexus", "helios-design-system", 34 * 24],
  ];
  for (const [type, message, actor, slug, hoursAgo] of activity) {
    await db.activity.create({
      data: { type, message, actorId: users[actor]!, projectId: projects[slug]!, isDemo: true, createdAt: new Date(now.getTime() - hoursAgo * 3600_000) },
    });
  }

  console.log("✓ demo dataset (users, clients, projects, tasks, invoices, expenses, approvals, activity)");
  await seedDemoMilestones(projects);
  await seedDemoAgentActivity(projects, users);
  await seedDemoWorkflows();
}

/** Public demo login (DEMO_MODE only). Read-only intent: security settings are locked for demo accounts. */
export const DEMO_LOGIN = { email: "demo@nexus.local", password: "NexusDemo-2026!" } as const;

async function seedDemoLogin(): Promise<void> {
  const ceo = await db.role.findUniqueOrThrow({ where: { key: RoleKey.CEO } });
  const exec = await db.department.findUniqueOrThrow({ where: { slug: "executive" } });
  await db.user.upsert({
    where: { email: DEMO_LOGIN.email },
    update: { passwordHash: await hashPassword(DEMO_LOGIN.password), isActive: true, mfaEnabled: false },
    create: {
      email: DEMO_LOGIN.email,
      name: "Demo Executive",
      title: "CEO (demo)",
      passwordHash: await hashPassword(DEMO_LOGIN.password),
      emailVerified: new Date(),
      departmentId: exec.id,
      isDemo: true,
      roles: { create: [{ roleId: ceo.id }] },
    },
  });
  console.log(`✓ demo login ${DEMO_LOGIN.email}`);
}


// ───────────────────────── AI agents (always seeded; definitions, not demo data) ─────────────────────────

const AGENTS: { key: AgentKey; name: string; purpose: string; description: string; permissions: string[] }[] = [
  { key: AgentKey.EXECUTIVE, name: "Executive Intelligence", purpose: "Company performance, risks and executive summaries", description: "Reads across projects, finance and team data to answer leadership questions, surface risks and recommend improvements.", permissions: ["read:projects", "read:finance", "read:team", "read:clients", "propose:action"] },
  { key: AgentKey.PROJECT_MANAGER, name: "Project Manager", purpose: "Progress, delays, milestones and workload", description: "Monitors project health, flags overdue tasks, detects workload imbalance and drafts status reports.", permissions: ["read:projects", "read:team", "propose:task_assignment", "propose:action"] },
  { key: AgentKey.FINANCE, name: "Finance Intelligence", purpose: "Revenue, expenses, profitability and invoices", description: "Analyses backend-computed figures, tracks outstanding invoices and spots unusual spending. Never edits financial records.", permissions: ["read:finance", "read:projects", "propose:invoice_followup"] },
  { key: AgentKey.GAME_QA, name: "Game QA", purpose: "Bug triage and testing priorities", description: "Reviews QA reports, clusters recurring defects and recommends what to test next.", permissions: ["read:projects", "read:qa", "propose:action"] },
  { key: AgentKey.DEVELOPMENT, name: "Development Assistant", purpose: "Repository and pull-request visibility", description: "Summarises pull requests and engineering activity through authorised integrations. Cannot modify or deploy code.", permissions: ["read:github", "read:projects"] },
  { key: AgentKey.CLIENT_BUSINESS, name: "Client & Business", purpose: "Client requirements, approvals and opportunities", description: "Tracks client communications, pending approvals and opportunities; drafts proposals and follow-ups for human review.", permissions: ["read:clients", "read:projects", "propose:followup", "draft:proposal"] },
];

async function seedAgents(): Promise<void> {
  for (const a of AGENTS) {
    await db.agent.upsert({ where: { key: a.key }, update: { name: a.name, purpose: a.purpose, description: a.description, permissions: a.permissions }, create: a });
  }
  console.log(`✓ ${AGENTS.length} AI agents`);
}

async function seedDemoAgentActivity(projects: Record<string, string>, users: Record<string, string>): Promise<void> {
  const now = new Date();
  const agents = Object.fromEntries((await db.agent.findMany()).map((a) => [a.key, a.id])) as Record<AgentKey, string>;
  const h = (hours: number) => new Date(now.getTime() - hours * 3600_000);

  const runs: [AgentKey, string, string, RunStatus, number][] = [
    [AgentKey.EXECUTIVE, "schedule", "Morning briefing compiled: 1 delayed project, 4 overdue invoices, 4 pending approvals", RunStatus.SUCCEEDED, 1],
    [AgentKey.FINANCE, "schedule", "Overdue invoice scan: DEMO-INV-1012, 1016, 1019, 1024 past due; 2 follow-ups proposed", RunStatus.AWAITING_APPROVAL, 2],
    [AgentKey.PROJECT_MANAGER, "schedule", "Workload check: Noor Saleh at 11 open tasks (2 overdue); reassignment proposed", RunStatus.AWAITING_APPROVAL, 3],
    [AgentKey.PROJECT_MANAGER, "assistant", "Answered: which projects are delayed → Helios Banking App (deadline passed 12 days ago)", RunStatus.SUCCEEDED, 5],
    [AgentKey.CLIENT_BUSINESS, "workflow", "Approval reminder drafted for Helios Fintech (revised timeline, 11 days pending)", RunStatus.AWAITING_APPROVAL, 7],
    [AgentKey.GAME_QA, "schedule", "QA digest: 3 recurring crash signatures in Dune Raiders level streaming", RunStatus.SUCCEEDED, 9],
    [AgentKey.DEVELOPMENT, "schedule", "GitHub integration not configured — run skipped", RunStatus.FAILED, 12],
    [AgentKey.EXECUTIVE, "assistant", "Generated company performance report for this month", RunStatus.SUCCEEDED, 26],
    [AgentKey.FINANCE, "assistant", "Answered: highest-margin project → Helios Design System (completed, 100% invoiced)", RunStatus.SUCCEEDED, 30],
    [AgentKey.PROJECT_MANAGER, "schedule", "Daily status: 5 active projects, 2 at risk", RunStatus.SUCCEEDED, 49],
  ];
  const runIds: Record<string, string> = {};
  for (const [key, trigger, summary, status, hoursAgo] of runs) {
    const r = await db.agentRun.create({ data: { agentId: agents[key], trigger, summary, status, durationMs: 1200 + hoursAgo * 37, startedAt: h(hoursAgo), isDemo: true } });
    runIds[`${key}:${hoursAgo}`] = r.id;
  }

  await db.proposedAction.createMany({
    data: [
      { agentId: agents[AgentKey.FINANCE], runId: runIds[`${AgentKey.FINANCE}:2`], kind: "send_invoice_followup", title: "Send payment reminder for DEMO-INV-1016 (Riyadh Interactive, 105,000 USD)", rationale: "Invoice is 34 days overdue and no reminder has been sent. Client has paid two earlier instalments on time.", payload: { invoice: "DEMO-INV-1016", client: "Riyadh Interactive", template: "friendly_reminder" }, risk: "low", isDemo: true, createdAt: h(2) },
      { agentId: agents[AgentKey.FINANCE], runId: runIds[`${AgentKey.FINANCE}:2`], kind: "escalate_invoice", title: "Escalate DEMO-INV-1019 (Helios Fintech) to account manager", rationale: "Second overdue invoice from the same client while the project is delayed; relationship risk is rising.", payload: { invoice: "DEMO-INV-1019", client: "Helios Fintech" }, risk: "medium", isDemo: true, createdAt: h(2) },
      { agentId: agents[AgentKey.PROJECT_MANAGER], runId: runIds[`${AgentKey.PROJECT_MANAGER}:3`], kind: "reassign_tasks", title: "Move 3 Helios hotfix tasks from Noor Saleh to Hassan Malik", rationale: "Noor carries 11 open tasks with 2 overdue; Hassan has 5 open and shared context on Helios.", payload: { from: users["noor.dev@demo.nexus"], to: users["hassan.dev@demo.nexus"], count: 3, project: projects["helios-mobile"] }, risk: "medium", isDemo: true, createdAt: h(3) },
      { agentId: agents[AgentKey.CLIENT_BUSINESS], runId: runIds[`${AgentKey.CLIENT_BUSINESS}:7`], kind: "send_approval_reminder", title: "Remind Helios Fintech about the revised timeline approval", rationale: "Approval has been pending for 11 days; the project cannot re-baseline without it.", payload: { approval: "Revised timeline & change order", client: "Helios Fintech" }, risk: "low", isDemo: true, createdAt: h(7) },
      { agentId: agents[AgentKey.PROJECT_MANAGER], kind: "update_project_health", title: "Mark Northwind Loyalty Mobile as At Risk", rationale: "Project is on hold with 20% progress and a deadline in 120 days; budget consumption has stalled.", payload: { project: projects["northwind-loyalty"], health: "AT_RISK" }, risk: "low", status: "APPROVED", decidedAt: h(20), isDemo: true, createdAt: h(28) },
      { agentId: agents[AgentKey.FINANCE], kind: "flag_expense", title: "Flag duplicate marketing expense for review", rationale: "Two near-identical marketing expenses were logged on consecutive days.", payload: {}, risk: "low", status: "REJECTED", decidedAt: h(44), isDemo: true, createdAt: h(50) },
    ],
  });
  console.log("✓ demo agent runs and proposed actions");
}

async function seedDemoMilestones(projects: Record<string, string>): Promise<void> {
  const now = new Date();
  const spec: [string, string, number, MilestoneStatus][] = [
    ["dune-raiders", "Pre-production & concept lock", -170, MilestoneStatus.COMPLETED],
    ["dune-raiders", "Core traversal & combat prototype", -90, MilestoneStatus.COMPLETED],
    ["dune-raiders", "Milestone 3 — vertical slice", 5, MilestoneStatus.IN_PROGRESS],
    ["dune-raiders", "Content complete", 60, MilestoneStatus.PLANNED],
    ["dune-raiders", "Gold master", 95, MilestoneStatus.PLANNED],
    ["northwind-commerce", "Catalogue & search", -70, MilestoneStatus.COMPLETED],
    ["northwind-commerce", "Checkout & payments", -10, MilestoneStatus.COMPLETED],
    ["northwind-commerce", "Loyalty integration", 18, MilestoneStatus.IN_PROGRESS],
    ["northwind-commerce", "Launch", 40, MilestoneStatus.PLANNED],
    ["helios-mobile", "Auth & onboarding", -120, MilestoneStatus.COMPLETED],
    ["helios-mobile", "Accounts & transfers", -40, MilestoneStatus.MISSED],
    ["helios-mobile", "Security review", 20, MilestoneStatus.PLANNED],
    ["helios-mobile", "Store submission", 45, MilestoneStatus.PLANNED],
    ["kiro-puzzles", "Puzzle set A (30 levels)", -60, MilestoneStatus.COMPLETED],
    ["kiro-puzzles", "Puzzle set B (30 levels)", -5, MilestoneStatus.COMPLETED],
    ["kiro-puzzles", "Polish & store assets", 25, MilestoneStatus.IN_PROGRESS],
    ["asset-pipeline", "Ingestion service", 15, MilestoneStatus.IN_PROGRESS],
    ["asset-pipeline", "Unity & Unreal exporters", 75, MilestoneStatus.PLANNED],
  ];
  let order = 0;
  for (const [slug, title, days, status] of spec) {
    await db.milestone.create({ data: { projectId: projects[slug]!, title, dueDate: addDays(now, days), status, completedAt: status === MilestoneStatus.COMPLETED ? addDays(now, days - 1) : null, order: order++, isDemo: true } });
  }
  console.log("✓ demo milestones");
}

async function seedDemoWorkflows(): Promise<void> {
  const now = new Date();
  const h = (hours: number) => new Date(now.getTime() - hours * 3600_000);
  const flows: { name: string; description: string; enabled: boolean; steps: [StepKind, string, string][]; runs: [string, string, number][] }[] = [
    { name: "Deadline approaching → notify PM", description: "Seven days before a project deadline, notify the project manager with a readiness summary.", enabled: true,
      steps: [[StepKind.TRIGGER, "project.deadline_approaching", "Project deadline within 7 days"], [StepKind.CONDITION, "project.status_is", "Project is active"], [StepKind.AGENT, "agent.project_manager", "Project Manager agent summarises readiness"], [StepKind.ACTION, "notify.project_manager", "Notify project manager"]],
      runs: [["succeeded", "Kiro Puzzle Collection: PM notified, 4 open tasks", 6], ["succeeded", "Northwind Commerce Platform: PM notified", 30]] },
    { name: "Overdue task → flag for review", description: "When a task passes its due date, flag it and add it to the review queue.", enabled: true,
      steps: [[StepKind.TRIGGER, "task.overdue", "Task becomes overdue"], [StepKind.ACTION, "task.flag", "Flag task for review"]],
      runs: [["succeeded", "2 tasks flagged (Helios hotfix #1, Implement inventory system)", 3]] },
    { name: "Pending approval → follow-up draft", description: "After a client approval sits for 5 days, draft a follow-up for human sign-off.", enabled: true,
      steps: [[StepKind.TRIGGER, "approval.pending_days", "Approval pending > 5 days"], [StepKind.AGENT, "agent.client_business", "Client & Business agent drafts follow-up"], [StepKind.ACTION, "approval.request_human", "Request human approval to send"]],
      runs: [["awaiting_approval", "Helios Fintech follow-up drafted — awaiting approval", 7]] },
    { name: "Budget threshold → alert CEO", description: "Alert the CEO when a project's expenses exceed 80% of budget.", enabled: true,
      steps: [[StepKind.TRIGGER, "project.budget_threshold", "Expenses exceed 80% of budget"], [StepKind.AGENT, "agent.finance", "Finance agent explains the variance"], [StepKind.ACTION, "notify.ceo", "Alert CEO"]],
      runs: [] },
    { name: "New pull request → update project activity", description: "Record pull-request activity in the project timeline.", enabled: false,
      steps: [[StepKind.TRIGGER, "github.pull_request_opened", "Pull request opened"], [StepKind.ACTION, "activity.record", "Add activity entry"]],
      runs: [["failed", "GitHub integration not connected", 12]] },
    { name: "Invoice overdue → notify finance", description: "When an invoice passes its due date, notify the finance department and propose a reminder.", enabled: true,
      steps: [[StepKind.TRIGGER, "invoice.overdue", "Invoice past due date"], [StepKind.AGENT, "agent.finance", "Finance agent proposes a reminder"], [StepKind.ACTION, "notify.finance", "Notify finance department"]],
      runs: [["awaiting_approval", "DEMO-INV-1016 reminder proposed", 2], ["succeeded", "DEMO-INV-1012 finance notified", 26]] },
  ];
  for (const f of flows) {
    const wf = await db.workflow.create({ data: { name: f.name, description: f.description, enabled: f.enabled, isDemo: true, steps: { create: f.steps.map(([kind, type, label], i) => ({ order: i, kind, type, label })) } } });
    for (const [status, summary, hoursAgo] of f.runs) {
      await db.workflowRun.create({ data: { workflowId: wf.id, status, summary, startedAt: h(hoursAgo), durationMs: 800 + hoursAgo * 11, isDemo: true } });
    }
  }
  console.log(`✓ ${flows.length} demo workflows`);
}

async function main(): Promise<void> {
  await seedRolesAndDepartments();
  await seedAgents();
  await seedAdmin();
  if (env.DEMO_MODE) {
    await seedDemo();
    await seedDemoLogin();
  } else {
    console.log("• DEMO_MODE is off — no demo data seeded");
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

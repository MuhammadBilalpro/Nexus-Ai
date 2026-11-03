import type { LucideIcon } from "lucide-react";
import { Home, Sparkles, Bot, BarChart3, FolderKanban, Workflow, ShieldCheck } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: Home, description: "Your company at a glance" },
  { label: "Assistant", href: "/assistant", icon: Sparkles, description: "Ask anything about the business" },
  { label: "Agents", href: "/agents", icon: Bot, description: "Specialised AI agents and approvals" },
  { label: "Insights", href: "/insights", icon: BarChart3, description: "Revenue, profitability, performance" },
  { label: "Projects", href: "/projects", icon: FolderKanban, description: "Timeline, board, milestones" },
  { label: "Automation", href: "/automation", icon: Workflow, description: "Workflows connecting triggers, agents and actions" },
];

export const SECONDARY_NAV: NavItem[] = [{ label: "Security", href: "/settings/security", icon: ShieldCheck, description: "Two-factor, password, sessions" }];

import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FolderKanban, Wallet, Users, Briefcase, Bot, Workflow, ShieldCheck, Settings } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Items without a live route are rendered as non-interactive roadmap entries. */
  phase?: 2 | 3 | 4 | 5;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban, phase: 2 },
  { label: "Finance", href: "/finance", icon: Wallet, phase: 2 },
  { label: "Team", href: "/team", icon: Users, phase: 2 },
  { label: "Clients", href: "/clients", icon: Briefcase, phase: 2 },
  { label: "Command Center", href: "/agents", icon: Bot, phase: 3 },
  { label: "Automation", href: "/automation", icon: Workflow, phase: 4 },
];

export const SECONDARY_NAV: NavItem[] = [
  { label: "Security", href: "/settings/security", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings, phase: 2 },
];

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CheckSquare,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Radar,
  Settings,
  Users,
  Zap,
} from "lucide-react";

export interface ShellNavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  description: string;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: ShellNavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        path: "/",
        icon: LayoutDashboard,
        label: "Home",
        description: "Dashboard and overview",
      },
      {
        path: "/messages",
        icon: Mail,
        label: "Inbox",
        description: "Unified communication",
        badge: "3",
      },
      {
        path: "/tasks",
        icon: CheckSquare,
        label: "Tasks",
        description: "Priorities and owners",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        path: "/pipeline",
        icon: GitBranch,
        label: "Pipeline",
        description: "Deals and forecasting",
      },
      {
        path: "/clients",
        icon: Users,
        label: "Contacts",
        description: "People and companies",
      },
      {
        path: "/accounts",
        icon: Building2,
        label: "Accounts",
        description: "Account intelligence",
      },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        path: "/campaigns",
        icon: Megaphone,
        label: "Campaigns",
        description: "Lifecycle plays",
      },
      {
        path: "/analytics",
        icon: BarChart3,
        label: "Analytics",
        description: "Reports and performance",
      },
      {
        path: "/forecast",
        icon: Radar,
        label: "Forecast",
        description: "Commit and scenarios",
      },
    ],
  },
  {
    label: "Delivery",
    items: [
      {
        path: "/projects",
        icon: FolderKanban,
        label: "Projects",
        description: "Post-win delivery",
      },
      {
        path: "/service",
        icon: LifeBuoy,
        label: "Service",
        description: "SLA queue and retention",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        path: "/automations",
        icon: Zap,
        label: "Automations",
        description: "Rules and Workflows",
      },
    ],
  },
];

export const bottomNavItems: ShellNavItem[] = [
  {
    path: "/settings",
    icon: Settings,
    label: "Settings",
    description: "Preferences and integrations",
  },
];

export const primaryNavItems: ShellNavItem[] =
  navGroups.find((group) => group.label === "Workspace")?.items || [];

export const secondaryNavItems: ShellNavItem[] =
  navGroups.find((group) => group.label === "Growth")?.items || [];

const pageMetaEntries = [
  {
    match: (pathname: string) => pathname === "/",
    title: "Growth Overview",
    description:
      "One operating view for revenue, pipeline health, and conversations that need action.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/clients"),
    title: "Contacts Management",
    description: "Keep people, companies, notes, and ownership in one relationship record.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/accounts"),
    title: "Accounts Intelligence",
    description: "Manage account health, champions, renewals, and expansion coverage.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/pipeline"),
    title: "Deals Workspace",
    description: "Move opportunities cleanly from pipeline to delivery without losing context.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/projects"),
    title: "Projects Workspace",
    description: "Deliver won deals with clear owner accountability and milestone control.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/inbox"),
    title: "Email Inbox",
    description: "View and manage your synced email conversations.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/messages"),
    title: "Communication Hub",
    description: "Keep email, chat, and follow-ups inside one unified inbox.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/tasks"),
    title: "Execution Queue",
    description: "Turn follow-ups and internal work into one calm daily queue.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/automations"),
    title: "Workflow Engine",
    description: "Automate routing, reminders, and stage-based actions without extra noise.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/campaigns"),
    title: "Campaign Command",
    description: "Coordinate lifecycle campaigns and connect outreach to influenced revenue.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/forecast"),
    title: "Forecast Control",
    description: "Track commit, upside, and risk scenarios with deal-level confidence.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/analytics"),
    title: "Performance Analytics",
    description: "Go deeper on growth, forecasting, conversion, and response performance.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/service"),
    title: "Service Desk",
    description: "Protect customer health with SLA triage, escalations, and resolution playbooks.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/settings"),
    title: "Workspace Settings",
    description: "Adjust preferences, connections, and account controls.",
  },
];

export function getPageMeta(pathname: string) {
  return (
    pageMetaEntries.find((entry) => entry.match(pathname)) ?? {
      title: "CRMP by EmirCo",
      description: "Revenue operating system",
    }
  );
}

const knownAppPaths = [
  "/",
  "/clients",
  "/accounts",
  "/pipeline",
  "/projects",
  "/messages",
  "/tasks",
  "/automations",
  "/campaigns",
  "/forecast",
  "/analytics",
  "/service",
  "/settings",
] as const;

export function isKnownAppPath(pathname: string) {
  if (!pathname.startsWith("/")) {
    return false;
  }

  return knownAppPaths.some((path) => {
    if (path === "/") {
      return pathname === "/";
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

import { NavLink, useLocation } from "react-router";

import type { Workspace } from "../lib/crm-api";
import { useCrmApp, type CrmConnectionState } from "../providers/CrmProvider";
import { BrandLockup, BrandMark } from "./Brand";
import { StatusBadge } from "./crm-ui";
import { navGroups, bottomNavItems, type ShellNavItem } from "./shell-nav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "./ui/sheet";
import { cn } from "./ui/utils";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function isItemActive(pathname: string, path: string) {
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

function SidebarBrand({
  compact = false,
  subtitle,
}: {
  compact?: boolean;
  subtitle: string;
}) {
  return (
    <NavLink
      to="/"
      className={cn(
        "block border-b border-sidebar-border/70 transition-colors hover:bg-sidebar-accent/70",
        compact ? "px-0 py-3" : "px-3 py-3",
      )}
    >
      {compact ? (
        <div className="flex justify-center">
          <BrandMark size="sm" className="size-9 rounded-xl shadow-none" />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <BrandLockup size="sm" showSubtitle={false} className="min-w-0 flex-1" />
          <div className="min-w-0 text-right">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Workspace
            </p>
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      )}
    </NavLink>
  );
}

function getConnectionCopy(connection: CrmConnectionState, workspace: Workspace) {
  if (connection === "fallback") {
    return {
      title: "Preview mode",
      detail: "Backend sync is offline.",
    };
  }

  if (connection === "guest") {
    return {
      title: "Guest workspace",
      detail: "Explore the shell before signup.",
    };
  }

  if (connection === "loading") {
    return {
      title: "Syncing",
      detail: "Refreshing CRM context.",
    };
  }

  if (connection === "bootstrapped") {
    return {
      title: "Starter data live",
      detail: `${workspace.name} is seeded and ready.`,
    };
  }

  return {
    title: "Workspace live",
    detail: `${workspace.name} is connected.`,
  };
}

function SidebarFooter({
  compact = false,
  connection,
  workspace,
}: {
  compact?: boolean;
  connection: CrmConnectionState;
  workspace: Workspace;
}) {
  const connectionCopy = getConnectionCopy(connection, workspace);

  if (compact) {
    return (
      <div className="border-t border-sidebar-border/70 px-0 py-3">
        <div className="flex flex-col items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-primary shadow-[0_0_0_4px_var(--color-neutral-soft)]" />
          <span className="rounded-full border border-sidebar-border bg-background px-1.5 py-0.5 font-metric text-[0.64rem] text-foreground">
            {workspace.stats.deals}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border/70 p-3">
      <div className="space-y-2.5 rounded-[calc(var(--radius)-2px)] border border-sidebar-border bg-background p-3">
        <div className="flex items-start gap-2">
          <span className="mt-1 inline-flex size-2 rounded-full bg-primary shadow-[0_0_0_4px_var(--color-neutral-soft)]" />
          <div className="min-w-0">
            <p className="text-[0.78rem] font-semibold text-foreground">{connectionCopy.title}</p>
            <p className="text-[0.72rem] leading-5 text-muted-foreground">
              {connectionCopy.detail}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-[0.66rem] text-muted-foreground">
          <div className="rounded-[calc(var(--radius)-5px)] border border-sidebar-border/80 bg-background px-2 py-1.5">
            <p className="font-metric text-[0.8rem] font-semibold text-foreground">
              {workspace.stats.members}
            </p>
            <p>Team</p>
          </div>
          <div className="rounded-[calc(var(--radius)-5px)] border border-sidebar-border/80 bg-background px-2 py-1.5">
            <p className="font-metric text-[0.8rem] font-semibold text-foreground">
              {workspace.stats.deals}
            </p>
            <p>Deals</p>
          </div>
          <div className="rounded-[calc(var(--radius)-5px)] border border-sidebar-border/80 bg-background px-2 py-1.5">
            <p className="font-metric text-[0.8rem] font-semibold text-foreground">
              {workspace.stats.messages}
            </p>
            <p>Inbox</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarNavItem({
  item,
  compact = false,
  onNavigate,
}: {
  item: ShellNavItem;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const active = isItemActive(location.pathname, item.path);
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={compact ? item.label : item.description}
      className={cn(
        "group relative flex items-center transition-[background-color,border-color,color] duration-200",
        compact
          ? "mx-auto size-10 justify-center rounded-[calc(var(--radius)-3px)] border"
          : "gap-2.5 rounded-[calc(var(--radius)-2px)] border px-2.5 py-2",
        active
          ? "border-sidebar-border bg-sidebar-accent text-foreground"
          : "border-transparent text-muted-foreground hover:border-sidebar-border/70 hover:bg-sidebar-accent/70 hover:text-foreground",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-[calc(var(--radius)-4px)] transition-colors duration-200",
          compact ? "size-7" : "size-7 border",
          active
            ? "border-primary/18 bg-background text-primary"
            : compact
              ? "text-muted-foreground group-hover:text-foreground"
              : "border-sidebar-border/70 bg-background text-muted-foreground group-hover:border-primary/14 group-hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>

      {!compact ? (
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[0.8rem] font-semibold text-current">{item.label}</p>
            {item.badge ? (
              <StatusBadge tone="info" className="px-1.5 py-0 text-[0.62rem]">
                {item.badge}
              </StatusBadge>
            ) : null}
          </div>
        </div>
      ) : item.badge ? (
        <span className="absolute top-0.5 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full border border-info/18 bg-info-soft px-1 text-[0.56rem] font-semibold text-info">
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function SidebarNav({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={cn(
        "flex flex-1 flex-col gap-6 overflow-y-auto",
        compact ? "px-2 py-3" : "px-3 py-3",
      )}
    >
      {navGroups.map((group, index) => (
        <div key={group.label} className="space-y-4">
          <div className="space-y-2">
            {!compact ? (
              <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/50">
                {group.label}
              </p>
            ) : index > 0 ? (
              <div className="my-2 mx-auto h-px w-6 bg-sidebar-border/50" />
            ) : null}
            <div className={cn("space-y-1", compact && "flex flex-col items-center")}>
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.path}
                  item={item}
                  compact={compact}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
      
      <div className="mt-auto pt-6 space-y-2">
        <div className={cn("space-y-1", compact && "flex flex-col items-center")}>
          {bottomNavItems.map((item) => (
            <SidebarNavItem
              key={item.path}
              item={item}
              compact={compact}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

function SidebarPanel({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { connection, workspace } = useCrmApp();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <SidebarBrand compact={compact} subtitle={workspace.name} />
      <SidebarNav compact={compact} onNavigate={onNavigate} />
      <SidebarFooter compact={compact} connection={connection} workspace={workspace} />
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  return (
    <>
      <aside className="hidden h-screen shrink-0 border-r border-sidebar-border/70 bg-sidebar xl:block xl:w-[16rem]">
        <SidebarPanel />
      </aside>

      <aside className="hidden h-screen shrink-0 border-r border-sidebar-border/70 bg-sidebar md:block xl:hidden">
        <div className="w-[4.5rem]">
          <SidebarPanel compact />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[86vw] max-w-[19rem] border-r border-sidebar-border/70 bg-sidebar p-0 sm:max-w-[19rem]"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            CRM navigation and workspace shortcuts
          </SheetDescription>
          <SidebarPanel onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

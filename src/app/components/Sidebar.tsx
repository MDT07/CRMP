import { NavLink, useLocation } from "react-router";
import type { Workspace } from "../lib/crm-api";
import { type CrmConnectionState, useCrmApp } from "../providers/CrmProvider";
import { BrandLockup, BrandMark } from "./Brand";
import { StatusBadge } from "./crm-ui";
import { bottomNavItems, navGroups, type ShellNavItem } from "./shell-nav";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { cn } from "./ui/utils";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function isItemActive(pathname: string, path: string) {
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

function SidebarBrand({ compact = false, subtitle }: { compact?: boolean; subtitle: string }) {
  return (
    <NavLink
      to="/"
      className={cn(
        "block border-b border-sidebar-border transition-colors hover:bg-sidebar-accent/50",
        compact ? "px-0 py-3" : "px-4 py-4"
      )}
    >
      {compact ? (
        <div className="flex justify-center">
          <BrandMark size="sm" className="size-9 rounded-xl shadow-none" variant="gradient" />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <BrandLockup
            size="sm"
            showSubtitle={false}
            className="min-w-0 flex-1"
            variant="gradient"
          />
          <div className="min-w-0 text-right">
            <p className="text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Workspace
            </p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
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
      tone: "warning" as const,
    };
  }

  if (connection === "guest") {
    return {
      title: "Guest workspace",
      detail: "Explore the shell before signup.",
      tone: "info" as const,
    };
  }

  if (connection === "loading") {
    return {
      title: "Syncing",
      detail: "Refreshing CRM context.",
      tone: "info" as const,
    };
  }

  if (connection === "bootstrapped") {
    return {
      title: "Starter data live",
      detail: `${workspace.name} is seeded and ready.`,
      tone: "success" as const,
    };
  }

  return {
    title: "Workspace live",
    detail: `${workspace.name} is connected.`,
    tone: "success" as const,
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
      <div className="border-t border-sidebar-border px-0 py-3">
        <div className="flex flex-col items-center gap-2">
          <span
            className={cn(
              "inline-flex size-2.5 rounded-full",
              connectionCopy.tone === "success" &&
                "bg-success shadow-[0_0_8px_rgba(52,199,89,0.5)]",
              connectionCopy.tone === "warning" &&
                "bg-warning shadow-[0_0_8px_rgba(255,149,0,0.5)]",
              connectionCopy.tone === "info" && "bg-info shadow-[0_0_8px_rgba(0,113,227,0.5)]"
            )}
          />
          <span className="rounded-full border border-sidebar-border bg-background px-2 py-0.5 font-metric text-[0.6rem] text-foreground">
            {workspace.stats.deals}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border p-4">
      <div className="space-y-3 rounded-2xl border border-sidebar-border bg-background/50 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 inline-flex size-2.5 rounded-full",
              connectionCopy.tone === "success" &&
                "bg-success shadow-[0_0_8px_rgba(52,199,89,0.5)]",
              connectionCopy.tone === "warning" &&
                "bg-warning shadow-[0_0_8px_rgba(255,149,0,0.5)]",
              connectionCopy.tone === "info" && "bg-info shadow-[0_0_8px_rgba(0,113,227,0.5)]"
            )}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{connectionCopy.title}</p>
            <p className="text-[0.7rem] leading-4 text-muted-foreground">{connectionCopy.detail}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[0.65rem] text-muted-foreground">
          <div className="rounded-xl border border-sidebar-border/60 bg-background px-2 py-2 text-center">
            <p className="font-metric text-sm font-semibold text-foreground">
              {workspace.stats.members}
            </p>
            <p className="mt-0.5 text-[0.6rem]">Team</p>
          </div>
          <div className="rounded-xl border border-sidebar-border/60 bg-background px-2 py-2 text-center">
            <p className="font-metric text-sm font-semibold text-foreground">
              {workspace.stats.deals}
            </p>
            <p className="mt-0.5 text-[0.6rem]">Deals</p>
          </div>
          <div className="rounded-xl border border-sidebar-border/60 bg-background px-2 py-2 text-center">
            <p className="font-metric text-sm font-semibold text-foreground">
              {workspace.stats.messages}
            </p>
            <p className="mt-0.5 text-[0.6rem]">Inbox</p>
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
        "group relative flex items-center transition-all duration-200",
        compact ? "mx-auto size-11 justify-center rounded-xl" : "gap-3 rounded-xl px-3 py-2.5",
        active
          ? "bg-primary-soft text-primary shadow-sm"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-lg transition-all duration-200",
          compact ? "size-9" : "size-8",
          active
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
            : "bg-surface-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className={cn("transition-transform duration-200", active && "scale-110")} />
      </div>

      {!compact ? (
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[0.8rem] font-semibold text-current">{item.label}</p>
            {item.badge ? (
              <StatusBadge tone="info" size="sm" className="px-1.5 py-0">
                {item.badge}
              </StatusBadge>
            ) : null}
          </div>
        </div>
      ) : item.badge ? (
        <span className="absolute top-0.5 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-info text-[0.55rem] font-bold text-white px-1">
          {item.badge}
        </span>
      ) : null}

      {/* Active indicator line */}
      {active && !compact && (
        <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
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
        compact ? "px-2 py-4" : "px-3 py-4"
      )}
    >
      {navGroups.map((group, index) => (
        <div key={group.label} className="space-y-3">
          <div className="space-y-1.5">
            {!compact ? (
              <p className="px-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                {group.label}
              </p>
            ) : index > 0 ? (
              <div className="my-2 mx-auto h-px w-5 bg-sidebar-border/40" />
            ) : null}
            <div className={cn("space-y-0.5", compact && "flex flex-col items-center")}>
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

      <div className="mt-auto pt-4 space-y-1.5">
        <div className={cn("space-y-0.5", compact && "flex flex-col items-center")}>
          {bottomNavItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} compact={compact} onNavigate={onNavigate} />
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
      <aside className="hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar xl:block xl:w-64">
        <SidebarPanel />
      </aside>

      <aside className="hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar md:block xl:hidden">
        <div className="w-[4.5rem]">
          <SidebarPanel compact />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[86vw] max-w-[20rem] border-r border-sidebar-border bg-sidebar p-0 sm:max-w-[20rem]"
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

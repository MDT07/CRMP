import {
  Bell,
  CalendarClock,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  MoonStar,
  Plus,
  Settings2,
  SunMedium,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { createTask, type Workspace, type WorkspaceRole } from "../lib/crm-api";
import { createLocalQuickTask } from "../lib/local-task-store";
import { useCrmApp } from "../providers/CrmProvider";
import { useTheme } from "../providers/ThemeProvider";
import { BrandMark } from "./Brand";
import { StatusBadge } from "./crm-ui";
import { SmartActionButton } from "./crm-ui/smart-action-button";
import { getPageMeta } from "./shell-nav";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";

interface TopBarProps {
  onOpenNavigation: () => void;
}

interface HeaderPulse {
  label: string;
  value: string;
}

type UserPresence = "available" | "focus" | "dnd";

const USER_PRESENCE_STORAGE_KEY = "crmp.user.presence";

const PRESENCE_STYLES: Record<
  UserPresence,
  { label: string; detail: string; dotClassName: string }
> = {
  available: {
    label: "Available",
    detail: "Ready for calls and inbox follow-ups",
    dotClassName: "bg-success",
  },
  focus: {
    label: "Focus",
    detail: "Heads-down execution mode",
    dotClassName: "bg-info",
  },
  dnd: {
    label: "Do not disturb",
    detail: "Urgent items only",
    dotClassName: "bg-warning",
  },
};

function toDueAtIso(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T17:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatRole(role?: WorkspaceRole) {
  if (!role) {
    return "Workspace lead";
  }

  if (role === "rep") {
    return "Representative";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getHeaderPulse(pathname: string, workspace: Workspace): HeaderPulse {
  if (pathname === "/") {
    return { label: "Revenue pulse", value: `${workspace.stats.deals} active deals` };
  }

  if (pathname.startsWith("/clients")) {
    return { label: "Contacts", value: `${workspace.stats.contacts} contacts` };
  }

  if (pathname.startsWith("/pipeline")) {
    return { label: "Pipeline", value: `${workspace.stats.deals} tracked deals` };
  }

  if (pathname.startsWith("/projects")) {
    return { label: "Projects", value: `${workspace.stats.projects} delivery projects` };
  }

  if (pathname.startsWith("/messages")) {
    return { label: "Inbox", value: `${workspace.stats.messages} conversations` };
  }

  if (pathname.startsWith("/tasks")) {
    return { label: "Tasks", value: `${workspace.stats.tasks} open tasks` };
  }

  if (pathname.startsWith("/accounts")) {
    return { label: "Accounts", value: `${workspace.stats.companies} active accounts` };
  }

  if (pathname.startsWith("/forecast")) {
    return { label: "Forecast", value: `${workspace.stats.deals} weighted opportunities` };
  }

  if (pathname.startsWith("/campaigns")) {
    return { label: "Campaigns", value: `${workspace.stats.contacts} reachable contacts` };
  }

  if (pathname.startsWith("/service")) {
    return { label: "Service", value: `${workspace.stats.messages} live threads` };
  }

  if (pathname.startsWith("/analytics")) {
    return { label: "Forecast", value: `${workspace.stats.companies} tracked accounts` };
  }

  if (pathname.startsWith("/automations")) {
    return { label: "Automation", value: workspace.crm_ready ? "Rules ready" : "Seed data first" };
  }

  if (pathname.startsWith("/settings")) {
    return { label: "Workspace", value: `${workspace.stats.members} teammates` };
  }

  return { label: "Workspace", value: workspace.name };
}

export function TopBar({ onOpenNavigation }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection, isGuest, signOut, user, workspace } = useCrmApp();
  const { resolvedTheme, toggleTheme } = useTheme();
  const meta = getPageMeta(location.pathname);
  const pulse = getHeaderPulse(location.pathname, workspace);
  const connectionTone =
    connection === "fallback"
      ? "warning"
      : connection === "guest"
        ? "info"
        : connection === "loading"
          ? "info"
          : "success";
  const connectionLabel =
    connection === "fallback"
      ? "Preview mode"
      : connection === "guest"
        ? "Guest mode"
        : connection === "loading"
          ? "Syncing"
          : connection === "bootstrapped"
            ? "Starter data"
            : "Workspace live";
  const userInitial = user?.name?.slice(0, 1).toUpperCase() ?? (isGuest ? "G" : "E");
  const userSubtitle =
    connection === "fallback"
      ? "Preview workspace"
      : connection === "guest"
        ? "Guest access"
        : formatRole(user?.role);
  const userMeta =
    user?.email ??
    (connection === "guest"
      ? "Guest access"
      : connection === "fallback"
        ? "Preview workspace"
        : (workspace.domain ?? "Workspace access"));
  const [presence, setPresence] = useState<UserPresence>("available");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskClient, setQuickTaskClient] = useState("");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [quickTaskSaving, setQuickTaskSaving] = useState(false);

  useEffect(() => {
    const storedPresence = window.localStorage.getItem(USER_PRESENCE_STORAGE_KEY);
    if (storedPresence === "available" || storedPresence === "focus" || storedPresence === "dnd") {
      setPresence(storedPresence);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(USER_PRESENCE_STORAGE_KEY, presence);
  }, [presence]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const isQuickCaptureShortcut =
        (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "n";

      if (isQuickCaptureShortcut) {
        event.preventDefault();
        setQuickTaskOpen(true);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const openQuickTaskDialog = () => {
    setQuickTaskOpen(true);
  };

  const closeQuickTaskDialog = () => {
    setQuickTaskOpen(false);
    setQuickTaskTitle("");
    setQuickTaskClient("");
    setQuickTaskDueDate("");
    setQuickTaskSaving(false);
  };

  const submitQuickTask = async () => {
    const title = quickTaskTitle.trim();
    if (!title) {
      toast.error("Task title is required", {
        description: "Add a title before saving the quick capture.",
      });
      return;
    }

    const dueAt = toDueAtIso(quickTaskDueDate);
    const client = quickTaskClient.trim() || "Internal";
    const assigneeLabel = user?.name ?? "You";

    setQuickTaskSaving(true);

    if (connection === "live" || connection === "bootstrapped") {
      try {
        await createTask({
          title,
          assignee_id: user?.id ?? null,
          due_at: dueAt,
          status: "open",
          source: "manual",
          description: client === "Internal" ? null : `Client context: ${client}`,
        });

        toast.success("Task captured", {
          description: "Saved to the live workspace queue.",
        });
        closeQuickTaskDialog();
        navigate("/tasks");
        return;
      } catch (error) {
        console.warn("Live quick task save failed, storing locally.", error);
      }
    }

    createLocalQuickTask({
      title,
      client,
      due_at: dueAt,
      assignee: assigneeLabel,
    });
    toast.warning("Task captured locally", {
      description: "Backend is unavailable, so this task was stored in local quick capture.",
    });
    closeQuickTaskDialog();
    navigate("/tasks");
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3 sm:px-4 lg:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onOpenNavigation}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex min-w-0 items-center gap-2.5 rounded-[calc(var(--radius)-3px)] px-1.5 py-1 transition-colors hover:bg-accent"
            aria-label="Go to CRMP by EmirCo home"
          >
            <BrandMark size="sm" className="hidden size-8 rounded-[0.8rem] shadow-none sm:flex" />
            <div className="min-w-0 text-left">
              <p className="truncate text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {workspace.name}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{meta.title}</p>
            </div>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:flex items-center gap-1.5">
              <StatusBadge tone={connectionTone}>{connectionLabel}</StatusBadge>
              <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-muted px-2.5 text-[0.66rem] font-medium text-muted-foreground">
                {pulse.label}: {pulse.value}
              </span>
            </div>

            <SmartActionButton
              label="Quick Add"
              icon={Plus}
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => navigate("/pipeline")}
              items={[
                {
                  label: "Open deal board",
                  description: "Jump straight to pipeline and create the next opportunity.",
                  onSelect: () => navigate("/pipeline"),
                },
                {
                  label: "Capture task",
                  description: "Create a task instantly from the header command bar.",
                  icon: CalendarClock,
                  onSelect: openQuickTaskDialog,
                },
                {
                  label: "Open contact intake",
                  description: "Add or enrich a contact from the contacts workspace.",
                  onSelect: () => navigate("/clients"),
                },
              ]}
            />

            <Button
              variant="outline"
              size="icon"
              className="sm:hidden"
              onClick={openQuickTaskDialog}
              aria-label="Quick capture task"
            >
              <Plus className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={toggleTheme}
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? (
                <SunMedium className="size-4" />
              ) : (
                <MoonStar className="size-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
              onClick={() => navigate("/messages")}
            >
              <Bell className="size-4" />
              {workspace.stats.messages > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warning" />
              ) : null}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-2.5 rounded-[calc(var(--radius)-3px)] border border-border bg-surface-muted px-2.5 py-1.5 transition-colors hover:border-primary hover:bg-accent"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg border border-primary bg-primary font-metric text-[0.82rem] font-semibold text-primary-foreground">
                    {userInitial}
                  </div>
                  <div className="hidden min-w-0 text-left lg:block">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user?.name ?? workspace.name}
                    </p>
                    <p className="truncate text-[0.66rem] text-muted-foreground">
                      {userSubtitle} · {PRESENCE_STYLES[presence].label}
                    </p>
                  </div>
                  <div className="hidden xl:flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        PRESENCE_STYLES[presence].dotClassName
                      )}
                    />
                    {workspace.stats.tasks} tasks
                  </div>
                  <ChevronDown className="hidden size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 rounded-[calc(var(--radius)-1px)] border-border bg-popover p-1.5 shadow-[var(--shadow-elevated)]"
              >
                <DropdownMenuLabel className="space-y-2 px-2.5 py-2">
                  <p className="text-[0.82rem] font-semibold text-foreground">
                    {user?.name ?? workspace.name}
                  </p>
                  <p className="text-[0.72rem] text-muted-foreground">{userMeta}</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-lg border border-border bg-surface-muted px-2 py-1.5">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Open tasks
                      </p>
                      <p className="mt-1 text-[0.82rem] font-semibold text-foreground">
                        {workspace.stats.tasks}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-muted px-2 py-1.5">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Inbox load
                      </p>
                      <p className="mt-1 text-[0.82rem] font-semibold text-foreground">
                        {workspace.stats.messages}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/messages")}>
                  <Bell className="size-4" />
                  Inbox triage queue
                  <DropdownMenuShortcut>G I</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/tasks")}>
                  <Command className="size-4" />
                  Personal execution queue
                  <DropdownMenuShortcut>G T</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openQuickTaskDialog}>
                  <CalendarClock className="size-4" />
                  Quick capture task
                  <DropdownMenuShortcut>⌘⇧N</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings2 className="size-4" />
                  Open settings
                  <DropdownMenuShortcut>G S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Availability
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={presence}
                  onValueChange={(value) => setPresence(value as UserPresence)}
                >
                  <DropdownMenuRadioItem value="available" className="text-sm">
                    {PRESENCE_STYLES.available.label}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="focus" className="text-sm">
                    {PRESENCE_STYLES.focus.label}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dnd" className="text-sm">
                    {PRESENCE_STYLES.dnd.label}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                  {PRESENCE_STYLES[presence].detail}
                </p>
                {user || isGuest ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        void handleSignOut();
                      }}
                    >
                      <LogOut className="size-4" />
                      {isGuest ? "Exit guest mode" : "Sign out"}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Dialog
        open={quickTaskOpen}
        onOpenChange={(open) => {
          if (open) {
            setQuickTaskOpen(true);
          } else {
            closeQuickTaskDialog();
          }
        }}
      >
        <DialogContent className="max-w-xl border-border bg-canvas-strong p-0 shadow-[var(--shadow-elevated)]">
          <div className="border-b border-border px-5 py-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base">Quick Task Capture</DialogTitle>
              <DialogDescription className="text-sm leading-5">
                Save a task from anywhere in the CRM. Uses live API when available, local queue when
                offline.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Task title
              </label>
              <Input
                value={quickTaskTitle}
                onChange={(event) => setQuickTaskTitle(event.target.value)}
                placeholder="Follow up with NovaStar expansion committee"
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Client or context
                </label>
                <Input
                  value={quickTaskClient}
                  onChange={(event) => setQuickTaskClient(event.target.value)}
                  placeholder="NovaStar Ltd"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Due date
                </label>
                <Input
                  type="date"
                  value={quickTaskDueDate}
                  onChange={(event) => setQuickTaskDueDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge
                tone={
                  connection === "live" || connection === "bootstrapped" ? "success" : "warning"
                }
              >
                {connection === "live" || connection === "bootstrapped"
                  ? "Will write to live workspace"
                  : "Will save to local queue"}
              </StatusBadge>
              <StatusBadge tone="info">Shortcut: Cmd/Ctrl + Shift + N</StatusBadge>
            </div>
          </div>

          <DialogFooter className="border-t border-border px-5 py-4 sm:justify-between">
            <Button variant="ghost" onClick={closeQuickTaskDialog} disabled={quickTaskSaving}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => {
                void submitQuickTask();
              }}
              disabled={quickTaskSaving}
            >
              {quickTaskSaving ? "Saving..." : "Save Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

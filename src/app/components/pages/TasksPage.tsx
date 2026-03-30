import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Calendar,
  Check,
  CloudUpload,
  Clock,
  Flag,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  type LucideIcon,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  createTask,
  fetchContacts,
  fetchDeals,
  fetchTasks,
  updateTask,
  type TaskStatus,
} from "../../lib/crm-api";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { formatDueLabel } from "../../lib/crm-format";
import {
  createLocalQuickTask,
  isLocalQuickTaskId,
  listLocalQuickTasks,
  removeLocalQuickTask,
  removeLocalQuickTasks,
  subscribeToLocalQuickTasks,
  updateLocalQuickTask,
  updateLocalQuickTaskStatus,
  type LocalQuickTask,
} from "../../lib/local-task-store";
import { useCrmApp } from "../../providers/CrmProvider";
import { PageHeader, SmartActionButton, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type TaskPriority = "High" | "Medium" | "Low";

interface TaskRow {
  id: number | string;
  title: string;
  client: string;
  due: string;
  dueAt?: string | null;
  priority: TaskPriority;
  assignee: string;
  done: boolean;
  status: TaskStatus;
  contextNote?: string | null;
  isLocal?: boolean;
}

const fallbackTasks: TaskRow[] = [
  { id: 1, title: "Send updated proposal to TechCorp", client: "James Hartwell", due: "Today", priority: "High", assignee: "Alex", done: false, status: "open" },
  { id: 2, title: "Follow up with NovaStar Ltd", client: "Aisha Patel", due: "Today", priority: "High", assignee: "Alex", done: false, status: "open" },
  { id: 3, title: "Prepare Q1 sales report", client: "Internal", due: "Mar 16", priority: "Medium", assignee: "Alex", done: false, status: "in_progress" },
  { id: 4, title: "Schedule onboarding call with Orbit Tech", client: "Daniel Kim", due: "Mar 17", priority: "Medium", assignee: "Sarah", done: false, status: "open" },
  { id: 5, title: "Review contract — Nexus Corp", client: "Sarah Mitchell", due: "Mar 18", priority: "High", assignee: "Alex", done: false, status: "open" },
  { id: 6, title: "Update CRM with new leads", client: "Internal", due: "Mar 19", priority: "Low", assignee: "Tom", done: false, status: "open" },
  { id: 7, title: "Send welcome email sequence", client: "CloudBase Inc.", due: "Mar 20", priority: "Medium", assignee: "Alex", done: true, status: "done" },
  { id: 8, title: "Demo call with BlueSky Digital", client: "Lena Vogt", due: "Mar 14", priority: "High", assignee: "Alex", done: true, status: "done" },
  { id: 9, title: "Collect feedback from Vertex Solutions", client: "Carlos Mendes", due: "Mar 12", priority: "Low", assignee: "Sarah", done: true, status: "done" },
];

const taskTemplates = [
  { title: "Review expansion brief for Quantum AI", client: "Lily Wang", dueInDays: 1, priority: "High" as const },
  { title: "Send recap notes to Orbit Technologies", client: "Daniel Kim", dueInDays: 3, priority: "Medium" as const },
  { title: "Clean inbound lead tags", client: "Internal", dueInDays: 5, priority: "Low" as const },
];

const priorityConfig: Record<
  TaskPriority,
  { tone: "warning" | "info" | "neutral"; icon: LucideIcon }
> = {
  High: { tone: "warning", icon: AlertCircle },
  Medium: { tone: "info", icon: Clock },
  Low: { tone: "neutral", icon: Flag },
};

const workflowStatusConfig: Record<
  TaskStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" }
> = {
  open: { label: "Open", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  done: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function getPriorityFromDueDate(dueAt?: string | null): TaskPriority {
  if (!dueAt) {
    return "Low";
  }

  const diffMs = new Date(dueAt).getTime() - Date.now();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);

  if (diffDays <= 1) {
    return "High";
  }

  if (diffDays <= 4) {
    return "Medium";
  }

  return "Low";
}

function addDays(days: number) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString();
}

function toDueAtIso(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  const nextDate = new Date(`${dateValue}T17:00:00`);
  if (Number.isNaN(nextDate.getTime())) {
    return null;
  }

  return nextDate.toISOString();
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function extractClientContext(description?: string | null) {
  if (!description) {
    return null;
  }

  const prefix = "Client context:";
  if (!description.startsWith(prefix)) {
    return null;
  }

  const context = description.slice(prefix.length).trim();
  return context || null;
}

function buildTaskRows(
  tasks: Awaited<ReturnType<typeof fetchTasks>>,
  contacts: Awaited<ReturnType<typeof fetchContacts>>,
  deals: Awaited<ReturnType<typeof fetchDeals>>,
  currentUserName?: string,
  currentUserId?: string,
) {
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const dealMap = new Map(deals.map((deal) => [deal.id, deal]));

  return [...tasks]
    .sort((left, right) => {
      const leftValue = left.due_at ? new Date(left.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightValue = right.due_at ? new Date(right.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return leftValue - rightValue;
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      client:
        (task.contact_id ? contactMap.get(task.contact_id)?.name : undefined) ??
        (task.deal_id ? dealMap.get(task.deal_id)?.title : undefined) ??
        extractClientContext(task.description) ??
        "Internal",
      due: formatDueLabel(task.due_at),
      dueAt: task.due_at ?? null,
      priority: getPriorityFromDueDate(task.due_at),
      assignee:
        task.assignee_id && task.assignee_id === currentUserId
          ? currentUserName ?? "You"
          : task.assignee_id
            ? "Teammate"
            : "Unassigned",
      done: task.status === "done",
      status: task.status,
      contextNote: extractClientContext(task.description),
      isLocal: false,
    }));
}

function buildLocalTaskRows(tasks: LocalQuickTask[]) {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    client: task.client,
    due: formatDueLabel(task.due_at),
    dueAt: task.due_at ?? null,
    priority: getPriorityFromDueDate(task.due_at),
    assignee: task.assignee,
    done: task.status === "done",
    status: task.status,
    contextNote: task.client === "Internal" ? null : task.client,
    isLocal: true,
  }));
}

export function TasksPage() {
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    setAssistantSelection,
    user,
  } = useCrmApp();
  const guestPreviewMessage =
    "Guest mode is showing demo task data so you can explore the CRM without registration.";
  const [tasks, setTasks] = useState(fallbackTasks);
  const [localTasks, setLocalTasks] = useState<LocalQuickTask[]>(() =>
    listLocalQuickTasks(),
  );
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [taskEditTitle, setTaskEditTitle] = useState("");
  const [taskEditContext, setTaskEditContext] = useState("");
  const [taskEditDueDate, setTaskEditDueDate] = useState("");
  const [taskEditStatus, setTaskEditStatus] = useState<TaskStatus>("open");
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [error, setError] = useState<string | null>(
    connection === "fallback"
      ? "Backend connection is unavailable, so the tasks workspace is showing preview data."
      : isGuest
        ? guestPreviewMessage
      : null,
  );
  const sourceTone =
    dataSource === "live" ? "success" : dataSource === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    dataSource === "live"
      ? "Live tasks"
      : dataSource === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest tasks"
          : "Preview tasks";

  const loadTasks = async () => {
    const [contactRecords, dealRecords, taskRecords] = await Promise.all([
      fetchContacts(),
      fetchDeals(),
      fetchTasks(),
    ]);

    setContactIds(contactRecords.map((contact) => contact.id));
    setTasks(buildTaskRows(taskRecords, contactRecords, dealRecords, user?.name, user?.id));
    setDataSource("live");
    setError(null);
  };

  useEffect(() => {
    const syncLocalTasks = () => {
      setLocalTasks(listLocalQuickTasks());
    };

    return subscribeToLocalQuickTasks(syncLocalTasks);
  }, []);

  useEffect(() => {
    if (connection === "loading") {
      setDataSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setDataSource("preview");
      setError(
        connection === "fallback"
          ? "Backend connection is unavailable, so the tasks workspace is showing preview data."
          : guestPreviewMessage,
      );
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        await loadTasks();
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Tasks workspace fell back to preview data.", loadError);
        setDataSource("preview");
        setError(
          isGuest
            ? guestPreviewMessage
            : "Using preview task data because the live tasks could not be loaded.",
        );
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [connection, user?.id, user?.name]);

  useEffect(() => {
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Tasks",
        route: "/tasks",
        dataSource,
        selectedEntities: tasks.slice(0, 6).map((task) => ({
          entity_type: "task",
          entity_id: String(task.id),
        })),
        summary: "Task execution and follow-up context",
      }),
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, dataSource, setAssistantSelection, tasks]);

  const mergedTasks = [...buildLocalTaskRows(localTasks), ...tasks];
  const localPendingCount = localTasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  ).length;
  const canSyncLocalTasks =
    localTasks.length > 0 && (connection === "live" || connection === "bootstrapped");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filtered = mergedTasks.filter((task) =>
    (filter === "all" ? true : filter === "done" ? task.done : !task.done)
    && (priorityFilter === "all" ? true : task.priority === priorityFilter)
    && (
      normalizedSearch.length === 0
      || `${task.title} ${task.client} ${task.assignee}`
        .toLowerCase()
        .includes(normalizedSearch)
    ),
  );
  const completedCount = mergedTasks.filter((task) => task.done).length;
  const pendingCount = mergedTasks.length - completedCount;

  const applyTaskStatus = async (task: TaskRow, status: TaskStatus) => {
    if (task.status === status) {
      return;
    }

    if (typeof task.id === "string" && isLocalQuickTaskId(task.id)) {
      updateLocalQuickTaskStatus(task.id, status);
      return;
    }

    if (dataSource === "live") {
      setIsSaving(true);
      try {
        await updateTask(String(task.id), { status });
        await loadTasks();
      } catch (updateError) {
        console.error(updateError);
        toast.error("Could not update task", {
          description: "The task workflow state could not be changed right now.",
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setTasks((previous) =>
      previous.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              status,
              done: status === "done",
            }
          : entry,
      ),
    );
  };

  const applyBulkStatus = async (nextStatus: TaskStatus) => {
    const targets = filtered.filter((task) => task.status !== nextStatus);
    if (targets.length === 0) {
      toast.info("No matching tasks", {
        description: "The visible queue is already in that workflow state.",
      });
      return;
    }

    const localTargets = targets.filter(
      (task) => typeof task.id === "string" && isLocalQuickTaskId(task.id),
    );
    const remoteTargets = targets.filter(
      (task) => !(typeof task.id === "string" && isLocalQuickTaskId(task.id)),
    );

    for (const task of localTargets) {
      if (typeof task.id === "string") {
        updateLocalQuickTaskStatus(task.id, nextStatus);
      }
    }

    if (remoteTargets.length === 0) {
      toast.success("Bulk update complete", {
        description: `${targets.length} task${targets.length === 1 ? "" : "s"} moved to ${workflowStatusConfig[nextStatus].label.toLowerCase()}.`,
      });
      return;
    }

    if (dataSource === "live") {
      setIsSaving(true);
      let failedCount = 0;
      for (const task of remoteTargets) {
        try {
          await updateTask(String(task.id), { status: nextStatus });
        } catch (updateError) {
          failedCount += 1;
          console.warn("Bulk task status update failed", updateError);
        }
      }

      try {
        await loadTasks();
      } catch (refreshError) {
        console.warn("Could not refresh tasks after bulk update", refreshError);
      } finally {
        setIsSaving(false);
      }

      if (failedCount > 0) {
        toast.warning("Bulk update partially applied", {
          description: `${targets.length - failedCount} updated, ${failedCount} failed.`,
        });
      } else {
        toast.success("Bulk update complete", {
          description: `${targets.length} task${targets.length === 1 ? "" : "s"} moved to ${workflowStatusConfig[nextStatus].label.toLowerCase()}.`,
        });
      }
      return;
    }

    const targetIds = new Set(remoteTargets.map((task) => task.id));
    setTasks((previous) =>
      previous.map((task) =>
        targetIds.has(task.id)
          ? { ...task, status: nextStatus, done: nextStatus === "done" }
          : task,
      ),
    );
    toast.success("Bulk update complete", {
      description: `${targets.length} task${targets.length === 1 ? "" : "s"} moved to ${workflowStatusConfig[nextStatus].label.toLowerCase()}.`,
    });
  };

  const closeEditDialog = () => {
    setEditingTask(null);
    setTaskEditTitle("");
    setTaskEditContext("");
    setTaskEditDueDate("");
    setTaskEditStatus("open");
    setIsEditingTask(false);
  };

  const openEditDialog = (task: TaskRow) => {
    setEditingTask(task);
    setTaskEditTitle(task.title);
    setTaskEditContext(task.contextNote ?? (task.client === "Internal" ? "" : task.client));
    setTaskEditDueDate(toDateInputValue(task.dueAt));
    setTaskEditStatus(task.status);
  };

  const submitTaskEdit = async () => {
    if (!editingTask) {
      return;
    }

    const title = taskEditTitle.trim();
    if (title.length < 2) {
      toast.error("Task title is too short", {
        description: "Use at least 2 characters for a useful task title.",
      });
      return;
    }

    const context = taskEditContext.trim();
    const dueAt = toDueAtIso(taskEditDueDate);

    if (typeof editingTask.id === "string" && isLocalQuickTaskId(editingTask.id)) {
      updateLocalQuickTask(editingTask.id, {
        title,
        client: context || "Internal",
        due_at: dueAt,
        status: taskEditStatus,
      });
      toast.success("Local task updated", {
        description: "The quick-captured task details were updated.",
      });
      closeEditDialog();
      return;
    }

    if (dataSource === "live") {
      setIsEditingTask(true);
      try {
        await updateTask(String(editingTask.id), {
          title,
          due_at: dueAt,
          status: taskEditStatus,
          description: context ? `Client context: ${context}` : null,
        });
        await loadTasks();
        toast.success("Task updated", {
          description: "Task details were saved to the live workspace.",
        });
        closeEditDialog();
      } catch (updateError) {
        console.error(updateError);
        toast.error("Could not update task", {
          description: "Task details could not be saved right now.",
        });
      } finally {
        setIsEditingTask(false);
      }
      return;
    }

    setTasks((previous) =>
      previous.map((task) =>
        task.id === editingTask.id
          ? {
              ...task,
              title,
              dueAt,
              due: formatDueLabel(dueAt),
              priority: getPriorityFromDueDate(dueAt),
              status: taskEditStatus,
              done: taskEditStatus === "done",
              client: context || "Internal",
              contextNote: context || null,
            }
          : task,
      ),
    );
    toast.success("Task updated", {
      description: "Task details were updated in preview mode.",
    });
    closeEditDialog();
  };

  const toggle = async (taskId: number | string) => {
    const task = mergedTasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    await applyTaskStatus(task, task.done ? "open" : "done");
  };

  const handleAddTask = async () => {
    const template = taskTemplates[tasks.length % taskTemplates.length];

    if (dataSource === "live") {
      setIsSaving(true);
      try {
        await createTask({
          title: template.title,
          contact_id: template.client === "Internal" ? null : contactIds[0] ?? null,
          assignee_id: user?.id ?? null,
          status: "open",
          due_at: addDays(template.dueInDays),
          source: "manual",
        });
        await loadTasks();
        toast.warning("Task added", {
          description: `${template.title} is now in the active queue.`,
        });
      } catch (createError) {
        console.error(createError);
        toast.error("Could not add task", {
          description: "The live task record could not be created right now.",
        });
      } finally {
        setIsSaving(false);
      }

      return;
    }

    createLocalQuickTask({
      title: template.title,
      client: template.client,
      assignee: user?.name ?? "You",
      due_at: addDays(template.dueInDays),
    });
    toast.warning("Task added", {
      description: `${template.title} is now in the active queue.`,
    });
  };

  const handleSyncLocalTasks = async () => {
    if (localTasks.length === 0) {
      toast.info("No local tasks to sync", {
        description: "Your quick capture queue is already in sync.",
      });
      return;
    }

    if (!canSyncLocalTasks) {
      toast.warning("Live connection required", {
        description: "Connect to the live workspace to sync local quick-capture tasks.",
      });
      return;
    }

    setIsSyncingLocal(true);
    let failedCount = 0;
    const syncedIds: string[] = [];
    const orderedQueue = [...localTasks].sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    );

    for (const localTask of orderedQueue) {
      try {
        await createTask({
          title: localTask.title,
          assignee_id: user?.id ?? null,
          due_at: localTask.due_at ?? null,
          status: localTask.status,
          source: "manual",
          description:
            localTask.client && localTask.client !== "Internal"
              ? `Client context: ${localTask.client}`
              : null,
        });
        syncedIds.push(localTask.id);
      } catch (syncError) {
        failedCount += 1;
        console.warn("Could not sync local task", syncError);
      }
    }

    if (syncedIds.length > 0) {
      removeLocalQuickTasks(syncedIds);
    }

    if (failedCount === 0) {
      toast.success("Local queue synced", {
        description: `${syncedIds.length} tasks moved to the live workspace.`,
      });
    } else if (syncedIds.length > 0) {
      toast.warning("Partial sync complete", {
        description: `${syncedIds.length} synced, ${failedCount} still local.`,
      });
    } else {
      toast.error("Sync failed", {
        description: "No local tasks were synced. Check connection and try again.",
      });
    }

    try {
      await loadTasks();
    } catch (loadError) {
      console.warn("Could not refresh tasks after local sync", loadError);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const handleAIFollowUpTask = async () => {
    toast.info("AI follow-up prepared", {
      description:
        "The next step is connecting thread summaries and stalled deals so CRMP can create the right task automatically.",
    });
    await handleAddTask();
  };

  const handleAutomationRule = () => {
    toast.success("Automation action ready", {
      description:
        "Tasks can be triggered from unread inbox pressure, stage changes, and expiring opportunities.",
    });
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Tasks"
        description="Keep follow-ups visible, assign the next action clearly, and close the gaps before momentum slips."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            {localTasks.length > 0 ? (
              <StatusBadge tone={canSyncLocalTasks ? "warning" : "info"}>
                {localTasks.length} local queued
              </StatusBadge>
            ) : null}
            <StatusBadge tone="info">
              {pendingCount} pending · {completedCount} completed
            </StatusBadge>
          </>
        }
        actions={
          <SmartActionButton
            label="Add Task"
            icon={Plus}
            variant="warning"
            onClick={() => {
              void handleAddTask();
            }}
            disabled={isSaving || isSyncingLocal}
            items={[
              {
                label: "Sync local queue",
                description:
                  localTasks.length > 0
                    ? canSyncLocalTasks
                      ? "Push locally captured tasks into the live CRM task table."
                      : "Reconnect to live mode first, then sync local quick captures."
                    : "No local quick captures are waiting for sync.",
                icon: CloudUpload,
                onSelect: () => {
                  void handleSyncLocalTasks();
                },
              },
              {
                label: "AI follow-up task",
                description: "Use the assistant to create the next task from recent deal or inbox signals.",
                icon: Bot,
                onSelect: () => {
                  void handleAIFollowUpTask();
                },
              },
              {
                label: "Attach automation rule",
                description: "Turn recurring tasks into triggered workflows instead of manual reminders.",
                onSelect: handleAutomationRule,
              },
            ]}
          />
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-4">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      {localTasks.length > 0 ? (
        <SurfaceCard tone="subtle" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {localTasks.length} locally captured task{localTasks.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground">
              {canSyncLocalTasks
                ? "You are live. Sync this queue now so every task is durable in CRM."
                : "Queue is safe locally. Reconnect to live mode to push these tasks into CRM."}
            </p>
          </div>
          <Button
            variant={canSyncLocalTasks ? "default" : "outline"}
            onClick={() => {
              void handleSyncLocalTasks();
            }}
            disabled={isSyncingLocal || isSaving || !canSyncLocalTasks}
          >
            {isSyncingLocal ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Syncing queue...
              </>
            ) : (
              <>
                <CloudUpload className="size-4" />
                Sync local tasks
              </>
            )}
          </Button>
        </SurfaceCard>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(["active", "all", "done"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === value
                ? "border-primary/20 bg-primary/12 text-primary"
                : "border-border/80 bg-card/75 text-muted-foreground hover:border-primary/12 hover:text-foreground"
            }`}
          >
            {value === "active"
              ? "Active"
              : value === "done"
                ? "Completed"
                : "All Tasks"}
          </button>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search task title, client, or assignee"
          className="h-9 border-border/80 bg-card/75"
        />
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "High", "Medium", "Low"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setPriorityFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                priorityFilter === value
                  ? "border-primary/20 bg-primary/12 text-primary"
                  : "border-border/80 bg-card/75 text-muted-foreground hover:border-primary/12 hover:text-foreground"
              }`}
            >
              {value === "all" ? "All priorities" : value}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={filtered.length === 0 || isSaving || isSyncingLocal}
          onClick={() => {
            void applyBulkStatus("in_progress");
          }}
        >
          <Play className="size-4" />
          Start visible
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={filtered.length === 0 || isSaving || isSyncingLocal}
          onClick={() => {
            void applyBulkStatus("done");
          }}
        >
          <Check className="size-4" />
          Complete visible
        </Button>
      </div>

      <SurfaceCard tone="subtle" className="gap-3 p-4 sm:p-5">
        {filter === "active" && localPendingCount > 0 ? (
          <p className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            {localPendingCount} active task{localPendingCount === 1 ? "" : "s"}{" "}
            {localPendingCount === 1 ? "is" : "are"} stored locally.
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <p className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
            No tasks match the current filters.
          </p>
        ) : null}
        {filtered.map((task, index) => {
          const priority = priorityConfig[task.priority];
          const PriorityIcon = priority.icon;

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`flex flex-col gap-4 rounded-[calc(var(--radius)+4px)] border p-4 sm:flex-row sm:items-center ${
                task.done
                  ? "border-border/60 bg-background/25"
                  : "border-border/70 bg-background/35"
              }`}
            >
              <button
                onClick={() => void toggle(task.id)}
                disabled={isSyncingLocal}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  task.done
                    ? "border-primary/20 bg-primary/12 text-primary"
                    : "border-border/80 bg-card/70 text-muted-foreground hover:border-primary/18 hover:text-foreground"
                }`}
              >
                {task.done ? <Check className="size-4" /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      task.done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </p>
                  <StatusBadge tone={priority.tone}>
                    <PriorityIcon className="size-3" />
                    {task.priority}
                  </StatusBadge>
                  <StatusBadge tone={workflowStatusConfig[task.status].tone}>
                    {workflowStatusConfig[task.status].label}
                  </StatusBadge>
                  {task.isLocal ? (
                    <StatusBadge tone="info">Local</StatusBadge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{task.client}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="size-4" />
                  {task.due}
                </div>
                <StatusBadge tone="neutral">{task.assignee}</StatusBadge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={isSaving || isSyncingLocal}
                      aria-label={`Open actions for ${task.title}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-[calc(var(--radius)-1px)] border-border/80 bg-popover p-1.5 shadow-[var(--shadow-elevated)]"
                  >
                    <DropdownMenuLabel className="text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Workflow
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        void applyTaskStatus(task, "open");
                      }}
                      disabled={task.status === "open"}
                    >
                      <RotateCcw className="size-4" />
                      Mark open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void applyTaskStatus(task, "in_progress");
                      }}
                      disabled={task.status === "in_progress"}
                    >
                      <Play className="size-4" />
                      Mark in progress
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void applyTaskStatus(task, "done");
                      }}
                      disabled={task.status === "done"}
                    >
                      <Check className="size-4" />
                      Mark complete
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openEditDialog(task)}
                    >
                      <Pencil className="size-4" />
                      Edit details
                    </DropdownMenuItem>
                    {task.isLocal ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (typeof task.id === "string") {
                              removeLocalQuickTask(task.id);
                            }
                          }}
                        >
                          Remove local capture
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </SurfaceCard>

      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent className="max-w-xl border-border/80 bg-canvas-strong p-0 shadow-[var(--shadow-elevated)]">
          <div className="border-b border-border/80 px-5 py-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base">Edit Task</DialogTitle>
              <DialogDescription className="text-[0.8rem] leading-5">
                Update workflow details and keep execution context accurate.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-5 py-4">
            <div className="space-y-2">
              <p className="text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Task title
              </p>
              <Input
                value={taskEditTitle}
                onChange={(event) => setTaskEditTitle(event.target.value)}
                placeholder="Follow up with renewal committee"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Client or context
              </p>
              <Input
                value={taskEditContext}
                onChange={(event) => setTaskEditContext(event.target.value)}
                placeholder="NovaStar Ltd"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Due date
                </p>
                <Input
                  type="date"
                  value={taskEditDueDate}
                  onChange={(event) => setTaskEditDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Workflow status
                </p>
                <Select
                  value={taskEditStatus}
                  onValueChange={(value) => setTaskEditStatus(value as TaskStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/80 px-5 py-4">
            <Button
              variant="outline"
              onClick={closeEditDialog}
              disabled={isEditingTask}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                void submitTaskEdit();
              }}
              disabled={isEditingTask}
            >
              {isEditingTask ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

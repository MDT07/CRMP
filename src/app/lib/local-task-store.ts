import type { TaskStatus } from "./crm-api";

const LOCAL_TASKS_STORAGE_KEY = "crmp.local.quick_tasks";
const LOCAL_TASKS_EVENT = "crmp:local_tasks_changed";

export interface LocalQuickTask {
  id: string;
  title: string;
  client: string;
  assignee: string;
  due_at?: string | null;
  status: TaskStatus;
  created_at: string;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === "open"
    || value === "in_progress"
    || value === "done"
    || value === "cancelled"
  );
}

function toLocalQuickTask(value: unknown): LocalQuickTask | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const task = value as Partial<LocalQuickTask>;
  if (
    typeof task.id !== "string"
    || typeof task.title !== "string"
    || typeof task.client !== "string"
    || typeof task.assignee !== "string"
    || typeof task.created_at !== "string"
    || !isTaskStatus(task.status)
  ) {
    return null;
  }

  return {
    id: task.id,
    title: task.title,
    client: task.client,
    assignee: task.assignee,
    due_at:
      typeof task.due_at === "string" || task.due_at === null
        ? task.due_at
        : null,
    status: task.status,
    created_at: task.created_at,
  };
}

function readStore() {
  if (typeof window === "undefined") {
    return [] as LocalQuickTask[];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_TASKS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(toLocalQuickTask)
      .filter((task): task is LocalQuickTask => Boolean(task));
  } catch {
    return [];
  }
}

function persistStore(tasks: LocalQuickTask[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event(LOCAL_TASKS_EVENT));
}

export function listLocalQuickTasks() {
  return readStore().sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function createLocalQuickTask(input: {
  title: string;
  client?: string;
  assignee?: string;
  due_at?: string | null;
}) {
  const nextTask: LocalQuickTask = {
    id: `local-task-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`,
    title: input.title.trim(),
    client: input.client?.trim() || "Internal",
    assignee: input.assignee?.trim() || "You",
    due_at: input.due_at ?? null,
    status: "open",
    created_at: new Date().toISOString(),
  };

  const tasks = readStore();
  persistStore([nextTask, ...tasks]);
  return nextTask;
}

export function updateLocalQuickTaskStatus(taskId: string, status: TaskStatus) {
  const tasks = readStore().map((task) =>
    task.id === taskId ? { ...task, status } : task,
  );
  persistStore(tasks);
}

export function updateLocalQuickTask(
  taskId: string,
  patch: Partial<Pick<LocalQuickTask, "title" | "client" | "assignee" | "due_at" | "status">>,
) {
  const tasks = readStore().map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      title:
        typeof patch.title === "string"
          ? patch.title.trim() || task.title
          : task.title,
      client:
        typeof patch.client === "string"
          ? patch.client.trim() || "Internal"
          : task.client,
      assignee:
        typeof patch.assignee === "string"
          ? patch.assignee.trim() || "You"
          : task.assignee,
      due_at:
        patch.due_at === undefined
          ? task.due_at
          : patch.due_at,
      status: patch.status ?? task.status,
    };
  });

  persistStore(tasks);
}

export function removeLocalQuickTask(taskId: string) {
  const tasks = readStore().filter((task) => task.id !== taskId);
  persistStore(tasks);
}

export function removeLocalQuickTasks(taskIds: string[]) {
  if (taskIds.length === 0) {
    return;
  }

  const taskIdSet = new Set(taskIds);
  const tasks = readStore().filter((task) => !taskIdSet.has(task.id));
  persistStore(tasks);
}

export function isLocalQuickTaskId(taskId: string) {
  return taskId.startsWith("local-task-");
}

export function subscribeToLocalQuickTasks(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(LOCAL_TASKS_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(LOCAL_TASKS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

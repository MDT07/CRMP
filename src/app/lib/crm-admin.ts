import type { WorkspaceApiKey, WorkspaceMember, WorkspaceRole } from "./crm-api";

export type PermissionModule =
  | "contacts"
  | "deals"
  | "inbox"
  | "automations"
  | "analytics"
  | "settings";

export type PermissionLevel = "full" | "edit" | "view" | "none";

export interface TeamMemberAccess {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: "active" | "invited" | "paused";
  lastSeen: string;
  source: "live" | "local";
  permissions: Record<PermissionModule, PermissionLevel>;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  scope: "server" | "public" | "automation";
  modules: PermissionModule[];
  status: "active" | "revoked";
  prefix: string;
  token: string | null;
  maskedToken: string;
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string | null;
}

export interface ActivityLogRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  tone: "info" | "success" | "warning" | "danger";
}

export interface AdminConsoleState {
  teamMembers: TeamMemberAccess[];
  apiKeys: ApiKeyRecord[];
  activityLogs: ActivityLogRecord[];
}

const STORAGE_KEY = "crmp.admin.console";

export const permissionModuleMeta: { id: PermissionModule; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "deals", label: "Deals" },
  { id: "inbox", label: "Inbox" },
  { id: "automations", label: "Automations" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

export const permissionLevelMeta: { id: PermissionLevel; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "edit", label: "Edit" },
  { id: "view", label: "View" },
  { id: "none", label: "None" },
];

export const roleLabels: Record<WorkspaceRole, string> = {
  admin: "Admin",
  manager: "Manager",
  rep: "Representative",
};

export function createId(prefix: string) {
  const randomSeed =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${randomSeed.replace(/-/g, "").slice(0, 12)}`;
}

export function maskApiKey(token: string) {
  return `${token.slice(0, 8)}••••${token.slice(-4)}`;
}

export function createApiToken() {
  const randomSeed =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `crmp_${randomSeed.replace(/-/g, "").slice(0, 28)}`;
}

function createMaskedTokenPlaceholder(prefix: string) {
  const preview = `crmp_${prefix}`.slice(0, 8).padEnd(8, "x");
  return `${preview}••••local`;
}

function sanitizeApiKeyRecord(keyRecord: ApiKeyRecord): ApiKeyRecord {
  const maskedToken =
    keyRecord.maskedToken ||
    (keyRecord.token ? maskApiKey(keyRecord.token) : createMaskedTokenPlaceholder(keyRecord.prefix));

  return {
    ...keyRecord,
    token: null,
    maskedToken,
  };
}

function sanitizeAdminConsoleState(state: AdminConsoleState): AdminConsoleState {
  return {
    ...state,
    apiKeys: state.apiKeys.map((keyRecord) => sanitizeApiKeyRecord(keyRecord)),
  };
}

export function getDefaultPermissionsForRole(
  role: WorkspaceRole,
): Record<PermissionModule, PermissionLevel> {
  switch (role) {
    case "admin":
      return {
        contacts: "full",
        deals: "full",
        inbox: "full",
        automations: "full",
        analytics: "full",
        settings: "full",
      };
    case "manager":
      return {
        contacts: "full",
        deals: "full",
        inbox: "edit",
        automations: "edit",
        analytics: "full",
        settings: "view",
      };
    case "rep":
      return {
        contacts: "edit",
        deals: "full",
        inbox: "edit",
        automations: "view",
        analytics: "view",
        settings: "none",
      };
    default:
      return {
        contacts: "view",
        deals: "view",
        inbox: "view",
        automations: "none",
        analytics: "view",
        settings: "none",
      };
  }
}

export function buildTeamMembersFromWorkspaceMembers(
  members: WorkspaceMember[],
): TeamMemberAccess[] {
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.is_active ? "active" : "paused",
    lastSeen: member.last_login_at ?? member.updated_at,
    source: "live",
    permissions: getDefaultPermissionsForRole(member.role),
  }));
}

export function buildFallbackAdminConsoleState(
  actorName = "EmirCo Operator",
): AdminConsoleState {
  const now = new Date();
  const serverSyncToken = createApiToken();
  const automationRunnerToken = createApiToken();

  return {
    teamMembers: [
      {
        id: "local-admin",
        name: actorName,
        email: "operator@emirco.local",
        role: "admin",
        status: "active",
        lastSeen: now.toISOString(),
        source: "local",
        permissions: getDefaultPermissionsForRole("admin"),
      },
      {
        id: "local-sales-1",
        name: "Maya Foster",
        email: "maya@emirco.local",
        role: "rep",
        status: "active",
        lastSeen: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
        source: "local",
        permissions: getDefaultPermissionsForRole("rep"),
      },
      {
        id: "local-manager-1",
        name: "Jonas Reed",
        email: "jonas@emirco.local",
        role: "manager",
        status: "active",
        lastSeen: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        source: "local",
        permissions: getDefaultPermissionsForRole("manager"),
      },
      {
        id: "local-rep-2",
        name: "Ayla Karim",
        email: "ayla@emirco.local",
        role: "rep",
        status: "invited",
        lastSeen: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        source: "local",
        permissions: getDefaultPermissionsForRole("rep"),
      },
    ],
    apiKeys: [
      {
        id: createId("key"),
        name: "Server sync",
        scope: "server",
        modules: ["contacts", "deals", "inbox", "analytics"],
        status: "active",
        token: null,
        maskedToken: maskApiKey(serverSyncToken),
        prefix: "server",
        createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: actorName,
        lastUsedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: createId("key"),
        name: "Automation runner",
        scope: "automation",
        modules: ["automations", "deals", "inbox"],
        status: "active",
        token: null,
        maskedToken: maskApiKey(automationRunnerToken),
        prefix: "auto",
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: actorName,
        lastUsedAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
      },
    ],
    activityLogs: [
      {
        id: createId("log"),
        actor: actorName,
        action: "Created API key",
        target: "Automation runner",
        time: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        tone: "success",
      },
      {
        id: createId("log"),
        actor: "Maya Foster",
        action: "Updated deal permissions",
        target: "Sales workspace access",
        time: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
        tone: "info",
      },
      {
        id: createId("log"),
        actor: actorName,
        action: "Invited teammate",
        target: "Ayla Karim",
        time: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        tone: "warning",
      },
    ],
  };
}

export function loadStoredAdminConsoleState(actorName?: string) {
  if (typeof window === "undefined") {
    return sanitizeAdminConsoleState(buildFallbackAdminConsoleState(actorName));
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return sanitizeAdminConsoleState(buildFallbackAdminConsoleState(actorName));
  }

  try {
    return sanitizeAdminConsoleState(JSON.parse(rawValue) as AdminConsoleState);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return sanitizeAdminConsoleState(buildFallbackAdminConsoleState(actorName));
  }
}

export function storeAdminConsoleState(state: AdminConsoleState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(sanitizeAdminConsoleState(state)),
  );
}

export function createLocalInvite(
  _actorName: string,
  email: string,
  role: WorkspaceRole,
): TeamMemberAccess {
  const name = email.split("@")[0].replace(/[._-]+/g, " ");
  const displayName = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    id: createId("invite"),
    name: displayName || "New teammate",
    email,
    role,
    status: "invited",
    lastSeen: new Date().toISOString(),
    source: "local",
    permissions: getDefaultPermissionsForRole(role),
  };
}

export function buildApiKeyRecordFromWorkspaceApiKey(
  apiKey: WorkspaceApiKey,
  token?: string | null,
): ApiKeyRecord {
  return {
    id: apiKey.id,
    name: apiKey.name,
    scope: apiKey.scope,
    modules: apiKey.modules,
    status: apiKey.status === "revoked" ? "revoked" : "active",
    prefix: apiKey.prefix,
    token: token ?? null,
    maskedToken: apiKey.masked_token,
    createdAt: apiKey.created_at,
    createdBy: apiKey.created_by_name ?? "Workspace admin",
    lastUsedAt: apiKey.last_used_at ?? null,
  };
}

export function createActivityLog(
  actor: string,
  action: string,
  target: string,
  tone: ActivityLogRecord["tone"] = "info",
): ActivityLogRecord {
  return {
    id: createId("log"),
    actor,
    action,
    target,
    time: new Date().toISOString(),
    tone,
  };
}

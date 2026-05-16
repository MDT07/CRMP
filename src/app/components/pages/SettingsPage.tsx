import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  Check,
  Copy,
  Globe,
  Key,
  Laptop,
  LogOut,
  Mail,
  MoonStar,
  Palette,
  Plus,
  RefreshCcw,
  Shield,
  SunMedium,
  Trash2,
  User,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  buildApiKeyRecordFromWorkspaceApiKey,
  buildTeamMembersFromWorkspaceMembers,
  createActivityLog,
  createApiToken,
  createId,
  createLocalInvite,
  getDefaultPermissionsForRole,
  loadStoredAdminConsoleState,
  maskApiKey,
  permissionLevelMeta,
  permissionModuleMeta,
  roleLabels,
  storeAdminConsoleState,
  type ActivityLogRecord,
  type AdminConsoleState,
  type ApiKeyRecord,
  type PermissionLevel,
  type PermissionModule,
  type TeamMemberAccess,
} from "../../lib/crm-admin";
import {
  createWorkspaceApiKey,
  fetchWorkspaceMembers,
  fetchWorkspaceApiKeys,
  revokeWorkspaceApiKey,
  type WorkspaceRole,
} from "../../lib/crm-api";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { formatRelativeShort, getInitials } from "../../lib/crm-format";
import { useCrmApp } from "../../providers/CrmProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { EmailSettingsSection } from "../email/EmailSettingsSection";
import {
  PageHeader,
  SmartActionButton,
  StatusBadge,
  SurfaceCard,
} from "../crm-ui";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

const sections = [
  { id: "profile", icon: User, label: "Profile" },
  { id: "team", icon: Users, label: "Team Access" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "email", icon: Mail, label: "Email Accounts" },
  { id: "integrations", icon: Globe, label: "Integrations" },
  { id: "ai", icon: Zap, label: "AI Settings" },
  { id: "appearance", icon: Palette, label: "Appearance" },
] as const;

const initialIntegrations = [
  { name: "Gmail", status: "Connected", auth: "OAuth", detail: "Two-way inbox sync and thread matching" },
  { name: "WhatsApp Business", status: "Connected", auth: "Token", detail: "Unified inbox, templates, and SLA tracking" },
  { name: "Instagram", status: "Planned", auth: "OAuth", detail: "DM capture and engagement routing" },
  { name: "Slack", status: "Not connected", auth: "OAuth", detail: "Internal deal alerts and escalation loops" },
  { name: "Zapier", status: "Not connected", auth: "Token", detail: "Event-based automation for external tools" },
];

const avatarThemes = [
  "border-primary bg-primary text-primary-foreground",
  "border-info bg-info text-info-foreground",
  "border-warning bg-warning text-warning-foreground",
] as const;

const roleOptions: WorkspaceRole[] = [
  "admin",
  "manager",
  "rep",
];

const activityTone: Record<
  ActivityLogRecord["tone"],
  "info" | "success" | "warning" | "danger"
> = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

type SectionId = (typeof sections)[number]["id"];

function formatRole(role?: WorkspaceRole) {
  if (!role) {
    return "Workspace lead";
  }

  return roleLabels[role];
}

function buildProfileState(
  userName?: string | null,
  email?: string | null,
  role?: WorkspaceRole,
) {
  const [firstName = "", ...rest] = (userName ?? "EmirCo Operator").split(" ");

  return {
    firstName,
    lastName: rest.join(" "),
    email: email ?? "operator@emirco.local",
    phone: "+1 555 0100",
    role: formatRole(role),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function mergeLiveMembers(
  liveMembers: TeamMemberAccess[],
  currentMembers: TeamMemberAccess[],
) {
  const currentByEmail = new Map(
    currentMembers.map((member) => [member.email.toLowerCase(), member]),
  );
  const liveEmails = new Set(liveMembers.map((member) => member.email.toLowerCase()));

  return [
    ...liveMembers.map((member) => {
      const existing = currentByEmail.get(member.email.toLowerCase());
      return existing
        ? {
            ...member,
            role: existing.role,
            status: existing.status,
            permissions: existing.permissions,
          }
        : member;
    }),
    ...currentMembers.filter(
      (member) =>
        member.source === "local" && !liveEmails.has(member.email.toLowerCase()),
    ),
  ];
}

function getDefaultNameForApiKeyScope(scope: ApiKeyRecord["scope"]) {
  switch (scope) {
    case "server":
      return "Server integration";
    case "automation":
      return "Automation worker";
    case "public":
      return "Public embed";
    default:
      return "Workspace API key";
  }
}

function getDefaultModulesForApiKeyScope(
  scope: ApiKeyRecord["scope"],
): PermissionModule[] {
  switch (scope) {
    case "server":
      return ["contacts", "deals", "inbox", "analytics"];
    case "automation":
      return ["automations", "deals", "inbox"];
    case "public":
      return ["contacts", "inbox"];
    default:
      return ["contacts"];
  }
}

function getApiKeyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to sync workspace API keys right now.";
}

export function SettingsPage() {
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    setAssistantSelection,
    signOut,
    user,
    workspace,
  } = useCrmApp();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>("team");
  const [profile, setProfile] = useState(() =>
    buildProfileState(user?.name, user?.email, user?.role),
  );
  const [avatarThemeIndex, setAvatarThemeIndex] = useState(0);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [notifs, setNotifs] = useState({
    email: true,
    desktop: true,
    deals: true,
    tasks: true,
    reports: false,
  });
  const [aiModel, setAiModel] = useState("gpt-4.1-mini");
  const [uiDensity, setUiDensity] = useState("comfortable");
  const [chartStyle, setChartStyle] = useState("bold");
  const [adminConsole, setAdminConsole] = useState<AdminConsoleState>(() =>
    loadStoredAdminConsoleState(user?.name ?? workspace.name),
  );
  const [liveApiKeys, setLiveApiKeys] = useState<ApiKeyRecord[]>([]);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("rep");
  const liveKeyManagementEnabled =
    !isGuest && connection !== "fallback" && connection !== "guest" && connection !== "loading";

  useEffect(() => {
    setProfile((current) => ({
      ...current,
      ...buildProfileState(user?.name, user?.email, user?.role),
      phone: current.phone,
      timezone: current.timezone,
    }));
  }, [user?.email, user?.name, user?.role]);

  useEffect(() => {
    storeAdminConsoleState(adminConsole);
  }, [adminConsole]);

  useEffect(() => {
    if (selectedMemberId && adminConsole.teamMembers.some((member) => member.id === selectedMemberId)) {
      return;
    }

    setSelectedMemberId(adminConsole.teamMembers[0]?.id ?? null);
  }, [adminConsole.teamMembers, selectedMemberId]);

  useEffect(() => {
    if (connection === "fallback" || connection === "guest" || connection === "loading") {
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      try {
        const liveMembers = buildTeamMembersFromWorkspaceMembers(
          await fetchWorkspaceMembers(),
        );

        if (cancelled) {
          return;
        }

        setAdminConsole((current) => ({
          ...current,
          teamMembers: mergeLiveMembers(liveMembers, current.teamMembers),
        }));
      } catch (loadError) {
        if (!cancelled) {
          console.warn("Falling back to stored team access settings.", loadError);
        }
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    const dataSource =
      connection === "loading"
        ? "loading"
        : connection === "fallback" || connection === "guest"
          ? "preview"
          : "live";
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Settings",
        route: "/settings",
        dataSource,
        selectedEntities: [],
        summary: "Workspace configuration and controls context",
      }),
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, connection, setAssistantSelection]);

  useEffect(() => {
    if (!liveKeyManagementEnabled) {
      setLiveApiKeys([]);
      setApiKeysError(null);
      return;
    }

    let cancelled = false;

    const loadApiKeys = async () => {
      try {
        const keys = await fetchWorkspaceApiKeys();
        if (cancelled) {
          return;
        }

        setLiveApiKeys(
          keys.map((key) => buildApiKeyRecordFromWorkspaceApiKey(key)),
        );
        setApiKeysError(null);
      } catch (loadError) {
        if (!cancelled) {
          setLiveApiKeys([]);
          setApiKeysError(getApiKeyErrorMessage(loadError));
        }
      }
    };

    void loadApiKeys();

    return () => {
      cancelled = true;
    };
  }, [liveKeyManagementEnabled]);

  const displayName = `${profile.firstName} ${profile.lastName}`.trim();
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.trim();
  const selectedMember =
    adminConsole.teamMembers.find((member) => member.id === selectedMemberId) ??
    adminConsole.teamMembers[0];

  const adminCount = useMemo(
    () =>
      adminConsole.teamMembers.filter((member) =>
        ["admin", "manager"].includes(member.role),
      ).length,
    [adminConsole.teamMembers],
  );
  const securityApiKeys = liveKeyManagementEnabled ? liveApiKeys : adminConsole.apiKeys;
  const activeKeyCount = useMemo(
    () =>
      securityApiKeys.filter((key) => key.status === "active").length,
    [securityApiKeys],
  );

  const appendActivity = (entry: ActivityLogRecord) => {
    setAdminConsole((current) => ({
      ...current,
      activityLogs: [entry, ...current.activityLogs].slice(0, 12),
    }));
  };

  const handleChangePhoto = () => {
    setAvatarThemeIndex((previous) => (previous + 1) % avatarThemes.length);
    toast.info("Avatar style updated", {
      description: "A sharper profile accent was applied to the workspace shell.",
    });
  };

  const handleSaveProfile = () => {
    toast.success("Profile saved", {
      description: `${displayName} is now the active identity across CRMP.`,
    });
    appendActivity(
      createActivityLog(displayName || workspace.name, "Updated profile", workspace.name, "info"),
    );
  };

  const handleConnect = (integrationName: string) => {
    setIntegrations((current) =>
      current.map((integration) =>
        integration.name === integrationName
          ? {
              ...integration,
              status:
                integration.status === "Connected" ? "Not connected" : "Connected",
            }
          : integration,
      ),
    );

    toast.success("Integration updated", {
      description: `${integrationName} connection preferences were updated.`,
    });
    appendActivity(
      createActivityLog(
        displayName || workspace.name,
        "Updated integration",
        integrationName,
        "success",
      ),
    );
  };

  const handleModelSelect = (model: string) => {
    setAiModel(model);
    toast.info("AI model updated", {
      description: `${model} is now the default assistant model.`,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out", {
      description: "The workspace session was closed successfully.",
    });
  };

  const handleInviteMember = (roleOverride?: WorkspaceRole) => {
    if (!inviteEmail.trim()) {
      toast.warning("Invite email required", {
        description: "Add an email address before sending a team invite.",
      });
      return;
    }

    const effectiveRole = roleOverride ?? inviteRole;
    const nextMember = createLocalInvite(
      displayName || workspace.name,
      inviteEmail,
      effectiveRole,
    );

    setAdminConsole((current) => ({
      ...current,
      teamMembers: [nextMember, ...current.teamMembers],
    }));
    setInviteEmail("");
    setSelectedMemberId(nextMember.id);
    toast.success("Invite created", {
      description: `${nextMember.email} was added as ${roleLabels[effectiveRole]}.`,
    });
    appendActivity(
      createActivityLog(
        displayName || workspace.name,
        "Invited teammate",
        nextMember.email,
        "warning",
      ),
    );
  };

  const handleRoleChange = (memberId: string, role: WorkspaceRole) => {
    const member = adminConsole.teamMembers.find((entry) => entry.id === memberId);
    if (!member) {
      return;
    }

    setAdminConsole((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((entry) =>
        entry.id === memberId
          ? {
              ...entry,
              role,
              permissions: getDefaultPermissionsForRole(role),
            }
          : entry,
      ),
    }));
    toast.success("Role updated", {
      description: `${member.name} is now ${roleLabels[role]}.`,
    });
    appendActivity(
      createActivityLog(displayName || workspace.name, "Changed role", member.name, "success"),
    );
  };

  const handleStatusToggle = (memberId: string) => {
    const member = adminConsole.teamMembers.find((entry) => entry.id === memberId);
    if (!member) {
      return;
    }

    const nextStatus =
      member.status === "active"
        ? "paused"
        : member.status === "paused"
          ? "active"
          : "active";

    setAdminConsole((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((entry) =>
        entry.id === memberId
          ? {
              ...entry,
              status: nextStatus,
            }
          : entry,
      ),
    }));
    toast.info("Access updated", {
      description: `${member.name} is now ${nextStatus}.`,
    });
    appendActivity(
      createActivityLog(
        displayName || workspace.name,
        nextStatus === "paused" ? "Paused access" : "Restored access",
        member.name,
        nextStatus === "paused" ? "warning" : "success",
      ),
    );
  };

  const handlePermissionChange = (
    memberId: string,
    moduleId: PermissionModule,
    level: PermissionLevel,
  ) => {
    const member = adminConsole.teamMembers.find((entry) => entry.id === memberId);
    if (!member) {
      return;
    }

    setAdminConsole((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((entry) =>
        entry.id === memberId
          ? {
              ...entry,
              permissions: {
                ...entry.permissions,
                [moduleId]: level,
              },
            }
          : entry,
      ),
    }));
    toast.success("Permission updated", {
      description: `${roleLabels[member.role]} access for ${moduleId} is now ${level}.`,
    });
    appendActivity(
      createActivityLog(
        displayName || workspace.name,
        "Updated module permission",
        `${member.name} · ${moduleId}`,
        "info",
      ),
    );
  };

  const handleGenerateKey = async (scope: ApiKeyRecord["scope"]) => {
    const nextName = getDefaultNameForApiKeyScope(scope);
    const nextModules = getDefaultModulesForApiKeyScope(scope);
    let nextKey: ApiKeyRecord;

    if (liveKeyManagementEnabled) {
      try {
        const response = await createWorkspaceApiKey({
          name: nextName,
          scope,
          modules: nextModules,
        });
        nextKey = buildApiKeyRecordFromWorkspaceApiKey(
          response.api_key,
          response.secret,
        );
        setLiveApiKeys((current) => [nextKey, ...current]);
        setApiKeysError(null);
      } catch (createError) {
        toast.error("Unable to generate API key", {
          description: getApiKeyErrorMessage(createError),
        });
        return;
      }
    } else {
      const token = createApiToken();
      nextKey = {
        id: createId("key"),
        name: nextName,
        scope,
        modules: nextModules,
        status: "active",
        token,
        maskedToken: maskApiKey(token),
        prefix: scope,
        createdAt: new Date().toISOString(),
        createdBy: displayName || workspace.name,
        lastUsedAt: null,
      };

      setAdminConsole((current) => ({
        ...current,
        apiKeys: [nextKey, ...current.apiKeys],
      }));
    }

    toast.success("API key generated", {
      description: liveKeyManagementEnabled
        ? `${nextKey.name} was issued by the backend. Copy it now; the raw key is only shown once.`
        : `${nextKey.name} is ready. Copy it now; the browser will not persist the raw key after reload.`,
    });
    appendActivity(
      createActivityLog(
        displayName || workspace.name,
        "Generated API key",
        nextKey.name,
        "success",
      ),
    );
  };

  const handleCopyApiKey = async (keyRecord: ApiKeyRecord) => {
    if (!keyRecord.token) {
      toast.warning("Key unavailable", {
        description:
          "This browser only keeps masked key metadata. Generate a new key to copy the secret again.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(keyRecord.token);
      toast.success("Key copied", {
        description: `${keyRecord.name} was copied to the clipboard.`,
      });
    } catch {
      toast.info("Copy unavailable", {
        description: `Store this key manually: ${keyRecord.token}`,
      });
    }
  };

  const handleRevokeApiKey = (keyId: string) => {
    const activeKey = securityApiKeys.find((key) => key.id === keyId);
    if (!activeKey) {
      return;
    }

    const revokeKey = async () => {
      if (liveKeyManagementEnabled) {
        try {
          const revokedKey = await revokeWorkspaceApiKey(keyId);
          setLiveApiKeys((current) =>
            current.map((key) =>
              key.id === keyId
                ? buildApiKeyRecordFromWorkspaceApiKey(revokedKey)
                : key,
            ),
          );
          setApiKeysError(null);
        } catch (revokeError) {
          toast.error("Unable to revoke API key", {
            description: getApiKeyErrorMessage(revokeError),
          });
          return;
        }
      } else {
        setAdminConsole((current) => ({
          ...current,
          apiKeys: current.apiKeys.map((key) =>
            key.id === keyId
              ? {
                  ...key,
                  status: "revoked",
                }
              : key,
          ),
        }));
      }

      toast.warning("API key revoked", {
        description: `${activeKey.name} can no longer access the CRM.`,
      });
      appendActivity(
        createActivityLog(
          displayName || workspace.name,
          "Revoked API key",
          activeKey.name,
          "danger",
        ),
      );
    };

    void revokeKey();
  };

  const teamHealthTone =
    connection === "fallback"
      ? "warning"
      : connection === "guest" || connection === "loading"
        ? "info"
        : "success";

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Settings"
        description="Run the workspace like a product: control team access, integration security, assistant behavior, and the visual system from one place."
        meta={
          <>
            <StatusBadge tone={teamHealthTone}>
              {connection === "fallback"
                ? "Preview admin console"
                : connection === "guest"
                  ? "Guest admin console"
                : connection === "loading"
                  ? "Syncing admin state"
                  : "Workspace controls live"}
            </StatusBadge>
            <StatusBadge tone="info">
              {adminConsole.teamMembers.length} teammates · {activeKeyCount} active keys
            </StatusBadge>
          </>
        }
        actions={
          user || isGuest ? (
            <Button variant="outline" onClick={() => void handleSignOut()}>
              <LogOut className="size-4" />
              {isGuest ? "Exit guest mode" : "Sign out"}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 2xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <SurfaceCard tone="subtle" className="gap-2 p-3">
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
            {sections.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-3 rounded-[calc(var(--radius)+2px)] border px-3 py-3 text-left transition-colors ${
                  activeSection === id
                    ? "border-primary bg-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-strong hover:text-foreground"
                }`}
              >
                <div className="flex size-9 items-center justify-center rounded-2xl border border-border bg-surface-strong">
                  <Icon className="size-4" />
                </div>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-2 rounded-[calc(var(--radius)+2px)] border border-border bg-surface-strong p-4">
            <p className="text-sm font-semibold text-foreground">Admin posture</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Solid access controls, fewer visual effects, and stronger operational clarity.
            </p>
          </div>
        </SurfaceCard>

        <SurfaceCard tone="accent" className="gap-0">
          {activeSection === "profile" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">Profile Settings</p>
                <p className="text-sm text-muted-foreground">
                  Control the identity shown across your CRM workspace.
                </p>
              </div>
              <div className="space-y-6 px-5 py-5">
                <div className="flex flex-col gap-4 rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-5 sm:flex-row sm:items-center">
                  <div
                    className={`flex size-18 items-center justify-center rounded-[2rem] border text-2xl font-semibold ${avatarThemes[avatarThemeIndex]}`}
                  >
                    {initials || "A"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {displayName || workspace.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {profile.role} · {workspace.name}
                    </p>
                  </div>
                  <Button variant="info" onClick={handleChangePhoto}>
                    Change Accent
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "First Name", key: "firstName" },
                    { label: "Last Name", key: "lastName" },
                    { label: "Email", key: "email" },
                    { label: "Phone", key: "phone" },
                    { label: "Role", key: "role" },
                    { label: "Timezone", key: "timezone" },
                  ].map((field) => (
                    <div
                      key={field.label}
                      className="space-y-2 rounded-[calc(var(--radius)+2px)] border border-border bg-surface-muted p-3"
                    >
                      <label className="text-sm text-muted-foreground">
                        {field.label}
                      </label>
                      <Input
                        className="bg-background"
                        value={profile[field.key as keyof typeof profile]}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="success" onClick={handleSaveProfile}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {activeSection === "team" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">Team Access</p>
                <p className="text-sm text-muted-foreground">
                  Manage roles, module permissions, and recent admin activity from one control surface.
                </p>
              </div>
              <div className="space-y-6 px-5 py-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                    <p className="text-sm text-muted-foreground">Team members</p>
                    <p className="mt-2 font-metric text-2xl font-semibold text-foreground">
                      {adminConsole.teamMembers.length}
                    </p>
                  </div>
                  <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                    <p className="text-sm text-muted-foreground">Admins + managers</p>
                    <p className="mt-2 font-metric text-2xl font-semibold text-foreground">
                      {adminCount}
                    </p>
                  </div>
                  <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                    <p className="text-sm text-muted-foreground">Tracked activity</p>
                    <p className="mt-2 font-metric text-2xl font-semibold text-foreground">
                      {adminConsole.activityLogs.length}
                    </p>
                  </div>
                </div>

                <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_11rem]">
                    <Input
                      className="sm:col-span-2 xl:col-span-1"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="Invite teammate by email"
                    />
                    <select
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as WorkspaceRole)
                      }
                      className="h-10 rounded-[calc(var(--radius)-4px)] border border-border bg-input-background px-3 text-sm text-foreground outline-none focus:border-ring"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                    <SmartActionButton
                      className="w-full sm:col-span-2 xl:col-span-1"
                      label="Invite teammate"
                      icon={Plus}
                      variant="success"
                      onClick={handleInviteMember}
                      items={[
                        {
                          label: "Invite manager",
                          description: "Grant cross-module visibility with edit access for team leads.",
                          onSelect: () => handleInviteMember("manager"),
                        },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                  <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Team roster</p>
                        <p className="text-sm text-muted-foreground">
                          Roles are mapped to per-module access and can be adjusted here.
                        </p>
                      </div>
                      <StatusBadge tone="info">Module-level permissions</StatusBadge>
                    </div>

                    <div className="overflow-x-auto">
                      <Table className="min-w-[44rem]">
                        <TableHeader className="bg-surface-muted">
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Teammate</TableHead>
                            <TableHead className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Role</TableHead>
                            <TableHead className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</TableHead>
                            <TableHead className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Last seen</TableHead>
                            <TableHead className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminConsole.teamMembers.map((member) => (
                            <TableRow
                              key={member.id}
                              className={`border-border ${selectedMember?.id === member.id ? "bg-primary" : "bg-transparent"}`}
                            >
                              <TableCell className="px-4 py-4">
                                <button
                                  onClick={() => setSelectedMemberId(member.id)}
                                  className="flex min-w-[15rem] items-center gap-3 text-left"
                                >
                                  <div className="flex size-10 items-center justify-center rounded-2xl border border-primary bg-primary font-metric text-sm font-semibold text-primary">
                                    {getInitials(member.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                                    <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                                  </div>
                                </button>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <select
                                  value={member.role}
                                  onChange={(event) =>
                                    handleRoleChange(
                                      member.id,
                                      event.target.value as WorkspaceRole,
                                    )
                                  }
                                  className="h-9 rounded-[calc(var(--radius)-6px)] border border-border bg-input-background px-3 text-sm text-foreground outline-none focus:border-ring"
                                >
                                  {roleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {roleLabels[role]}
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <StatusBadge
                                  tone={
                                    member.status === "active"
                                      ? "success"
                                      : member.status === "paused"
                                        ? "warning"
                                        : "info"
                                  }
                                >
                                  {member.status}
                                </StatusBadge>
                              </TableCell>
                              <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                                {formatRelativeShort(member.lastSeen)}
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-2xl"
                                  onClick={() => handleStatusToggle(member.id)}
                                >
                                  {member.status === "active" ? "Pause" : "Activate"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Permission matrix</p>
                          <p className="text-sm text-muted-foreground">
                            Fine-tune access per module for {selectedMember?.name ?? "the selected teammate"}.
                          </p>
                        </div>
                        {selectedMember ? (
                          <StatusBadge tone="primary">
                            {roleLabels[selectedMember.role]}
                          </StatusBadge>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-4">
                        {selectedMember ? (
                          permissionModuleMeta.map((module) => (
                            <div
                              key={module.id}
                              className="rounded-[calc(var(--radius)+2px)] border border-border bg-surface-muted p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">{module.label}</p>
                                <StatusBadge tone="neutral">
                                  {selectedMember.permissions[module.id]}
                                </StatusBadge>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {permissionLevelMeta.map((level) => (
                                  <button
                                    key={level.id}
                                    onClick={() =>
                                      handlePermissionChange(
                                        selectedMember.id,
                                        module.id,
                                        level.id,
                                      )
                                    }
                                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                      selectedMember.permissions[module.id] === level.id
                                        ? "border-primary bg-primary text-primary"
                                        : "border-border bg-surface-strong text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {level.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Select a teammate to edit access.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Activity log</p>
                          <p className="text-sm text-muted-foreground">
                            Recent access, security, and configuration changes.
                          </p>
                        </div>
                        <Button variant="outline" size="icon" className="rounded-2xl">
                          <RefreshCcw className="size-4" />
                        </Button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {adminConsole.activityLogs.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-[calc(var(--radius)+2px)] border border-border bg-surface-muted p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">
                                {entry.action}
                              </p>
                              <StatusBadge tone={activityTone[entry.tone]}>
                                {formatRelativeShort(entry.time)}
                              </StatusBadge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {entry.actor} · {entry.target}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {activeSection === "notifications" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">
                  Notification Preferences
                </p>
                <p className="text-sm text-muted-foreground">
                  Keep the signal high and the noise low across the CRM.
                </p>
              </div>
              <div className="space-y-3 px-5 py-5">
                {Object.entries(notifs).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold capitalize text-foreground">
                        {key === "email"
                          ? "Email notifications"
                          : key === "desktop"
                            ? "Desktop notifications"
                            : key === "deals"
                              ? "Deal updates"
                              : key === "tasks"
                                ? "Task reminders"
                                : "Weekly reports"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {value ? "Currently enabled" : "Currently disabled"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setNotifs((current) => ({ ...current, [key]: !value }))
                      }
                      className={`flex h-7 w-12 items-center rounded-full border px-1 transition-colors ${
                        value
                          ? "justify-end border-primary bg-primary"
                          : "justify-start border-border bg-surface-muted"
                      }`}
                    >
                      <span
                        className={`size-5 rounded-full ${
                          value ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {activeSection === "security" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">Access Keys & Security</p>
                <p className="text-sm text-muted-foreground">
                  Generate tokens, control module scope, and keep integration access visible.
                </p>
              </div>
              <div className="space-y-6 px-5 py-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                  <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">API keys</p>
                        <p className="text-sm text-muted-foreground">
                          Token-based access for server sync, automations, and external widgets.
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-warning">
                          {liveKeyManagementEnabled
                            ? "Private-first mode: raw keys are issued server-side and only shown once."
                            : "Private-first mode: raw keys are only available until this page reloads."}
                        </p>
                      </div>
                      <SmartActionButton
                        label="Generate key"
                        icon={Key}
                        variant="success"
                        onClick={() => void handleGenerateKey("server")}
                        items={[
                          {
                            label: "Generate server key",
                            description: "Full backend sync for contacts, deals, inbox, and analytics.",
                            onSelect: () => void handleGenerateKey("server"),
                          },
                          {
                            label: "Generate automation key",
                            description: "Scoped access for workflow runners and event processors.",
                            onSelect: () => void handleGenerateKey("automation"),
                          },
                          {
                            label: "Generate public key",
                            description: "Lightweight access for widgets or public embeds with reduced scope.",
                            onSelect: () => void handleGenerateKey("public"),
                          },
                        ]}
                      />
                    </div>

                    {apiKeysError ? (
                      <div className="mt-4 rounded-[calc(var(--radius)+2px)] border border-danger bg-danger px-3 py-3 text-sm text-danger">
                        {apiKeysError}
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      {securityApiKeys.map((keyRecord) => (
                        <div
                          key={keyRecord.id}
                          className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-muted p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {keyRecord.name}
                                </p>
                                <StatusBadge tone={keyRecord.status === "active" ? "success" : "warning"}>
                                  {keyRecord.status}
                                </StatusBadge>
                                <StatusBadge tone="info">{keyRecord.scope}</StatusBadge>
                              </div>
                              <p className="mt-2 font-metric text-sm text-foreground">
                                {keyRecord.maskedToken}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Created {formatRelativeShort(keyRecord.createdAt)} by {keyRecord.createdBy}
                                {keyRecord.lastUsedAt
                                  ? ` · Last used ${formatRelativeShort(keyRecord.lastUsedAt)}`
                                  : " · Not used yet"}
                              </p>
                              {!keyRecord.token ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Raw secret not stored in the browser. Regenerate this key if you need to copy it again.
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="rounded-2xl"
                                onClick={() => void handleCopyApiKey(keyRecord)}
                                disabled={!keyRecord.token}
                              >
                                <Copy className="size-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="rounded-2xl"
                                onClick={() => handleRevokeApiKey(keyRecord.id)}
                                disabled={keyRecord.status === "revoked"}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {keyRecord.modules.map((moduleId) => (
                              <StatusBadge key={moduleId} tone="neutral">
                                {permissionModuleMeta.find((module) => module.id === moduleId)?.label ?? moduleId}
                              </StatusBadge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-4">
                      <p className="text-sm font-semibold text-foreground">Security posture</p>
                      <div className="mt-4 space-y-3">
                        {[
                          liveKeyManagementEnabled
                            ? "Workspace API keys are issued and revoked from the backend, not generated in the browser."
                            : "Preview mode keeps API key generation local to this browser session only.",
                          "OAuth-ready channels are mapped for Gmail, Instagram, Slack, and future providers.",
                          "Activity logs make permission and key changes visible to admins.",
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-3 rounded-[calc(var(--radius)+2px)] border border-border bg-surface-muted p-3">
                            <div className="mt-0.5 flex size-8 items-center justify-center rounded-2xl border border-success bg-success-soft text-success">
                              <Check className="size-4" />
                            </div>
                            <p className="text-sm text-muted-foreground">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface-strong p-4">
                      <p className="text-sm font-semibold text-foreground">Recent security activity</p>
                      <div className="mt-4 space-y-3">
                        {adminConsole.activityLogs
                          .filter((entry) =>
                            ["Generated API key", "Revoked API key", "Paused access", "Restored access"].includes(entry.action),
                          )
                          .slice(0, 4)
                          .map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-[calc(var(--radius)+2px)] border border-border bg-surface-muted p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                                <StatusBadge tone={activityTone[entry.tone]}>
                                  {formatRelativeShort(entry.time)}
                                </StatusBadge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {entry.actor} · {entry.target}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {activeSection === "email" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">Email Accounts</p>
                <p className="text-sm text-muted-foreground">
                  Connect your email accounts to automatically sync conversations with your contacts.
                </p>
              </div>
              <EmailSettingsSection />
            </>
          ) : null}

          {activeSection === "integrations" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">Integrations</p>
                <p className="text-sm text-muted-foreground">
                  Centralize communication and automation by keeping channel auth visible and scoped.
                </p>
              </div>
              <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
                {integrations.map((integration) => {
                  const connected = integration.status === "Connected";

                  return (
                    <div
                      key={integration.name}
                      className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {integration.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {integration.detail}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge tone={connected ? "success" : integration.status === "Planned" ? "info" : "neutral"}>
                            {integration.status}
                          </StatusBadge>
                          <StatusBadge tone="neutral">{integration.auth}</StatusBadge>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          variant={connected ? "success" : "info"}
                          onClick={() => handleConnect(integration.name)}
                        >
                          {connected ? (
                            <>
                              <Check className="size-4" />
                              Connected
                            </>
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {activeSection === "ai" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">AI Settings</p>
                <p className="text-sm text-muted-foreground">
                  Decide how the assistant behaves across inbox, deals, and operational workflows.
                </p>
              </div>
              <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
                <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                  <p className="text-sm font-semibold text-foreground">Preferred model</p>
                  <div className="mt-4 space-y-2">
                    {["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"].map((model) => (
                      <button
                        key={model}
                        onClick={() => handleModelSelect(model)}
                        className={`flex w-full items-center justify-between rounded-[calc(var(--radius)+2px)] border px-3 py-3 text-sm font-medium transition-colors ${
                          aiModel === model
                            ? "border-primary bg-primary text-foreground"
                            : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {model}
                        {aiModel === model ? <Check className="size-4 text-primary" /> : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                    <p className="text-sm font-semibold text-foreground">Assistant posture</p>
                    <div className="mt-4 space-y-3">
                      {[
                        "Compact AI rail stays minimized until you open deeper context.",
                        "Reply drafting can prefill follow-ups, summaries, and next-best actions.",
                        "Deal and contact actions can use AI suggestions before data is saved.",
                      ].map((item) => (
                        <div key={item} className="rounded-[calc(var(--radius)+2px)] border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[calc(var(--radius)+4px)] border border-success bg-success-soft p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl border border-success bg-surface-strong text-success">
                        <Bot className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          AI assistance is active
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          The assistant can summarize threads, propose actions, and support operator workflows without taking over the interface.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {activeSection === "appearance" ? (
            <>
              <div className="border-b border-border px-5 py-5">
                <p className="text-sm font-semibold text-foreground">Appearance</p>
                <p className="text-sm text-muted-foreground">
                  Shape the CRM experience across bright daylight and deep night operations.
                </p>
              </div>
              <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
                <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                  <p className="text-sm font-semibold text-foreground">Color mode</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {[
                      {
                        value: "light" as const,
                        label: "Light",
                        icon: SunMedium,
                      },
                      {
                        value: "dark" as const,
                        label: "Dark",
                        icon: MoonStar,
                      },
                      {
                        value: "system" as const,
                        label: "System",
                        icon: Laptop,
                      },
                    ].map((option) => {
                      const Icon = option.icon;
                      const selected = theme === option.value;

                      return (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value)}
                          className={`flex items-center justify-between rounded-[calc(var(--radius)+2px)] border px-3 py-3 text-sm font-medium transition-colors ${
                            selected
                              ? "border-primary bg-primary text-foreground"
                              : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Icon className="size-4" />
                            {option.label}
                          </span>
                          {selected ? <Check className="size-4 text-primary" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Active mode:{" "}
                    <span className="font-semibold text-foreground">{resolvedTheme}</span>
                  </p>
                </div>

                <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                  <p className="text-sm font-semibold text-foreground">UI density</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["compact", "comfortable", "spacious"].map((density) => (
                      <button
                        key={density}
                        onClick={() => setUiDensity(density)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          uiDensity === density
                            ? "border-primary bg-primary text-primary"
                            : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {density}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4">
                  <p className="text-sm font-semibold text-foreground">Chart emphasis</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["bold", "balanced", "subtle"].map((style) => (
                      <button
                        key={style}
                        onClick={() => setChartStyle(style)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          chartStyle === style
                            ? "border-primary bg-primary text-primary"
                            : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-surface-strong p-4 lg:col-span-2">
                  <p className="text-sm font-semibold text-foreground">Current design direction</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    CRMP now favors vibrant clarity: brighter accents, stronger chart contrast, cleaner hierarchy, and a reliable dark mode for late-session workflows.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </SurfaceCard>
      </div>
    </div>
  );
}

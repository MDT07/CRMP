import { useEffect, useState } from "react";
import {
  Bell,
  Bot,
  Check,
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

import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import {
  buildApiKeyRecordFromWorkspaceApiKey,
  buildTeamMembersFromWorkspaceMembers,
  createApiToken,
  createLocalInvite,
  getDefaultPermissionsForRole,
  loadStoredAdminConsoleState,
  maskApiKey,
  roleLabels,
  storeAdminConsoleState,
  type AdminConsoleState,
  type ApiKeyRecord,
} from "../../lib/crm-admin";
import type { WorkspaceRole } from "../../lib/crm-api";
import {
  fetchWorkspaceApiKeys,
  fetchWorkspaceMembers,
} from "../../lib/crm-api";
import { getInitials } from "../../lib/crm-format";
import { useCrmApp } from "../../providers/CrmProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { EmailSettingsSection } from "../email/EmailSettingsSection";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const sections = [
  { id: "profile" as const, icon: User, label: "Profile" },
  { id: "team" as const, icon: Users, label: "Team" },
  { id: "notifications" as const, icon: Bell, label: "Notifications" },
  { id: "security" as const, icon: Shield, label: "Security" },
  { id: "email" as const, icon: Mail, label: "Email" },
  { id: "integrations" as const, icon: Globe, label: "Integrations" },
  { id: "ai" as const, icon: Zap, label: "AI" },
  { id: "appearance" as const, icon: Palette, label: "Appearance" },
];

type SectionId = (typeof sections)[number]["id"];

const integrationsList = [
  { name: "Gmail", status: "Connected", detail: "Two-way inbox sync" },
  { name: "WhatsApp", status: "Connected", detail: "Unified inbox & templates" },
  { name: "Slack", status: "Not connected", detail: "Deal alerts & escalations" },
  { name: "Zapier", status: "Not connected", detail: "Event-based automation" },
];

const avatarThemes = [
  "bg-primary text-white",
  "bg-info text-white",
  "bg-warning text-white",
] as const;

const roleOptions: WorkspaceRole[] = ["admin", "manager", "rep"];

export function SettingsPage() {
  const { clearAssistantSelection, connection, isGuest, setAssistantSelection, signOut, user, workspace } = useCrmApp();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [integrations, setIntegrations] = useState(integrationsList);
  const [notifs, setNotifs] = useState({ email: true, desktop: true, deals: true, tasks: true });
  const [aiModel, setAiModel] = useState("gpt-4.1-mini");
  const [adminConsole, setAdminConsole] = useState<AdminConsoleState>(() => loadStoredAdminConsoleState(user?.name ?? workspace.name));
  const [liveApiKeys, setLiveApiKeys] = useState<ApiKeyRecord[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("rep");

  const isLive = connection === "live" || connection === "bootstrapped";
  const displayName = user?.name ?? workspace.name;
  const initials = getInitials(displayName);

  useEffect(() => {
    storeAdminConsoleState(adminConsole);
  }, [adminConsole]);

  useEffect(() => {
    if (!isLive) return;
    fetchWorkspaceMembers().then((members) => {
      setAdminConsole((c) => ({ ...c, teamMembers: buildTeamMembersFromWorkspaceMembers(members) }));
    }).catch(() => {});
    fetchWorkspaceApiKeys().then((keys) => {
      setLiveApiKeys(keys.map((k) => buildApiKeyRecordFromWorkspaceApiKey(k)));
    }).catch(() => {});
  }, [isLive]);

  useEffect(() => {
    setAssistantSelection(buildPageAssistantSelection({
      page: "Settings", route: "/settings",
      dataSource: connection === "loading" ? "loading" : connection === "fallback" || connection === "guest" ? "preview" : "live",
      selectedEntities: [], summary: "Workspace configuration",
    }));
    return () => clearAssistantSelection();
  }, [connection, clearAssistantSelection, setAssistantSelection]);

  const handleInvite = () => {
    if (!inviteEmail.trim()) { toast.warning("Enter email"); return; }
    const member = createLocalInvite(displayName, inviteEmail, inviteRole);
    setAdminConsole((c) => ({ ...c, teamMembers: [member, ...c.teamMembers] }));
    setInviteEmail("");
    toast.success(`${inviteEmail} invited as ${roleLabels[inviteRole]}`);
  };

  const handleRoleChange = (memberId: string, role: WorkspaceRole) => {
    setAdminConsole((c) => ({
      ...c, teamMembers: c.teamMembers.map((m) => m.id === memberId ? { ...m, role, permissions: getDefaultPermissionsForRole(role) } : m),
    }));
    toast.success("Role updated");
  };

  const handleToggleIntegration = (name: string) => {
    setIntegrations((prev) => prev.map((i) => i.name === name ? { ...i, status: i.status === "Connected" ? "Not connected" : "Connected" } : i));
    toast.success(`${name} ${integrations.find((i) => i.name === name)?.status === "Connected" ? "disconnected" : "connected"}`);
  };

  const handleCreateApiKey = (scope: ApiKeyRecord["scope"]) => {
    const token = createApiToken();
    const key: ApiKeyRecord = {
      id: `key-${Date.now()}`,
      name: `${scope} key`,
      scope,
      modules: scope === "server" ? ["contacts", "deals", "inbox", "analytics"] : scope === "automation" ? ["automations", "deals", "inbox"] : ["contacts"],
      status: "active",
      prefix: scope.slice(0, 4),
      token,
      maskedToken: maskApiKey(token),
      createdAt: new Date().toISOString(),
      createdBy: displayName,
    };
    setAdminConsole((c) => ({ ...c, apiKeys: [key, ...c.apiKeys] }));
    toast.success("API key created");
  };

  const handleRevokeApiKey = (id: string) => {
    setAdminConsole((c) => ({ ...c, apiKeys: c.apiKeys.map((k) => k.id === id ? { ...k, status: "revoked" as const } : k) }));
    toast.success("API key revoked");
  };

  const handleSignOut = async () => { await signOut(); toast.success("Signed out"); };

  const apiKeys = isLive ? liveApiKeys : adminConsole.apiKeys;
  const activeKeyCount = apiKeys.filter((k) => k.status === "active").length;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Settings"
        description="Workspace configuration and preferences"
        meta={
          <StatusBadge tone={connection === "live" ? "success" : connection === "bootstrapped" ? "info" : "warning"}>
            {connection === "live" ? "Live" : connection === "bootstrapped" ? "Starter" : "Preview"}
          </StatusBadge>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
            <LogOut className="size-4 mr-1.5" />
            {isGuest ? "Exit guest" : "Sign out"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[13rem_1fr]">
        {/* Sidebar */}
        <div className="space-y-2">
          <nav className="space-y-0.5">
            {sections.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activeSection === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
          <div className="rounded-lg border border-border/50 bg-surface-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{workspace.name}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">{adminConsole.teamMembers.length} members · {activeKeyCount} keys</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Profile */}
          {activeSection === "profile" && (
            <div className="space-y-4">
              <SurfaceCard className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex size-14 items-center justify-center rounded-xl text-lg font-bold ${avatarThemes[avatarIndex]}`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{displayName}</p>
                    <p className="text-sm text-muted-foreground">{user?.email ?? "operator@emirco.local"}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setAvatarIndex((i) => (i + 1) % avatarThemes.length)}>
                    <RefreshCcw className="size-4" />
                  </Button>
                </div>
              </SurfaceCard>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Name</label>
                  <Input defaultValue={displayName} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Email</label>
                  <Input defaultValue={user?.email ?? "operator@emirco.local"} type="email" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Role</label>
                  <Input defaultValue={user?.role ?? "admin"} disabled className="bg-surface-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Timezone</label>
                  <Input defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} disabled className="bg-surface-muted" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => toast.success("Profile saved")}>
                  <Check className="size-4 mr-1.5" />
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Team */}
          {activeSection === "team" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Email to invite" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)} className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm">
                  {roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                </select>
                <Button size="sm" onClick={handleInvite}><Plus className="size-4" /></Button>
              </div>

              <div className="space-y-2">
                {adminConsole.teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3 hover:bg-surface-muted/50 transition-colors">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {getInitials(member.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as WorkspaceRole)}
                      className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs"
                    >
                      {roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                    </select>
                    <StatusBadge tone={member.status === "active" ? "success" : "warning"} size="sm">{member.status}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <div className="space-y-3">
              {Object.entries(notifs).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div className="flex items-center gap-3">
                    <Bell className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium capitalize">{key} notifications</p>
                      <p className="text-xs text-muted-foreground">Receive {key} alerts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifs((n) => ({ ...n, [key]: !value }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${value ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security */}
          {activeSection === "security" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCreateApiKey("server")}>
                  <Key className="size-4 mr-1.5" /> Server key
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCreateApiKey("automation")}>
                  <Zap className="size-4 mr-1.5" /> Automation
                </Button>
              </div>

              <div className="space-y-2">
                {(isLive ? liveApiKeys : adminConsole.apiKeys).map((key) => (
                  <div key={key.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                    <Key className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{key.token ? maskApiKey(key.token) : key.maskedToken}</p>
                    </div>
                    <StatusBadge tone={key.status === "active" ? "success" : "neutral"} size="sm">{key.status}</StatusBadge>
                    <Button size="sm" variant="ghost" onClick={() => handleRevokeApiKey(key.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email */}
          {activeSection === "email" && <EmailSettingsSection />}

          {/* Integrations */}
          {activeSection === "integrations" && (
            <div className="space-y-3">
              {integrations.map((integration) => {
                const connected = integration.status === "Connected";
                return (
                  <div key={integration.name} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="flex items-center gap-3">
                      <Globe className={`size-4 ${connected ? "text-success" : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-medium">{integration.name}</p>
                        <p className="text-xs text-muted-foreground">{integration.detail}</p>
                      </div>
                    </div>
                    <Button size="sm" variant={connected ? "outline" : "default"} onClick={() => handleToggleIntegration(integration.name)}>
                      {connected ? "Disconnect" : "Connect"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI */}
          {activeSection === "ai" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">AI Model</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"].map((model) => (
                    <button
                      key={model}
                      onClick={() => setAiModel(model)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        aiModel === model ? "border-primary bg-primary/5 text-primary" : "border-border/50 hover:border-border"
                      }`}
                    >
                      {model}
                      {aiModel === model && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              </div>
              <SurfaceCard className="p-4">
                <div className="flex items-start gap-3">
                  <Bot className="size-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">AgentP Assistant</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI-powered CRM assistant for deal insights, email drafting, and task prioritization.
                    </p>
                  </div>
                </div>
              </SurfaceCard>
            </div>
          )}

          {/* Appearance */}
          {activeSection === "appearance" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Theme</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { value: "light" as const, label: "Light", icon: SunMedium },
                    { value: "dark" as const, label: "Dark", icon: MoonStar },
                    { value: "system" as const, label: "System", icon: Laptop },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        theme === value ? "border-primary bg-primary/5 text-primary" : "border-border/50 hover:border-border"
                      }`}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 p-4">
                <p className="text-sm font-medium">Preview</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {resolvedTheme} mode
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

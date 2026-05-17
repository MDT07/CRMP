export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export type WorkspaceRole = "admin" | "manager" | "rep";

export interface AuthenticatedUser {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  is_active: boolean;
  organization?: OrganizationSummary | null;
}

export interface WorkspaceStats {
  members: number;
  companies: number;
  contacts: number;
  deals: number;
  projects: number;
  tasks: number;
  messages: number;
}

export interface Workspace {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug: string;
  industry?: string | null;
  size?: string | null;
  domain?: string | null;
  is_active: boolean;
  extra_data: Record<string, unknown>;
  stats: WorkspaceStats;
  crm_ready: boolean;
}

export interface DashboardMetrics {
  total_revenue: number;
  active_clients: number;
  deals_closed: number;
  conversion_rate: number;
}

export interface AssistantMessageResponse {
  content: string;
  mode: string;
}

export interface GrowthPoint {
  label: string;
  revenue: number;
  deals_closed: number;
  leads_created: number;
}

export interface DashboardOverview {
  metrics: DashboardMetrics;
  growth: GrowthPoint[];
}

export interface Company {
  id: string;
  organization_id: string;
  name: string;
  industry?: string | null;
  size?: string | null;
  domain?: string | null;
  extra_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ContactStatus = "lead" | "active" | "inactive" | "customer";

export interface Contact {
  id: string;
  organization_id: string;
  owner_user_id?: string | null;
  company_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: ContactStatus;
  lead_score: number;
  tags: string[];
  extra_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Deal {
  id: string;
  organization_id: string;
  contact_id: string;
  owner_user_id?: string | null;
  title: string;
  pipeline_stage: DealStage;
  amount: number | string;
  currency: string;
  probability: number;
  expected_close_date?: string | null;
  source?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "cancelled";

export interface Project {
  id: string;
  organization_id: string;
  deal_id: string;
  owner_user_id?: string | null;
  name: string;
  status: ProjectStatus;
  kickoff_date?: string | null;
  target_end_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "email" | "chat" | "api";

export interface Message {
  id: string;
  organization_id: string;
  deal_id?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  author_user_id?: string | null;
  direction: MessageDirection;
  channel: MessageChannel;
  subject?: string | null;
  body: string;
  external_message_id?: string | null;
  payload_meta: Record<string, unknown>;
  ai_lead_score?: number | null;
  ai_intent?: string | null;
  ai_priority?: string | null;
  ai_sentiment?: number | null;
  ai_product_relevance?: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskSource = "manual" | "automation";

export interface Task {
  id: string;
  organization_id: string;
  deal_id?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  assignee_id?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  due_at?: string | null;
  source: TaskSource;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  event_type: string;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleRun {
  id: string;
  organization_id: string;
  rule_id: string;
  source_event_id?: string | null;
  status: string;
  detail?: string | null;
  payload: Record<string, unknown>;
  executed_at: string;
}

export interface PipelineStagePoint {
  stage: DealStage;
  count: number;
  value: number;
}

export interface ChannelMixPoint {
  channel: MessageChannel;
  inbound_count: number;
  outbound_count: number;
  total_count: number;
}

export interface RepPerformancePoint {
  user_id: string;
  name: string;
  open_deals: number;
  won_deals: number;
  won_revenue: number;
  open_tasks: number;
}

export interface WorkspaceBootstrapResponse {
  seeded: boolean;
  detail: string;
  workspace: Workspace;
}

export interface AiRecommendationsResponse {
  items: { id: string; title: string; description: string; priority: number }[];
}

export interface ProjectAreaSummary {
  path: string;
  file_count: number;
  last_modified_at?: string | null;
}

export interface ProjectFileSignal {
  path: string;
  reason: string;
  score: number;
  last_modified_at: string;
}

export interface ProjectDecisionHint {
  title: string;
  detail: string;
  confidence: "low" | "medium" | "high" | string;
}

export interface ProjectFocusMatch {
  path: string;
  source: "path" | "content";
  line?: number | null;
  snippet: string;
}

export interface WorkspaceMember {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ApiKeyScope = "server" | "public" | "automation";
export type ApiKeyModule =
  | "contacts"
  | "deals"
  | "inbox"
  | "automations"
  | "analytics"
  | "settings";

export interface WorkspaceApiKey {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  created_by_user_id: string;
  revoked_by_user_id?: string | null;
  name: string;
  scope: ApiKeyScope;
  modules: ApiKeyModule[];
  status: string;
  prefix: string;
  masked_token: string;
  created_by_name?: string | null;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface WorkspaceApiKeyCreateResponse {
  api_key: WorkspaceApiKey;
  secret: string;
}

interface SessionResponse {
  token_type: string;
  expires_in: number;
  user: AuthenticatedUser;
}

export interface CrmSession {
  tokenType: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegistrationPayload {
  organizationName: string;
  organizationSlug: string;
  name: string;
  email: string;
  password: string;
}

interface CompanyCreatePayload {
  name: string;
  industry?: string | null;
  size?: string | null;
  domain?: string | null;
  extra_data?: Record<string, unknown>;
}

interface ContactCreatePayload {
  owner_user_id?: string | null;
  company_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: ContactStatus;
  tags?: string[];
  extra_data?: Record<string, unknown>;
}

interface DealCreatePayload {
  contact_id: string;
  owner_user_id?: string | null;
  title: string;
  pipeline_stage?: DealStage;
  amount?: number;
  currency?: string;
  probability?: number;
  expected_close_date?: string | null;
  source?: string | null;
  description?: string | null;
}

interface DealStageUpdatePayload {
  pipeline_stage: DealStage;
  probability?: number;
}

interface ProjectCreatePayload {
  deal_id: string;
  owner_user_id?: string | null;
  name: string;
  status?: ProjectStatus;
  kickoff_date?: string | null;
  target_end_date?: string | null;
  notes?: string | null;
}

interface ProjectConvertPayload {
  owner_user_id?: string | null;
  name?: string | null;
  kickoff_date?: string | null;
  target_end_date?: string | null;
  notes?: string | null;
}

interface ProjectUpdatePayload {
  owner_user_id?: string | null;
  name?: string;
  status?: ProjectStatus;
  kickoff_date?: string | null;
  target_end_date?: string | null;
  notes?: string | null;
}

interface MessageCreatePayload {
  deal_id?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  author_user_id?: string | null;
  direction: MessageDirection;
  channel: MessageChannel;
  subject?: string | null;
  body: string;
  external_message_id?: string | null;
  payload_meta?: Record<string, unknown>;
}

interface TaskCreatePayload {
  deal_id?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  assignee_id?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  due_at?: string | null;
  source?: TaskSource;
}

interface TaskUpdatePayload {
  deal_id?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  assignee_id?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  due_at?: string | null;
  source?: TaskSource;
}

interface AutomationRuleCreatePayload {
  name: string;
  description?: string | null;
  event_type: string;
  conditions?: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  is_active?: boolean;
}

interface AutomationRuleUpdatePayload {
  name?: string;
  description?: string | null;
  event_type?: string;
  conditions?: Record<string, unknown>;
  actions?: Array<Record<string, unknown>>;
  is_active?: boolean;
}

interface WorkspaceApiKeyCreatePayload {
  name?: string;
  scope: ApiKeyScope;
  modules: ApiKeyModule[];
}

export class CrmApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CrmApiError";
    this.status = status;
  }
}

function getDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000/api/v1";
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${window.location.hostname || "127.0.0.1"}:8000/api/v1`;
}

function getApiBaseUrl() {
  return (import.meta.env.VITE_CRMP_API_URL ?? getDefaultApiBaseUrl()).replace(/\/$/, "");
}

function buildClientTraceId() {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const maybeUuid = globalThis.crypto?.randomUUID?.();
    if (maybeUuid) {
      return maybeUuid.replace(/-/g, "");
    }
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    clientTraceId?: string;
  } = {}
) {
  const hasBody = options.body !== undefined;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      "X-Client-Trace-Id": options.clientTraceId ?? buildClientTraceId(),
    },
    credentials: "include",
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : response.statusText || "Request failed.";
    throw new CrmApiError(detail, response.status);
  }

  return payload as T;
}

async function login(payload: LoginPayload) {
  return request<SessionResponse>("/auth/login", {
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
    },
  });
}

async function register(payload: RegistrationPayload) {
  return request<SessionResponse>("/auth/register", {
    method: "POST",
    body: {
      organization_name: payload.organizationName,
      organization_slug: payload.organizationSlug,
      name: payload.name,
      email: payload.email,
      password: payload.password,
    },
  });
}

function buildSession(response: SessionResponse): CrmSession {
  return {
    tokenType: response.token_type,
    expiresIn: response.expires_in,
    user: response.user,
  };
}

export function clearCrmSession() {
  return;
}

export function hasStoredCrmSession() {
  return false;
}

export async function restoreCrmSession() {
  try {
    const user = await request<AuthenticatedUser>("/auth/me");
    return {
      tokenType: "session",
      expiresIn: 0,
      user,
    };
  } catch (error) {
    if (error instanceof CrmApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }

    throw error;
  }
}

export async function loginToCrm(payload: LoginPayload) {
  const response = await login(payload);
  return buildSession(response);
}

export async function registerToCrm(payload: RegistrationPayload) {
  const response = await register(payload);
  return buildSession(response);
}

export async function logoutFromCrm() {
  return request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export async function fetchCrmHealth() {
  return request<{ status: string }>("/health");
}

async function requestWithSession<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    clientTraceId?: string;
  } = {}
) {
  return request<T>(path, {
    method: options.method,
    body: options.body,
    clientTraceId: options.clientTraceId,
  });
}

export async function fetchCurrentWorkspace() {
  return requestWithSession<Workspace>("/organizations/current");
}

export async function bootstrapCurrentWorkspace() {
  return request<WorkspaceBootstrapResponse>("/organizations/current/bootstrap", {
    method: "POST",
  });
}

export async function fetchDashboardOverview() {
  return requestWithSession<DashboardOverview>("/analytics/dashboard");
}

export async function fetchGrowthSeries() {
  return requestWithSession<GrowthPoint[]>("/analytics/growth");
}

export async function fetchPipelineBreakdown() {
  return requestWithSession<PipelineStagePoint[]>("/analytics/pipeline");
}

export async function fetchChannelMix() {
  return requestWithSession<ChannelMixPoint[]>("/analytics/channels");
}

export async function fetchRepPerformance() {
  return requestWithSession<RepPerformancePoint[]>("/analytics/reps");
}

export async function fetchWorkspaceMembers() {
  return requestWithSession<WorkspaceMember[]>("/organizations/current/members");
}

export async function fetchWorkspaceApiKeys() {
  return requestWithSession<WorkspaceApiKey[]>("/organizations/current/api-keys");
}

export async function createWorkspaceApiKey(payload: WorkspaceApiKeyCreatePayload) {
  return requestWithSession<WorkspaceApiKeyCreateResponse>("/organizations/current/api-keys", {
    method: "POST",
    body: payload,
  });
}

export async function revokeWorkspaceApiKey(apiKeyId: string) {
  return requestWithSession<WorkspaceApiKey>(`/organizations/current/api-keys/${apiKeyId}/revoke`, {
    method: "POST",
  });
}

export async function fetchCompanies(limit = 100) {
  return requestWithSession<Company[]>(`/companies/${buildQuery({ limit })}`);
}

export async function createCompany(payload: CompanyCreatePayload) {
  return requestWithSession<Company>("/companies/", {
    method: "POST",
    body: payload,
  });
}

export async function fetchContacts(limit = 100) {
  return requestWithSession<Contact[]>(`/contacts/${buildQuery({ limit })}`);
}

export async function createContact(payload: ContactCreatePayload) {
  return requestWithSession<Contact>("/contacts/", {
    method: "POST",
    body: payload,
  });
}

export async function fetchDeals(limit = 100) {
  return requestWithSession<Deal[]>(`/deals/${buildQuery({ limit })}`);
}

export async function createDeal(payload: DealCreatePayload) {
  return requestWithSession<Deal>("/deals/", {
    method: "POST",
    body: payload,
  });
}

export async function updateDeal(dealId: string, payload: Partial<Deal>) {
  return requestWithSession<Deal>(`/deals/${dealId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function updateDealStage(dealId: string, payload: DealStageUpdatePayload) {
  return requestWithSession<Deal>(`/deals/${dealId}/stage`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchProjects(limit = 100) {
  return requestWithSession<Project[]>(`/projects/${buildQuery({ limit })}`);
}

export async function createProject(payload: ProjectCreatePayload) {
  return requestWithSession<Project>("/projects/", {
    method: "POST",
    body: payload,
  });
}

export async function convertDealToProject(dealId: string, payload: ProjectConvertPayload = {}) {
  return requestWithSession<Project>(`/projects/from-deal/${dealId}`, {
    method: "POST",
    body: payload,
  });
}

export async function updateProject(projectId: string, payload: ProjectUpdatePayload) {
  return requestWithSession<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function fetchMessages(limit = 100) {
  return requestWithSession<Message[]>(`/messages/${buildQuery({ limit })}`);
}

export async function createMessage(payload: MessageCreatePayload) {
  return requestWithSession<Message>("/messages/", {
    method: "POST",
    body: payload,
  });
}

export async function fetchTasks(limit = 100) {
  return requestWithSession<Task[]>(`/tasks/${buildQuery({ limit })}`);
}

export async function createTask(payload: TaskCreatePayload) {
  return requestWithSession<Task>("/tasks/", {
    method: "POST",
    body: payload,
  });
}

export async function updateTask(taskId: string, payload: TaskUpdatePayload) {
  return requestWithSession<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function fetchAutomationRules() {
  return requestWithSession<AutomationRule[]>("/automations/rules");
}

export async function createAutomationRule(payload: AutomationRuleCreatePayload) {
  return requestWithSession<AutomationRule>("/automations/rules", {
    method: "POST",
    body: payload,
  });
}

export async function updateAutomationRule(ruleId: string, payload: AutomationRuleUpdatePayload) {
  return requestWithSession<AutomationRule>(`/automations/rules/${ruleId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function fetchAutomationRuleRuns(ruleId: string, limit = 50) {
  return requestWithSession<AutomationRuleRun[]>(
    `/automations/rules/${ruleId}/runs${buildQuery({ limit })}`
  );
}

export interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  display_name?: string;
  sync_enabled: boolean;
  last_sync_at?: string;
  created_at: string;
}

export interface EmailAccountUpdatePayload {
  sync_enabled?: boolean;
  display_name?: string;
}

export interface EmailMessage {
  id: string;
  account_id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  cc_emails?: string[];
  body_text?: string;
  body_html?: string;
  snippet?: string;
  is_read: boolean;
  is_sent: boolean;
  sent_at?: string;
  received_at?: string;
  created_at?: string;
  has_attachments?: boolean;
  attachments?: { filename: string; size: number }[];
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  message_count: number;
  last_message_at: string;
}

export async function fetchEmailAccounts() {
  return requestWithSession<{ accounts: EmailAccount[] }>("/email/accounts");
}

export async function connectGmailAccount() {
  return requestWithSession<{ auth_url: string }>("/email/connect/gmail", {
    method: "POST",
  });
}

export async function updateEmailAccount(accountId: string, payload: EmailAccountUpdatePayload) {
  return requestWithSession<EmailAccount>(`/email/accounts/${accountId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEmailAccount(accountId: string) {
  return requestWithSession<void>(`/email/accounts/${accountId}`, {
    method: "DELETE",
  });
}

export async function syncEmails(accountId?: string) {
  return requestWithSession<{ synced: number }>("/email/sync", {
    method: "POST",
    body: accountId ? { account_id: accountId } : {},
  });
}

export async function fetchEmailMessages(params?: {
  account_id?: string;
  contact_id?: string;
  deal_id?: string;
  is_read?: boolean;
  limit?: number;
  offset?: number;
}) {
  // Convert boolean to string for query params
  const queryParams: Record<string, string | number | undefined> = {};
  if (params) {
    if (params.account_id) queryParams.account_id = params.account_id;
    if (params.contact_id) queryParams.contact_id = params.contact_id;
    if (params.is_read !== undefined) queryParams.is_read = params.is_read ? "true" : "false";
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.offset !== undefined) queryParams.offset = params.offset;
  }
  return requestWithSession<{ messages: EmailMessage[]; next_cursor?: string }>(
    `/email/messages${buildQuery(queryParams)}`
  );
}

export async function fetchEmailMessage(messageId: string) {
  return requestWithSession<EmailMessage>(`/email/messages/${messageId}`);
}

export async function updateEmailMessage(
  messageId: string,
  payload: { is_read?: boolean; is_archived?: boolean }
) {
  return requestWithSession<EmailMessage>(`/email/messages/${messageId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function fetchEmailThreads(params?: {
  account_id?: string;
  contact_id?: string;
  deal_id?: string;
  limit?: number;
  offset?: number;
}) {
  return requestWithSession<{ threads: EmailThread[]; next_cursor?: string }>(
    `/email/threads${buildQuery(params)}`
  );
}

export async function fetchEmailThread(threadId: string) {
  return requestWithSession<EmailThread & { messages: EmailMessage[] }>(
    `/email/threads/${threadId}`
  );
}

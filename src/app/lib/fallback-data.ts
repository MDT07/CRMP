// Shared fallback/preview data for guest mode and offline states
// This module centralizes all mock data used across the CRM pages

import type {
  Workspace,
  DashboardOverview,
  ContactStatus,
  DealStage,
  Deal,
  Project,
  TaskStatus,
  MessageChannel,
  PipelineStagePoint,
  ChannelMixPoint,
  RepPerformancePoint,
} from "./crm-api";

// ============================================================
// Provider-level fallback data
// ============================================================

export const guestWorkspace: Workspace = {
  id: "guest-workspace",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  name: "CRMP by EmirCo Guest Workspace",
  slug: "crmp-by-emirco-guest",
  industry: "CRM",
  size: "11-50",
  domain: "emirco.local",
  is_active: true,
  extra_data: { mode: "guest" },
  stats: {
    members: 8,
    companies: 48,
    contacts: 1247,
    deals: 24,
    projects: 9,
    tasks: 17,
    messages: 36,
  },
  crm_ready: true,
};

export const guestDashboard: DashboardOverview = {
  metrics: {
    total_revenue: 124000,
    active_clients: 1247,
    deals_closed: 14,
    conversion_rate: 42.5,
  },
  growth: [
    { label: "Jan 20", revenue: 6200, deals_closed: 1, leads_created: 6 },
    { label: "Jan 27", revenue: 8900, deals_closed: 1, leads_created: 7 },
    { label: "Feb 03", revenue: 10400, deals_closed: 1, leads_created: 8 },
    { label: "Feb 10", revenue: 12600, deals_closed: 2, leads_created: 9 },
    { label: "Feb 17", revenue: 14100, deals_closed: 2, leads_created: 10 },
    { label: "Feb 24", revenue: 16800, deals_closed: 2, leads_created: 11 },
    { label: "Mar 03", revenue: 19200, deals_closed: 2, leads_created: 12 },
    { label: "Mar 10", revenue: 22400, deals_closed: 3, leads_created: 13 },
  ],
};

// ============================================================
// Clients/ClientsPage fallback data
// ============================================================

export type ClientStatusLabel = "Active" | "Lead" | "Customer" | "Inactive";

interface ClientRow {
  id: number | string;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: string;
  status: ClientStatusLabel;
  tag: string;
  starred: boolean;
  avatar: string;
}

export const fallbackClients: ClientRow[] = [
  { id: 1, name: "Sarah Mitchell", company: "Nexus Corp", email: "sarah@nexuscorp.com", phone: "+1 555 0192", value: "$48,000", status: "Active", tag: "Enterprise", starred: true, avatar: "SM" },
  { id: 2, name: "James Hartwell", company: "TechCorp Inc.", email: "james@techcorp.com", phone: "+1 555 0284", value: "$32,500", status: "Active", tag: "SaaS", starred: true, avatar: "JH" },
  { id: 3, name: "Lena Vogt", company: "BlueSky Digital", email: "lena@bluesky.io", phone: "+1 555 0371", value: "$19,200", status: "Lead", tag: "Agency", starred: false, avatar: "LV" },
  { id: 4, name: "Carlos Mendes", company: "Vertex Solutions", email: "carlos@vertex.co", phone: "+1 555 0458", value: "$27,800", status: "Active", tag: "Consulting", starred: false, avatar: "CM" },
  { id: 5, name: "Aisha Patel", company: "NovaStar Ltd", email: "aisha@novastar.io", phone: "+1 555 0545", value: "$61,000", status: "Customer", tag: "Enterprise", starred: true, avatar: "AP" },
  { id: 6, name: "Tom Gallagher", company: "Forge Analytics", email: "tom@forge.ai", phone: "+1 555 0612", value: "$14,600", status: "Lead", tag: "SaaS", starred: false, avatar: "TG" },
  { id: 7, name: "Maria Schulz", company: "Prisma Media", email: "maria@prisma.de", phone: "+1 555 0743", value: "$22,100", status: "Active", tag: "Agency", starred: false, avatar: "MS" },
  { id: 8, name: "Daniel Kim", company: "Orbit Technologies", email: "daniel@orbitech.com", phone: "+1 555 0836", value: "$38,400", status: "Active", tag: "Tech", starred: false, avatar: "DK" },
];

export const clientDrafts = [
  { name: "Olivia Chen", company: "Summit Ventures", email: "olivia@summitventures.com", phone: "+1 555 0917", status: "lead" as const, tag: "Consulting" },
  { name: "Marcus Rivera", company: "Signal Labs", email: "marcus@signallabs.ai", phone: "+1 555 0971", status: "active" as const, tag: "Tech" },
  { name: "Nadia Brooks", company: "Harbor Studio", email: "nadia@harborstudio.io", phone: "+1 555 0994", status: "lead" as const, tag: "Agency" },
];

// ============================================================
// Pipeline/PipelinePage fallback data
// ============================================================

interface DealCard {
  id: number | string;
  company: string;
  contact: string;
  title: string;
  value: string;
  close: string;
  prob: number;
}

type DealBoard = Record<DealStage, DealCard[]>;

export const fallbackDeals: DealBoard = {
  lead: [
    { id: 1, company: "BlueSky Digital", contact: "Lena Vogt", title: "Creative rollout", value: "$19,200", close: "Mar 28", prob: 25 },
    { id: 2, company: "Forge Analytics", contact: "Tom Gallagher", title: "Analytics workspace", value: "$14,600", close: "Apr 5", prob: 30 },
  ],
  qualified: [
    { id: 3, company: "Orbit Technologies", contact: "Daniel Kim", title: "Sales enablement stack", value: "$38,400", close: "Mar 30", prob: 55 },
    { id: 4, company: "Vertex Solutions", contact: "Carlos Mendes", title: "Pipeline reporting", value: "$27,800", close: "Apr 8", prob: 60 },
  ],
  proposal: [
    { id: 5, company: "TechCorp Inc.", contact: "James Hartwell", title: "Expansion proposal", value: "$45,000", close: "Mar 20", prob: 87 },
    { id: 6, company: "CloudBase Inc.", contact: "Zoe Allen", title: "Growth cockpit", value: "$31,500", close: "Mar 25", prob: 72 },
  ],
  negotiation: [
    { id: 7, company: "Nexus Corp", contact: "Sarah Mitchell", title: "Enterprise rollout", value: "$48,000", close: "Mar 18", prob: 80 },
    { id: 8, company: "NovaStar Ltd", contact: "Aisha Patel", title: "Renewal package", value: "$61,000", close: "Mar 22", prob: 75 },
  ],
  closed_won: [
    { id: 9, company: "IronEdge Tech", contact: "Paul Newman", title: "Revenue operations", value: "$52,000", close: "Mar 10", prob: 100 },
    { id: 10, company: "Quantum AI", contact: "Lily Wang", title: "Automation launch", value: "$67,500", close: "Mar 8", prob: 100 },
  ],
  closed_lost: [],
};

export const dealTemplates: Record<DealStage, { title: string; amount: number; probability: number; closeInDays: number }> = {
  lead: { title: "Discovery sprint", amount: 16800, probability: 25, closeInDays: 18 },
  qualified: { title: "Qualified expansion", amount: 24400, probability: 58, closeInDays: 14 },
  proposal: { title: "Proposal package", amount: 37600, probability: 74, closeInDays: 10 },
  negotiation: { title: "Contract negotiation", amount: 54200, probability: 82, closeInDays: 6 },
  closed_won: { title: "Closed partnership", amount: 42300, probability: 100, closeInDays: -3 },
  closed_lost: { title: "Lost opportunity", amount: 12800, probability: 0, closeInDays: -5 },
};

// ============================================================
// Tasks/TasksPage fallback data
// ============================================================

interface TaskRow {
  id: number | string;
  title: string;
  client: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  done: boolean;
  status: TaskStatus;
}

export const fallbackTasks: TaskRow[] = [
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

export const taskTemplates = [
  { title: "Review expansion brief for Quantum AI", client: "Lily Wang", dueInDays: 1, priority: "High" as const },
  { title: "Send recap notes to Orbit Technologies", client: "Daniel Kim", dueInDays: 3, priority: "Medium" as const },
  { title: "Clean inbound lead tags", client: "Internal", dueInDays: 5, priority: "Low" as const },
];

// ============================================================
// Messages/MessagesPage fallback data
// ============================================================

interface ConversationSummary {
  id: string;
  name: string;
  company: string;
  preview: string;
  time: string;
  unread: number;
  avatar: string;
  channel: "email" | "chat" | "whatsapp";
  online: boolean;
  subject?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}

interface ConversationMessage {
  id: number | string;
  content: string;
  time: string;
  isMe: boolean;
}

export const fallbackConversations: ConversationSummary[] = [
  { id: "1", name: "Sarah Mitchell", company: "Nexus Corp", preview: "Can we schedule a call for the final contract review?", time: "2m", unread: 2, avatar: "SM", channel: "email", online: true },
  { id: "2", name: "James Hartwell", company: "TechCorp Inc.", preview: "The proposal looks great. We only have one pricing question.", time: "18m", unread: 1, avatar: "JH", channel: "chat", online: true },
  { id: "3", name: "Lena Vogt", company: "BlueSky Digital", preview: "Thanks for the follow-up. I will bring this to the team tomorrow.", time: "1h", unread: 0, avatar: "LV", channel: "whatsapp", online: false },
  { id: "4", name: "Carlos Mendes", company: "Vertex Solutions", preview: "When is the earliest we can lock the onboarding date?", time: "3h", unread: 0, avatar: "CM", channel: "email", online: false },
  { id: "5", name: "Aisha Patel", company: "NovaStar Ltd", preview: "I reviewed the contract and have two final comments for legal.", time: "1d", unread: 0, avatar: "AP", channel: "chat", online: false },
];

export const fallbackMessages: Record<string, ConversationMessage[]> = {
  "1": [
    { id: 1, content: "Hi! I wanted to follow up on the proposal you sent last week.", time: "10:22 AM", isMe: false },
    { id: 2, content: "Thanks for reaching out. I attached the updated version with the enterprise pricing breakdown.", time: "10:25 AM", isMe: true },
    { id: 3, content: "This looks really good. Can we schedule a call to discuss the enterprise tier?", time: "10:28 AM", isMe: false },
    { id: 4, content: "Absolutely. I am available Thursday afternoon or Friday morning. Which works better?", time: "10:31 AM", isMe: true },
    { id: 5, content: "Friday morning works great. Can we also review the final contract language?", time: "10:35 AM", isMe: false },
  ],
  "2": [
    { id: 1, content: "We like the proposal overall and want to move quickly.", time: "9:14 AM", isMe: false },
    { id: 2, content: "Great to hear. Which part should we tighten up first?", time: "9:18 AM", isMe: true },
    { id: 3, content: "Mostly pricing and rollout timing for the second team.", time: "9:22 AM", isMe: false },
  ],
  "3": [
    { id: 1, content: "Thanks for the demo recap. I will share it with leadership tomorrow.", time: "Yesterday", isMe: false },
  ],
  "4": [
    { id: 1, content: "When is the earliest onboarding slot still open?", time: "Yesterday", isMe: false },
    { id: 2, content: "We can likely reserve next Wednesday if we finalize today.", time: "Yesterday", isMe: true },
  ],
  "5": [
    { id: 1, content: "I reviewed the contract and have two final comments for legal.", time: "Yesterday", isMe: false },
  ],
};

// ============================================================
// Accounts/AccountsPage fallback data
// ============================================================

interface AccountHealth {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  contacts: number;
  champions: number;
  openDeals: number;
  expansionValue: number;
  health: number;
}

export const previewAccounts: AccountHealth[] = [
  { id: "preview-1", name: "Northstar Labs", domain: "northstarlabs.ai", industry: "AI Infrastructure", contacts: 26, champions: 5, openDeals: 4, expansionValue: 168000, health: 91 },
  { id: "preview-2", name: "Verto Retail Group", domain: "vertoretail.com", industry: "Retail", contacts: 19, champions: 3, openDeals: 2, expansionValue: 94000, health: 78 },
  { id: "preview-3", name: "Cloud Harbor", domain: "cloudharbor.io", industry: "SaaS", contacts: 14, champions: 2, openDeals: 3, expansionValue: 126000, health: 73 },
  { id: "preview-4", name: "Atlas Manufacturing", domain: "atlasmfg.co", industry: "Manufacturing", contacts: 11, champions: 1, openDeals: 1, expansionValue: 38000, health: 61 },
];

// ============================================================
// Forecast/ForecastPage fallback data
// ============================================================

export const previewDeals: Deal[] = [
  {
    id: "deal-preview-1",
    organization_id: "preview-org",
    contact_id: "preview-contact-1",
    title: "Northstar annual expansion",
    pipeline_stage: "negotiation",
    amount: 85000,
    currency: "USD",
    probability: 72,
    expected_close_date: new Date().toISOString(),
    source: "expansion",
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "deal-preview-2",
    organization_id: "preview-org",
    contact_id: "preview-contact-2",
    title: "Vertex onboarding package",
    pipeline_stage: "proposal",
    amount: 62000,
    currency: "USD",
    probability: 58,
    expected_close_date: new Date().toISOString(),
    source: "inbound",
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "deal-preview-3",
    organization_id: "preview-org",
    contact_id: "preview-contact-3",
    title: "Atlas pilot conversion",
    pipeline_stage: "qualified",
    amount: 47000,
    currency: "USD",
    probability: 42,
    expected_close_date: new Date().toISOString(),
    source: "outbound",
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "deal-preview-4",
    organization_id: "preview-org",
    contact_id: "preview-contact-4",
    title: "Cloud Harbor enterprise roll-out",
    pipeline_stage: "lead",
    amount: 78000,
    currency: "USD",
    probability: 24,
    expected_close_date: new Date().toISOString(),
    source: "partner",
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ============================================================
// Projects/ProjectsPage fallback data
// ============================================================

export const fallbackProjects: Project[] = [
  {
    id: "preview-project-1",
    organization_id: "preview-org",
    deal_id: "preview-deal-1",
    owner_user_id: null,
    name: "Northstar rollout implementation",
    status: "active",
    kickoff_date: new Date().toISOString().slice(0, 10),
    target_end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    notes: "Preview project created from a closed-won deal.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ============================================================
// Service/ServicePage fallback data
// ============================================================

interface ServiceTicket {
  id: string;
  customer: string;
  channel: string;
  subject: string;
  priority: "Low" | "Medium" | "High";
  ageHours: number;
  status: TaskStatus;
}

export const previewTickets: ServiceTicket[] = [
  { id: "svc-1", customer: "Northstar Labs", channel: "Email", subject: "Billing endpoint timeout after renewal", priority: "High", ageHours: 2, status: "in_progress" },
  { id: "svc-2", customer: "Atlas Manufacturing", channel: "Chat", subject: "Data export failed for finance team", priority: "High", ageHours: 4, status: "open" },
  { id: "svc-3", customer: "Cloud Harbor", channel: "Email", subject: "Need migration checklist for rollout", priority: "Medium", ageHours: 8, status: "open" },
  { id: "svc-4", customer: "Verto Retail Group", channel: "API", subject: "Webhook signatures mismatch in sandbox", priority: "Low", ageHours: 14, status: "open" },
];

// ============================================================
// Analytics/AnalyticsPage fallback data
// ============================================================

export function buildPreviewPipeline(): PipelineStagePoint[] {
  return [
    { stage: "lead", count: 320, value: 512000 },
    { stage: "qualified", count: 204, value: 391000 },
    { stage: "proposal", count: 138, value: 336000 },
    { stage: "negotiation", count: 86, value: 287000 },
    { stage: "closed_won", count: 63, value: 244000 },
    { stage: "closed_lost", count: 41, value: 112000 },
  ];
}

export function buildPreviewChannels(): ChannelMixPoint[] {
  return [
    { channel: "email", inbound_count: 48, outbound_count: 52, total_count: 100 },
    { channel: "chat", inbound_count: 33, outbound_count: 21, total_count: 54 },
    { channel: "api", inbound_count: 9, outbound_count: 7, total_count: 16 },
  ];
}

export function buildPreviewReps(): RepPerformancePoint[] {
  return [
    { user_id: "preview-1", name: "Maya Foster", open_deals: 8, won_deals: 5, won_revenue: 78200, open_tasks: 7 },
    { user_id: "preview-2", name: "Jonas Reed", open_deals: 6, won_deals: 3, won_revenue: 41500, open_tasks: 5 },
    { user_id: "preview-3", name: "Ayla Karim", open_deals: 4, won_deals: 2, won_revenue: 26300, open_tasks: 3 },
  ];
}
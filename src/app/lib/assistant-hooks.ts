import type { DashboardOverview, Workspace } from "./crm-api";

export interface AssistantActionResult {
  ok: boolean;
  detail: string;
}

export interface AssistantEntitySelection {
  entity_type: string;
  entity_id: string;
}

export interface PageAssistantSelection {
  kind: "page-context";
  page: string;
  route: string;
  dataSource: "live" | "preview" | "loading";
  selectedEntities: AssistantEntitySelection[];
  summary?: string;
}

export function getPageContext(input: {
  pathname: string;
  pageTitle: string;
  workspace: Workspace;
  dashboard: DashboardOverview;
  pageAwareContext: boolean;
}) {
  return {
    route: input.pathname,
    page_title: input.pageTitle,
    page_aware_context: input.pageAwareContext,
    workspace: {
      id: input.workspace.id,
      name: input.workspace.name,
      slug: input.workspace.slug,
      stats: input.workspace.stats,
    },
    dashboard_metrics: input.dashboard.metrics,
  };
}

export function getSelectionContext(
  selection: Record<string, unknown> | null | undefined = null,
) {
  if (!selection) {
    return { selected_items: [] as unknown[], selected_entities: [] as unknown[] };
  }

  const selectedEntities = Array.isArray(selection.selected_entities)
    ? selection.selected_entities
    : Array.isArray(selection.selectedEntities)
      ? selection.selectedEntities
      : [];

  const dataSource =
    typeof selection.data_source === "string"
      ? selection.data_source
      : typeof selection.dataSource === "string"
        ? selection.dataSource
        : "live";

  return {
    ...selection,
    data_source: dataSource,
    selected_entities: selectedEntities,
  };
}

export function buildPageAssistantSelection(input: {
  page: string;
  route: string;
  dataSource: "live" | "preview" | "loading";
  selectedEntities?: AssistantEntitySelection[];
  summary?: string;
}): PageAssistantSelection {
  return {
    kind: "page-context",
    page: input.page,
    route: input.route,
    dataSource: input.dataSource,
    selectedEntities: input.selectedEntities ?? [],
    summary: input.summary,
  };
}

export interface InboxAssistantSelection {
  kind: "inbox-thread";
  dataSource: "live" | "preview";
  page: "messages";
  threadId: string;
  threadLabel: string;
  participantName: string;
  company?: string;
  channel?: string;
  subject?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  messageIds: string[];
}

export function isInboxAssistantSelection(
  selection: Record<string, unknown> | null | undefined,
): selection is InboxAssistantSelection {
  if (!selection) {
    return false;
  }

  return (
    selection.kind === "inbox-thread" &&
    typeof selection.threadId === "string" &&
    typeof selection.threadLabel === "string" &&
    Array.isArray(selection.messageIds)
  );
}

const SAFE_ACTIONS = new Set([
  "summary",
  "deal",
  "reply",
  "next-step",
  "navigate_messages",
  "navigate_pipeline",
  "create_follow_up_task",
  "convert_deal_to_project",
]);

export async function executePermittedAction(
  actionId: string,
  payload: Record<string, unknown> = {},
): Promise<AssistantActionResult> {
  if (!SAFE_ACTIONS.has(actionId)) {
    return {
      ok: false,
      detail: `Action '${actionId}' is not in the safe-action registry.`,
    };
  }

  void payload;
  return {
    ok: true,
    detail: `Action '${actionId}' accepted by the safe-action registry.`,
  };
}

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HeartPulse,
  LifeBuoy,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import {
  fetchMessages,
  fetchTasks,
  type Message,
  type Task,
  type TaskStatus,
} from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { MetricCard, PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";

interface ServiceTicket {
  id: string;
  customer: string;
  channel: string;
  subject: string;
  priority: "Low" | "Medium" | "High";
  ageHours: number;
  status: TaskStatus;
}

const previewTickets: ServiceTicket[] = [
  {
    id: "svc-1",
    customer: "Northstar Labs",
    channel: "Email",
    subject: "Billing endpoint timeout after renewal",
    priority: "High",
    ageHours: 2,
    status: "in_progress",
  },
  {
    id: "svc-2",
    customer: "Atlas Manufacturing",
    channel: "Chat",
    subject: "Data export failed for finance team",
    priority: "High",
    ageHours: 4,
    status: "open",
  },
  {
    id: "svc-3",
    customer: "Cloud Harbor",
    channel: "Email",
    subject: "Need migration checklist for rollout",
    priority: "Medium",
    ageHours: 8,
    status: "open",
  },
  {
    id: "svc-4",
    customer: "Verto Retail Group",
    channel: "API",
    subject: "Webhook signatures mismatch in sandbox",
    priority: "Low",
    ageHours: 14,
    status: "open",
  },
];

function toPriority(message: Message) {
  if (message.ai_priority === "high") {
    return "High" as const;
  }

  if (message.ai_priority === "low") {
    return "Low" as const;
  }

  return "Medium" as const;
}

function buildTickets(messages: Message[], tasks: Task[]): ServiceTicket[] {
  if (!messages.length) {
    return previewTickets;
  }

  const supportTasks = tasks.filter((task) => task.status !== "done").slice(0, 12);
  const messageByTask = new Map(messages.map((message) => [message.id, message]));
  const inboundMessages = messages.filter((message) => message.direction === "inbound");

  return supportTasks.map((task, index) => {
    const linkedMessage =
      (task.contact_id
        ? inboundMessages.find((message) => message.contact_id === task.contact_id)
        : undefined) ??
      messageByTask.get(task.id) ??
      inboundMessages[index % inboundMessages.length];

    const createdAt = linkedMessage?.created_at ?? task.created_at;
    const ageHours = Math.max(
      1,
      Math.round((Date.now() - new Date(createdAt).getTime()) / 3600000)
    );

    return {
      id: task.id,
      customer: linkedMessage?.subject?.split("·")[0] ?? "Customer account",
      channel: linkedMessage?.channel.toUpperCase() ?? "EMAIL",
      subject: task.title || linkedMessage?.subject || "Service follow-up",
      priority: linkedMessage ? toPriority(linkedMessage) : ageHours > 10 ? "High" : "Medium",
      ageHours,
      status: task.status,
    };
  });
}

export function ServicePage() {
  const { clearAssistantSelection, connection, isGuest, setAssistantSelection, workspace } =
    useCrmApp();
  const [tickets, setTickets] = useState<ServiceTicket[]>(previewTickets);
  const [source, setSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connection === "loading") {
      setSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setSource("preview");
      setError(
        connection === "fallback"
          ? "Service queue is in preview because backend sync is unavailable."
          : "Guest mode keeps service analytics in preview."
      );
      setTickets(previewTickets);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const [messageRecords, taskRecords] = await Promise.all([fetchMessages(), fetchTasks()]);
        if (cancelled) {
          return;
        }

        const nextTickets = buildTickets(messageRecords, taskRecords);
        setTickets(nextTickets.length ? nextTickets : previewTickets);
        setSource("live");
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Service page fell back to preview data.", loadError);
        setTickets(previewTickets);
        setSource("preview");
        setError("Using preview service queue because live support records could not be loaded.");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Service",
        route: "/service",
        dataSource: source,
        selectedEntities: [],
        summary: "Customer service queue and SLA context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, setAssistantSelection, source]);

  const openTickets = tickets.filter((ticket) => ticket.status !== "done");
  const slaRiskCount = openTickets.filter(
    (ticket) => ticket.priority === "High" || ticket.ageHours >= 8
  ).length;
  const avgFirstResponseHours =
    openTickets.length > 0
      ? openTickets.reduce((sum, ticket) => sum + Math.max(1, ticket.ageHours * 0.42), 0) /
        openTickets.length
      : 1.5;
  const csatScore = Math.max(78, Math.round(96 - slaRiskCount * 2.6));

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live service"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest service"
          : "Preview service";

  const responsePlaybooks = useMemo(
    () => [
      {
        title: "SLA escalation",
        detail: "Auto-route high-risk tickets to manager + deal owner in under five minutes.",
        tone: "warning" as const,
      },
      {
        title: "Health check loop",
        detail: "Trigger a success review when ticket age crosses 8h without outbound response.",
        tone: "info" as const,
      },
      {
        title: "Recovery outreach",
        detail: "Send post-resolution summary and reopen guardrail in 48h.",
        tone: "success" as const,
      },
    ],
    []
  );

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Service"
        description="Manage support queues, SLA risk, and customer health without losing sales context."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="info">{workspace.stats.messages} active conversations</StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                toast.success("Resolve batch", {
                  description: "Bulk resolution workflow will process selected tickets.",
                });
              }}
            >
              <CheckCircle2 className="size-4" />
              Resolve batch
            </Button>
            <Button
              onClick={() => {
                toast.info("New service task", {
                  description: "Service task creation form will open here.",
                });
              }}
            >
              <LifeBuoy className="size-4" />
              New service task
            </Button>
          </>
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-3">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open tickets"
          value={String(openTickets.length)}
          delta="Live support issues in queue"
          icon={LifeBuoy}
          tone="info"
        />
        <MetricCard
          label="SLA at risk"
          value={String(slaRiskCount)}
          delta="Tickets likely to breach response SLA"
          icon={ShieldAlert}
          tone="warning"
        />
        <MetricCard
          label="First response"
          value={`${avgFirstResponseHours.toFixed(1)}h`}
          delta="Average first response across open queue"
          icon={Clock3}
          tone="primary"
        />
        <MetricCard
          label="CSAT trend"
          value={`${csatScore}%`}
          delta="Quality signal from service outcomes"
          icon={HeartPulse}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.9fr)]">
        <SurfaceCard tone="accent" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Ticket queue</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Prioritize by urgency, age, and customer impact before assigning next actions.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {openTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-[calc(var(--radius)-1px)] border border-border/80 bg-card px-3 py-3 transition-all duration-200 hover:border-primary/15 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{ticket.subject}</p>
                  <StatusBadge
                    tone={
                      ticket.priority === "High"
                        ? "warning"
                        : ticket.priority === "Medium"
                          ? "info"
                          : "success"
                    }
                  >
                    {ticket.priority}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ticket.customer} · {ticket.channel} · {ticket.ageHours}h in queue
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Playbooks</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Automation-safe service workflows for predictable response quality.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {responsePlaybooks.map((playbook) => (
              <div
                key={playbook.title}
                className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card px-3 py-3 transition-all duration-200 hover:border-primary/15 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  {playbook.tone === "warning" ? (
                    <AlertTriangle className="size-4 text-warning" />
                  ) : playbook.tone === "success" ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <Clock3 className="size-4 text-info" />
                  )}
                  <p className="text-sm font-semibold text-foreground">{playbook.title}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{playbook.detail}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

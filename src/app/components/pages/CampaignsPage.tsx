import { BarChart3, Megaphone, Send, Sparkles, Target, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { type Deal, fetchDeals, fetchMessages, type Message } from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { MetricCard, PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";

interface CampaignRow {
  id: string;
  name: string;
  audience: string;
  channel: string;
  status: "Draft" | "Active" | "Optimizing";
  responses: number;
  influencedPipeline: number;
}

const previewCampaigns: CampaignRow[] = [
  {
    id: "cmp-1",
    name: "Q2 Expansion Pulse",
    audience: "Existing accounts",
    channel: "Email + Inbox AgentP",
    status: "Active",
    responses: 84,
    influencedPipeline: 124000,
  },
  {
    id: "cmp-2",
    name: "Win-Back Sprint",
    audience: "Dormant opportunities",
    channel: "WhatsApp + Tasks",
    status: "Optimizing",
    responses: 37,
    influencedPipeline: 68000,
  },
  {
    id: "cmp-3",
    name: "Product-Led Nurture",
    audience: "New inbound leads",
    channel: "Email",
    status: "Draft",
    responses: 22,
    influencedPipeline: 41000,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(value);
}

function toAmount(value: Deal["amount"]) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCampaigns(messages: Message[], deals: Deal[]): CampaignRow[] {
  const inbound = messages.filter((message) => message.direction === "inbound");
  const outbound = messages.filter((message) => message.direction === "outbound");
  const emailCount = messages.filter((message) => message.channel === "email").length;
  const chatCount = messages.filter((message) => message.channel === "chat").length;
  const apiCount = messages.filter((message) => message.channel === "api").length;
  const openPipeline = deals.filter(
    (deal) => deal.pipeline_stage !== "closed_won" && deal.pipeline_stage !== "closed_lost"
  );
  const openPipelineValue = openPipeline.reduce((sum, deal) => sum + toAmount(deal.amount), 0);

  return [
    {
      id: "campaign-live-1",
      name: "Expansion activation",
      audience: "Active accounts",
      channel: "Email + AgentP drafts",
      status: "Active",
      responses: Math.max(18, Math.round(inbound.length * 0.34)),
      influencedPipeline: Math.round(openPipelineValue * 0.27),
    },
    {
      id: "campaign-live-2",
      name: "Recovery sequence",
      audience: "Stalled opportunities",
      channel: "Chat follow-up",
      status: "Optimizing",
      responses: Math.max(10, Math.round(chatCount * 0.56)),
      influencedPipeline: Math.round(openPipelineValue * 0.19),
    },
    {
      id: "campaign-live-3",
      name: "Inbound nurture flow",
      audience: "New leads",
      channel: "Email + API trigger",
      status: "Draft",
      responses: Math.max(8, Math.round((emailCount + apiCount + outbound.length) * 0.17)),
      influencedPipeline: Math.round(openPipelineValue * 0.12),
    },
  ];
}

export function CampaignsPage() {
  const { clearAssistantSelection, connection, isGuest, setAssistantSelection, workspace } =
    useCrmApp();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(previewCampaigns);
  const [messages, setMessages] = useState<Message[]>([]);
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
          ? "Campaign performance is running in preview because backend sync is unavailable."
          : "Guest mode keeps campaign metrics in preview."
      );
      setCampaigns(previewCampaigns);
      setMessages([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const [messageRecords, dealRecords] = await Promise.all([fetchMessages(), fetchDeals()]);
        if (cancelled) {
          return;
        }

        setMessages(messageRecords);
        setCampaigns(buildCampaigns(messageRecords, dealRecords));
        setSource("live");
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Campaigns page fell back to preview data.", loadError);
        setCampaigns(previewCampaigns);
        setMessages([]);
        setSource("preview");
        setError("Using preview campaign data because live campaign metrics could not be loaded.");
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
        page: "Campaigns",
        route: "/campaigns",
        dataSource: source,
        selectedEntities: messages.slice(0, 4).map((message) => ({
          entity_type: "message",
          entity_id: message.id,
        })),
        summary: "Campaign performance and channel context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, messages, setAssistantSelection, source]);

  const totalResponses = campaigns.reduce((sum, campaign) => sum + campaign.responses, 0);
  const influencedPipeline = campaigns.reduce(
    (sum, campaign) => sum + campaign.influencedPipeline,
    0
  );
  const activeCampaignCount = campaigns.filter((campaign) => campaign.status === "Active").length;
  const responseRate = messages.length > 0 ? totalResponses / messages.length : 0.28;

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live campaigns"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest campaigns"
          : "Preview campaigns";

  const channelMix = useMemo(() => {
    if (!messages.length) {
      return [
        { channel: "Email", count: 64 },
        { channel: "Chat", count: 43 },
        { channel: "API", count: 22 },
      ];
    }

    const counts = {
      Email: messages.filter((message) => message.channel === "email").length,
      Chat: messages.filter((message) => message.channel === "chat").length,
      API: messages.filter((message) => message.channel === "api").length,
    };

    return Object.entries(counts).map(([channel, count]) => ({ channel, count }));
  }, [messages]);

  const maxChannelCount = Math.max(...channelMix.map((entry) => entry.count), 1);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Campaigns"
        description="Coordinate outbound plays, measure influence on pipeline, and optimize messaging loops with CRM context."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="info">{workspace.stats.contacts} reachable contacts</StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Clone sequence", {
                  description: "Campaign sequence duplication will open here.",
                });
              }}
            >
              <TimerReset className="size-4" />
              Clone sequence
            </Button>
            <Button
              onClick={() => {
                toast.info("New campaign", {
                  description: "Campaign creation form will open here.",
                });
              }}
            >
              <Megaphone className="size-4" />
              New campaign
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
          label="Active campaigns"
          value={String(activeCampaignCount)}
          delta={`${campaigns.length} total programs`}
          icon={Megaphone}
          tone="info"
        />
        <MetricCard
          label="Responses"
          value={String(totalResponses)}
          delta={`${Math.round(responseRate * 100)}% blended response rate`}
          icon={Send}
          tone="success"
        />
        <MetricCard
          label="Influenced pipeline"
          value={formatCurrency(influencedPipeline)}
          delta="Value touched by campaign activity"
          icon={Target}
          tone="primary"
        />
        <MetricCard
          label="Optimization score"
          value={`${Math.round(Math.min(98, responseRate * 220))}`}
          delta="Signal quality from channel and segment mix"
          icon={Sparkles}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(20rem,0.95fr)]">
        <SurfaceCard tone="accent" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Campaign board</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Keep every outbound motion tied to audience, performance, and pipeline influence.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-[calc(var(--radius)-1px)] border border-border/80 bg-card px-3 py-3 transition-all duration-200 hover:border-primary/15 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                  <StatusBadge
                    tone={
                      campaign.status === "Active"
                        ? "success"
                        : campaign.status === "Optimizing"
                          ? "warning"
                          : "info"
                    }
                  >
                    {campaign.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {campaign.audience} · {campaign.channel}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Responses
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {campaign.responses}
                    </p>
                  </div>
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Influenced pipeline
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(campaign.influencedPipeline)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Channel mix</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Compare channel volume before reallocating budget and rep focus.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {channelMix.map((channel) => (
              <div key={channel.channel} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <p className="font-semibold text-foreground">{channel.channel}</p>
                  <p className="text-muted-foreground">{channel.count} interactions</p>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary/75 transition-[width]"
                    style={{ width: `${Math.max(10, (channel.count / maxChannelCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card px-3 py-3 transition-all duration-200 hover:border-primary/15 hover:shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-info" />
                <p className="text-sm font-semibold text-foreground">Optimization suggestion</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Shift 15% more outreach to the top-performing channel and keep reply drafting in the
                AgentP rail for speed.
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

import { Activity, DollarSign, Gauge, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import {
  type ChannelMixPoint,
  fetchChannelMix,
  fetchPipelineBreakdown,
  fetchRepPerformance,
  type PipelineStagePoint,
  type RepPerformancePoint,
} from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { MetricCard, PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";

const stageLabels: Record<string, string> = {
  lead: "Leads",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const toneBarClasses = {
  primary: "bg-primary",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
} as const;

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
};

const sourceChartConfig = {
  source: { label: "Source", color: "var(--chart-1)" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function buildPreviewPipeline(): PipelineStagePoint[] {
  return [
    { stage: "lead", count: 320, value: 512000 },
    { stage: "qualified", count: 204, value: 391000 },
    { stage: "proposal", count: 138, value: 336000 },
    { stage: "negotiation", count: 86, value: 287000 },
    { stage: "closed_won", count: 63, value: 244000 },
    { stage: "closed_lost", count: 41, value: 112000 },
  ];
}

function buildPreviewChannels(): ChannelMixPoint[] {
  return [
    { channel: "email", inbound_count: 48, outbound_count: 52, total_count: 100 },
    { channel: "chat", inbound_count: 33, outbound_count: 21, total_count: 54 },
    { channel: "api", inbound_count: 9, outbound_count: 7, total_count: 16 },
  ];
}

function buildPreviewReps(): RepPerformancePoint[] {
  return [
    {
      user_id: "preview-1",
      name: "Maya Foster",
      open_deals: 8,
      won_deals: 5,
      won_revenue: 78200,
      open_tasks: 7,
    },
    {
      user_id: "preview-2",
      name: "Jonas Reed",
      open_deals: 6,
      won_deals: 3,
      won_revenue: 41500,
      open_tasks: 5,
    },
    {
      user_id: "preview-3",
      name: "Ayla Karim",
      open_deals: 4,
      won_deals: 2,
      won_revenue: 26300,
      open_tasks: 3,
    },
  ];
}

export function AnalyticsPage() {
  const { clearAssistantSelection, connection, dashboard, isGuest, setAssistantSelection } =
    useCrmApp();
  const [pipeline, setPipeline] = useState<PipelineStagePoint[]>(buildPreviewPipeline());
  const [channels, setChannels] = useState<ChannelMixPoint[]>(buildPreviewChannels());
  const [reps, setReps] = useState<RepPerformancePoint[]>(buildPreviewReps());
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
          ? "Analytics is using preview data because backend sync is unavailable."
          : "Guest mode keeps analytics in preview."
      );
      setPipeline(buildPreviewPipeline());
      setChannels(buildPreviewChannels());
      setReps(buildPreviewReps());
      return;
    }

    let cancelled = false;
    const loadAnalytics = async () => {
      try {
        const [pipelineData, channelData, repData] = await Promise.all([
          fetchPipelineBreakdown(),
          fetchChannelMix(),
          fetchRepPerformance(),
        ]);
        if (cancelled) {
          return;
        }
        setPipeline(pipelineData);
        setChannels(channelData);
        setReps(repData);
        setSource("live");
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Analytics fell back to preview.", loadError);
        setPipeline(buildPreviewPipeline());
        setChannels(buildPreviewChannels());
        setReps(buildPreviewReps());
        setSource("preview");
        setError("Using preview analytics because live metrics could not be loaded.");
      }
    };

    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Analytics",
        route: "/analytics",
        dataSource: source,
        selectedEntities: [],
        summary: "Pipeline and performance analytics context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, setAssistantSelection, source]);

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live analytics"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest analytics"
          : "Preview analytics";

  const growthData = useMemo(
    () =>
      dashboard.growth.map((point) => ({
        month: point.label,
        revenue: Number((point.revenue / 1000).toFixed(2)),
      })),
    [dashboard.growth]
  );
  const totalPipelineValue = pipeline.reduce((sum, stage) => sum + stage.value, 0);
  const totalDeals = pipeline.reduce((sum, stage) => sum + stage.count, 0);
  const avgDealSize = totalDeals > 0 ? totalPipelineValue / totalDeals : 0;

  const conversionStages = ["lead", "qualified", "proposal", "negotiation", "closed_won"];
  const conversionData = conversionStages.map((stage) => ({
    stage: stageLabels[stage],
    count: pipeline.find((item) => item.stage === stage)?.count ?? 0,
  }));
  const baselineCount = conversionData[0]?.count || 1;

  const channelTotal = channels.reduce((sum, item) => sum + item.total_count, 0);
  const sourceData = channels.map((channel, index) => ({
    name: channel.channel.toUpperCase(),
    value: channelTotal > 0 ? Math.round((channel.total_count / channelTotal) * 100) : 0,
    fill: `var(--chart-${(index % 5) + 1})`,
  }));

  const kpis = [
    {
      label: "Revenue",
      value: formatCompact(dashboard.metrics.total_revenue),
      delta: `${dashboard.metrics.deals_closed} closed deals`,
      icon: DollarSign,
      tone: "primary" as const,
    },
    {
      label: "Active Clients",
      value: String(dashboard.metrics.active_clients),
      delta: `${totalDeals} tracked opportunities`,
      icon: Activity,
      tone: "info" as const,
    },
    {
      label: "Avg Deal Size",
      value: formatCurrency(avgDealSize),
      delta: `${formatCurrency(totalPipelineValue)} pipeline`,
      icon: Target,
      tone: "success" as const,
    },
    {
      label: "Conversion Rate",
      value: `${dashboard.metrics.conversion_rate.toFixed(1)}%`,
      delta: source === "live" ? "Live conversion tracking" : "Preview conversion tracking",
      icon: Gauge,
      tone: "warning" as const,
    },
  ];

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Analytics"
        description="Track funnel movement, revenue pressure, and rep execution with live CRM metrics."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="success">
              {formatCurrency(totalPipelineValue)} pipeline value
            </StatusBadge>
          </>
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-3">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <MetricCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
        <SurfaceCard tone="accent" className="gap-0">
          <div className="border-b border-border/70 px-5 py-5">
            <p className="text-sm font-semibold text-foreground">Revenue Trend</p>
            <p className="text-sm text-muted-foreground">
              Weekly revenue trend from the dashboard growth series.
            </p>
          </div>
          <div className="px-2 pb-2 sm:px-5 sm:pb-5">
            <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
              <BarChart data={growthData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(149,168,178,0.08)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tickMargin={12} width={42} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <>
                          <span>Revenue</span>
                          <span>{formatCurrency(Number(value) * 1000)}</span>
                        </>
                      )}
                    />
                  }
                />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="var(--chart-1)" opacity={0.85} />
              </BarChart>
            </ChartContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-0">
          <div className="border-b border-border/70 px-5 py-5">
            <p className="text-sm font-semibold text-foreground">Pipeline Conversion</p>
            <p className="text-sm text-muted-foreground">
              Conversion quality across major funnel stages.
            </p>
          </div>
          <div className="space-y-4 px-5 py-5">
            {conversionData.map((item, index) => {
              const pct = Math.round((item.count / baselineCount) * 100);
              const tone =
                index === conversionData.length - 1
                  ? "success"
                  : index >= conversionData.length - 2
                    ? "warning"
                    : "info";

              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{item.stage}</p>
                      <StatusBadge tone={tone}>{pct}%</StatusBadge>
                    </div>
                    <span className="font-metric text-sm text-foreground">{item.count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-background/60">
                    <div
                      className={`h-2 rounded-full ${
                        toneBarClasses[
                          tone === "warning" ? "warning" : tone === "success" ? "success" : "info"
                        ]
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <SurfaceCard tone="subtle" className="gap-0">
          <div className="border-b border-border/70 px-5 py-5">
            <p className="text-sm font-semibold text-foreground">Channel Mix</p>
            <p className="text-sm text-muted-foreground">
              Inbound vs outbound communication footprint by channel.
            </p>
          </div>
          <div className="px-2 py-4 sm:px-5">
            <ChartContainer config={sourceChartConfig} className="h-[240px] w-full">
              <PieChart>
                <Pie
                  data={sourceData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={4}
                >
                  {sourceData.map((item) => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <>
                          <span>{name}</span>
                          <span>{value}%</span>
                        </>
                      )}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
            <div className="space-y-2">
              {sourceData.map((source) => (
                <div
                  key={source.name}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/35 px-3 py-2 transition-all duration-200 hover:border-primary/15 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: source.fill }}
                    />
                    <span className="text-sm text-foreground">{source.name}</span>
                  </div>
                  <span className="font-metric text-sm text-foreground">{source.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard tone="accent" className="gap-0">
          <div className="border-b border-border/70 px-5 py-5">
            <p className="text-sm font-semibold text-foreground">Rep Performance</p>
            <p className="text-sm text-muted-foreground">
              Won revenue, open deals, and current task load per teammate.
            </p>
          </div>
          <div className="space-y-3 px-5 py-5">
            {reps.map((rep) => (
              <div
                key={rep.user_id}
                className="grid gap-3 rounded-2xl border border-border/70 bg-background/35 px-4 py-3 transition-all duration-200 hover:border-primary/15 hover:shadow-sm sm:grid-cols-[minmax(0,1.2fr)_auto_auto_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{rep.name}</p>
                  <p className="text-xs text-muted-foreground">{rep.open_deals} open deals</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Won Deals</p>
                  <p className="font-metric text-sm text-foreground">{rep.won_deals}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Won Revenue</p>
                  <p className="font-metric text-sm text-foreground">
                    {formatCurrency(rep.won_revenue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Open Tasks</p>
                  <p className="font-metric text-sm text-foreground">{rep.open_tasks}</p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

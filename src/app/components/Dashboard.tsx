import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Clock3,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import type { GrowthPoint } from "../lib/crm-api";
import { useCrmApp, type CrmConnectionState } from "../providers/CrmProvider";
import {
  MetricCard,
  PageHeader,
  SmartActionButton,
  StatusBadge,
  SurfaceCard,
} from "./crm-ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

type Tone = "primary" | "info" | "warning" | "success";

const channelBadges = ["Instagram", "WhatsApp", "Email", "Live chat"];

const toneClasses: Record<Tone, string> = {
  primary: "border-primary/18 bg-primary/12 text-primary",
  info: "border-info/18 bg-info-soft text-info",
  warning: "border-warning/18 bg-warning-soft text-warning",
  success: "border-success/18 bg-success-soft text-success",
};

const chartConfig = {
  revenue: {
    label: "Actual revenue",
    color: "var(--chart-1)",
  },
  forecast: {
    label: "Forecast",
    color: "var(--chart-2)",
  },
  target: {
    label: "Target",
    color: "rgba(149, 228, 255, 0.72)",
  },
};

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getConnectionTone(connection: CrmConnectionState) {
  if (connection === "fallback") {
    return "warning" as const;
  }

  if (connection === "guest") {
    return "info" as const;
  }

  if (connection === "loading") {
    return "info" as const;
  }

  return "success" as const;
}

function getConnectionLabel(connection: CrmConnectionState) {
  if (connection === "fallback") {
    return "Preview mode";
  }

  if (connection === "guest") {
    return "Guest mode";
  }

  if (connection === "loading") {
    return "Syncing workspace";
  }

  if (connection === "bootstrapped") {
    return "Starter data live";
  }

  return "Workspace live";
}

function buildChartSeries(growth: GrowthPoint[]) {
  return growth.map((point) => {
    const revenue = Number((point.revenue / 1000).toFixed(1));
    const target = Number(
      (Math.max(point.revenue * 0.9, point.leads_created * 850) / 1000).toFixed(1),
    );
    const forecast = Number(
      (
        Math.max(
          point.revenue * 1.05,
          point.revenue + point.deals_closed * 1400 + point.leads_created * 320,
        ) / 1000
      ).toFixed(1),
    );

    return {
      month: point.label,
      revenue,
      forecast,
      target,
      dealsClosed: point.deals_closed,
      leadsCreated: point.leads_created,
    };
  });
}

export function Dashboard() {
  const navigate = useNavigate();
  const { connection, dashboard, error, isGuest, isLoading, refresh, workspace } =
    useCrmApp();
  const [range, setRange] = useState<"4w" | "8w">("4w");
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const growthData = buildChartSeries(dashboard.growth);
  const visibleData = range === "4w" ? growthData.slice(-4) : growthData;
  const latestPoint =
    visibleData[visibleData.length - 1] ?? growthData[growthData.length - 1] ?? null;
  const bestPeriod = growthData.reduce<(typeof growthData)[number] | null>(
    (currentBest, point) => {
      if (!currentBest || point.revenue > currentBest.revenue) {
        return point;
      }

      return currentBest;
    },
    null,
  );
  const totalLeads = dashboard.growth.reduce((sum, point) => sum + point.leads_created, 0);
  const connectionTone = getConnectionTone(connection);
  const connectionLabel = getConnectionLabel(connection);
  const unreadPressure = Math.max(2, Math.round(workspace.stats.messages * 0.22));
  const stalledDeals = Math.max(1, Math.round(workspace.stats.deals * 0.18));
  const overdueTasks = Math.max(1, Math.round(workspace.stats.tasks * 0.36));
  const forecastGap = latestPoint
    ? Number(Math.max(latestPoint.target - latestPoint.forecast, 0).toFixed(1))
    : 0;
  const replySla =
    connection === "fallback"
      ? "Preview"
      : isGuest
        ? "Guest"
        : unreadPressure <= 6
          ? "< 2h"
          : "< 4h";

  const metrics = [
    {
      label: "Revenue",
      value: formatCurrencyCompact(dashboard.metrics.total_revenue),
      delta: bestPeriod ? `${bestPeriod.month} is strongest` : "Revenue trend syncing",
      icon: TrendingUp,
      tone: "primary" as const,
    },
    {
      label: "Pipeline",
      value: formatInteger(workspace.stats.deals),
      delta: `${stalledDeals} deals need movement`,
      icon: Briefcase,
      tone: "info" as const,
    },
    {
      label: "Win rate",
      value: `${dashboard.metrics.conversion_rate.toFixed(1)}%`,
      delta: `${dashboard.metrics.deals_closed} deals won`,
      icon: Sparkles,
      tone: "success" as const,
    },
    {
      label: "Unread",
      value: formatInteger(unreadPressure),
      delta: `${workspace.stats.messages} tracked threads`,
      icon: MessageSquare,
      tone: "warning" as const,
    },
  ];

  const queueItems = [
    {
      title: "Triage unread conversations",
      detail:
        connection === "fallback"
          ? "Inbox pressure is local for now, but the workflow is ready to use."
          : isGuest
            ? "Guest mode mirrors the inbox queue so the triage flow stays visible."
            : `${workspace.stats.messages} messages are linked to CRM records and ready for follow-up.`,
      badge: `${unreadPressure} urgent`,
      path: "/messages",
      icon: MessageSquare,
      tone: "info" as const,
    },
    {
      title: "Advance qualified deals",
      detail: `${workspace.stats.deals} open opportunities are already in the workspace and ready for stage movement.`,
      badge: `${stalledDeals} stalled`,
      path: "/pipeline",
      icon: Briefcase,
      tone: "primary" as const,
    },
    {
      title: "Clean new contact intake",
      detail: `${formatInteger(totalLeads)} recent leads can be enriched, tagged, and routed before the next push.`,
      badge: `${workspace.stats.contacts} contacts`,
      path: "/clients",
      icon: Users,
      tone: "success" as const,
    },
    {
      title: "Convert reminders into automation",
      detail: `${overdueTasks} follow-ups can be handed to workflow rules and AI-assisted reminders.`,
      badge: workspace.crm_ready ? "Ready" : "Seed first",
      path: "/automations",
      icon: Zap,
      tone: "warning" as const,
    },
  ];

  const riskItems = [
    {
      label: "Negotiation deals losing momentum",
      value: `${stalledDeals} deals`,
      detail: "No recent movement means pricing or follow-up pressure is building.",
      tone: "warning" as const,
      path: "/pipeline",
    },
    {
      label: "Forecast gap to target",
      value: forecastGap > 0 ? `$${forecastGap}K` : "On track",
      detail:
        forecastGap > 0
          ? "One more qualified push would close the visible forecast gap."
          : "Forecast is matching or exceeding target in the visible range.",
      tone: forecastGap > 0 ? "primary" : "success",
      path: "/analytics",
    },
    {
      label: "Follow-ups due this week",
      value: `${overdueTasks} tasks`,
      detail: "Ownership is clear, but response timing needs a tighter loop.",
      tone: "info" as const,
      path: "/tasks",
    },
  ];

  const inboxItems = [
    {
      label: "Unread threads",
      value: formatInteger(unreadPressure),
      detail: "Highest-priority replies are clustered around active opportunities.",
      tone: "warning" as const,
      path: "/messages",
    },
    {
      label: "Response SLA",
      value: replySla,
      detail: "The shell is optimized around fast reply, assignment, and AI drafting.",
      tone: "info" as const,
      path: "/messages",
    },
    {
      label: "Channels connected",
      value: "4 live",
      detail: "Email, WhatsApp, Instagram, and live chat stay inside one inbox.",
      tone: "success" as const,
      path: "/messages",
    },
  ];

  const automationItems = [
    {
      label: workspace.crm_ready ? "Follow-up automations ready" : "Workspace needs seed data",
      value: workspace.crm_ready ? `${overdueTasks} reminders` : "Pending",
      detail: workspace.crm_ready
        ? "Tasks, deals, and inbox events are ready to trigger rules."
        : "Seed starter CRM records before enabling workflow automation.",
      tone: workspace.crm_ready ? ("success" as const) : ("warning" as const),
      path: "/automations",
    },
    {
      label: "No-response rule",
      value: `${unreadPressure} threads`,
      detail: "Turn silent threads into reminders, AI drafts, and owner alerts.",
      tone: "primary" as const,
      path: "/automations",
    },
    {
      label: "Team coverage",
      value: `${workspace.stats.members} teammates`,
      detail: "The same workspace data is available across deals, inbox, and tasks.",
      tone: "info" as const,
      path: "/settings",
    },
  ];

  const recentActivity = [
    {
      title: `${formatInteger(totalLeads)} leads captured in the visible range`,
      detail: "Lead intake is healthy enough to keep enrichment and routing worthwhile.",
      tone: "success" as const,
    },
    {
      title: `${dashboard.metrics.deals_closed} deals closed with ${workspace.stats.deals} still active`,
      detail: "The pipeline has enough depth to keep the forecast meaningful.",
      tone: "primary" as const,
    },
    {
      title: `${workspace.stats.messages} linked conversations across ${channelBadges.length} channels`,
      detail: "Communication is centralized enough to support task creation and AI drafting.",
      tone: "info" as const,
    },
  ];

  const workspaceCards = [
    {
      title: "Contacts",
      description: "Profiles, segmentation, and interaction history stay connected in one record.",
      stat: `${formatInteger(workspace.stats.contacts)} records`,
      path: "/clients",
      tone: "info" as const,
    },
    {
      title: "Deals",
      description: "Pipeline stages, ownership, and next steps stay visible without expanding into heavy cards.",
      stat: `${formatInteger(workspace.stats.deals)} open opportunities`,
      path: "/pipeline",
      tone: "primary" as const,
    },
    {
      title: "Inbox",
      description: "All conversations land in one communication hub with AI and automation nearby.",
      stat: `${formatInteger(workspace.stats.messages)} tracked threads`,
      path: "/messages",
      tone: "warning" as const,
    },
    {
      title: "Accounts",
      description: "Track account health, champions, and expansion plans with less manual prep.",
      stat: `${formatInteger(workspace.stats.companies)} companies`,
      path: "/accounts",
      tone: "success" as const,
    },
    {
      title: "Forecast",
      description: "Run commit and upside scenarios before pipeline risk turns into missed target.",
      stat: `${formatInteger(workspace.stats.deals)} opportunities`,
      path: "/forecast",
      tone: "primary" as const,
    },
    {
      title: "Service",
      description: "Keep SLA risk and customer outcomes visible inside the same CRM timeline.",
      stat: `${formatInteger(Math.round(workspace.stats.messages * 0.36))} open tickets`,
      path: "/service",
      tone: "info" as const,
    },
  ];

  const forecastStats = [
    {
      label: "Best period",
      value: bestPeriod ? `${bestPeriod.month} · $${bestPeriod.revenue}K` : "Waiting for sync",
      detail: bestPeriod
        ? `${bestPeriod.dealsClosed} closed deals supported the strongest week.`
        : "The chart will fill as soon as analytics are available.",
    },
    {
      label: "Visible leads",
      value: formatInteger(totalLeads),
      detail: "Lead intake across the selected reporting window.",
    },
    {
      label: "Workspace scope",
      value: `${formatInteger(workspace.stats.contacts)} contacts`,
      detail: `${formatInteger(workspace.stats.deals)} deals, ${formatInteger(workspace.stats.messages)} messages, ${formatInteger(workspace.stats.tasks)} tasks.`,
    },
  ];

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Growth overview"
        description={
          connection === "fallback"
            ? "A compact control surface for revenue, pipeline pressure, and response pace while backend connectivity is unavailable."
            : isGuest
              ? "Guest mode keeps the CRM fully explorable with demo data, so the operating model stays clear before account creation."
              : `${workspace.name} keeps revenue, pipeline health, conversations, and team execution inside one denser operating view.`
        }
        meta={
          <>
            <span>{todayLabel}</span>
            <StatusBadge tone={connectionTone}>{connectionLabel}</StatusBadge>
            <StatusBadge tone={workspace.crm_ready ? "success" : "warning"}>
              {workspace.crm_ready ? `${workspace.stats.deals} deals tracked` : "Starter workspace"}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => void refresh()} disabled={isLoading}>
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/messages")}>
              Inbox
            </Button>
            <SmartActionButton
              label="Create Deal"
              icon={Briefcase}
              onClick={() => navigate("/pipeline")}
              items={[
                {
                  label: "Create from inbox",
                  description: "Start a deal from current conversation pressure and owner context.",
                  icon: MessageSquare,
                  onSelect: () => navigate("/messages"),
                },
                {
                  label: "AI-suggested deal",
                  description: "Open the pipeline and use the AI assistant to suggest stage and value.",
                  icon: Sparkles,
                  onSelect: () => navigate("/pipeline"),
                },
                {
                  label: "Add contact first",
                  description: "Open the contacts workspace and create the relationship record first.",
                  icon: Users,
                  onSelect: () => navigate("/clients"),
                },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 + 0.04 }}
          >
            <MetricCard {...metric} />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.48fr)_minmax(19rem,0.74fr)]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: "easeOut" }}
        >
          <SurfaceCard tone="accent" className="gap-0 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border/75 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone="primary">Growth chart</StatusBadge>
                  <StatusBadge tone={connectionTone}>{connectionLabel}</StatusBadge>
                  <StatusBadge tone={workspace.crm_ready ? "success" : "warning"}>
                    {workspace.crm_ready ? "Live signal mix" : "Starter workspace"}
                  </StatusBadge>
                </div>
                <div>
                  <h2 className="text-foreground">Revenue, forecast, and target</h2>
                  <p className="mt-1 max-w-2xl text-[0.82rem] leading-5 text-muted-foreground">
                    One compact read on revenue pace, forecast risk, and whether current activity is enough to hit target.
                  </p>
                  {error ? <p className="mt-2 text-sm text-warning">{error}</p> : null}
                </div>
              </div>

              <div className="flex items-center gap-1 self-start rounded-full border border-border/80 bg-card p-0.5">
                {(["4w", "8w"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setRange(option)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.64rem] font-semibold tracking-[0.16em] uppercase transition-colors",
                      option === range
                        ? "bg-primary text-primary-foreground shadow-[var(--shadow-button)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.72rem] text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--chart-1)]" />
                  Actual revenue
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--chart-2)]" />
                  Forecast
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-chart-3" />
                  Target
                </span>
              </div>

              <div className="rounded-[calc(var(--radius)-1px)] border border-border/80 bg-surface-muted p-3">
                <ChartContainer
                  config={chartConfig}
                  className="h-[22rem] w-full aspect-auto [&_.recharts-cartesian-axis-tick_text]:fill-foreground/70 [&_.recharts-cartesian-grid_line]:stroke-border/70"
                >
                  <AreaChart
                    data={visibleData}
                    margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.28} />
                        <stop offset="92%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} strokeDasharray="0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      width={52}
                      tickFormatter={(value) => `$${value}K`}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          formatter={(value, name) => {
                            if (typeof value !== "number") {
                              return null;
                            }

                            const label =
                              typeof name === "string"
                                ? chartConfig[name as keyof typeof chartConfig]?.label ?? name
                                : name;

                            return (
                              <div className="flex min-w-[10rem] items-center justify-between gap-4">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-metric font-semibold text-foreground">
                                  ${value}K
                                </span>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue)"
                      strokeWidth={3.25}
                      fill="url(#growthFill)"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="var(--color-forecast)"
                      strokeWidth={2.5}
                      strokeDasharray="7 5"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="var(--color-target)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {forecastStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-3 py-2.5"
                  >
                    <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{stat.value}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceCard>
        </motion.div>

        <div className="grid gap-3">
          <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
            <div className="border-b border-border/75 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Today queue</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The highest-value actions to keep revenue pace and response time under control.
              </p>
            </div>

            <div className="space-y-2.5 p-3">
              {queueItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.title}
                    onClick={() => navigate(item.path)}
                    className="flex w-full items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card p-3 text-left transition-[border-color,background-color] duration-200 hover:border-primary/18 hover:bg-surface-strong/85"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[0.9rem] border",
                        toneClasses[item.tone],
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <StatusBadge tone={item.tone}>{item.badge}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
            <div className="border-b border-border/75 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Forecast snapshot</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A compact read on coverage, target risk, and current execution pace.
              </p>
            </div>

            <div className="grid gap-2.5 p-3">
              <div className="rounded-[calc(var(--radius)-2px)] border border-primary/16 bg-surface-strong/70 px-3 py-3">
                <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-primary/80 uppercase">
                  Current forecast
                </p>
                <p className="mt-1 font-metric text-xl font-semibold text-foreground">
                  {latestPoint ? `$${latestPoint.forecast}K` : "Syncing"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {forecastGap > 0
                    ? `${forecastGap}K below target in the visible range.`
                    : "Forecast is matching or exceeding target right now."}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-3 py-2.5">
                  <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Best week
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {bestPeriod ? `${bestPeriod.month} · $${bestPeriod.revenue}K` : "Waiting for sync"}
                  </p>
                </div>
                <div className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-3 py-2.5">
                  <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Response pace
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{replySla}</p>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">At-risk pipeline</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pressure points that are most likely to affect forecast confidence.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {riskItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="w-full rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-[border-color,background-color] duration-200 hover:border-primary/18 hover:bg-surface-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </div>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Inbox pressure</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Keep conversations centralized, reply faster, and reduce leakage between channels.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {inboxItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="w-full rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-[border-color,background-color] duration-200 hover:border-primary/18 hover:bg-surface-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </div>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Automation alerts</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Rules, reminders, and no-response workflows that can remove manual load.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {automationItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="w-full rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-[border-color,background-color] duration-200 hover:border-primary/18 hover:bg-surface-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </div>
              </button>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Recent activity</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A compact timeline of what the workspace is already telling the team.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {recentActivity.map((item) => (
              <div
                key={item.title}
                className="rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[0.9rem] border",
                      toneClasses[item.tone],
                    )}
                  >
                    {item.tone === "primary" ? (
                      <TrendingUp className="size-4" />
                    ) : item.tone === "success" ? (
                      <Sparkles className="size-4" />
                    ) : (
                      <Clock3 className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Core workspaces</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Contacts, deals, and communication stay grouped so the CRM remains fast to scan at scale.
            </p>
          </div>

          <div className="space-y-2.5 p-3">
            {workspaceCards.map((workspaceCard) => (
              <button
                key={workspaceCard.title}
                onClick={() => navigate(workspaceCard.path)}
                className="w-full rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-[border-color,background-color] duration-200 hover:border-primary/18 hover:bg-surface-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {workspaceCard.title}
                      </p>
                      <StatusBadge tone={workspaceCard.tone}>
                        {workspaceCard.stat}
                      </StatusBadge>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {workspaceCard.description}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-border/75 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              <p className="text-sm font-semibold text-foreground">Channel readiness</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {channelBadges.map((channel) => (
                <StatusBadge key={channel} tone="info">
                  {channel}
                </StatusBadge>
              ))}
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

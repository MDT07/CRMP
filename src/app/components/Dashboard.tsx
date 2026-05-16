import { useState } from "react";
import { useNavigate } from "react-router";
import {
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
  const { connection, dashboard, isGuest, isLoading, refresh, workspace } =
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
  const totalLeads = dashboard.growth.reduce((sum: number, point: { leads_created: number }) => sum + point.leads_created, 0);
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
      tone: forecastGap > 0 ? ("primary" as const) : ("success" as const),
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
                  label: "CRM Agent suggested deal",
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(19rem,1fr)]">
        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            <SurfaceCard tone="subtle" className="gap-0 overflow-hidden border-transparent bg-transparent shadow-none ring-0">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Up Next</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highest-value actions to keep revenue pace and response time under control.
                </p>
              </div>

              <div className="grid gap-3">
                {queueItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.title}
                      onClick={() => navigate(item.path)}
                      className="group flex w-full items-start gap-4 rounded-xl bg-surface-subtle/50 p-4 text-left transition-all duration-200 hover:bg-surface-subtle hover:shadow-sm"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-background transition-colors duration-200",
                          toneClasses[item.tone],
                          "group-hover:bg-background"
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[0.95rem] font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</p>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {item.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground/80">
                          {item.detail}
                        </p>
                      </div>
                      <div className="mt-1 shrink-0 text-muted-foreground/30 transition-colors duration-200 group-hover:text-primary/50">
                        <ArrowRight className="size-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </SurfaceCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.1, ease: "easeOut" }}
          >
            <SurfaceCard tone="subtle" className="gap-0 overflow-hidden border-transparent bg-transparent shadow-none ring-0 mt-2">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Action Required</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-left">
                  {riskItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="flex flex-col gap-2 rounded-xl border border-border/40 bg-surface-muted/30 p-4 transition-all duration-200 hover:border-warning/30 hover:bg-warning/5"
                    >
                      <div className="flex items-center justify-between w-full">
                        <StatusBadge tone={item.tone} className="px-2 py-0.5">{item.value}</StatusBadge>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80 line-clamp-2">{item.detail}</p>
                      </div>
                    </button>
                  ))}
                  {inboxItems.slice(0, 1).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="flex flex-col gap-2 rounded-xl border border-border/40 bg-surface-muted/30 p-4 transition-all duration-200 hover:border-info/30 hover:bg-info/5"
                    >
                      <div className="flex items-center justify-between w-full">
                        <StatusBadge tone={item.tone} className="px-2 py-0.5">{item.value}</StatusBadge>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80 line-clamp-2">{item.detail}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </SurfaceCard>
          </motion.div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Pulse</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Key metrics and recent activity at a glance.
              </p>
            </div>

            <div className="grid gap-2.5">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 + 0.04 }}
                >
                  <div className="rounded-xl bg-surface-subtle/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-background">
                          <metric.icon className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                          <p className="text-lg font-semibold text-foreground">{metric.value}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{metric.delta}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="rounded-xl bg-surface-subtle/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Revenue & Forecast</h3>
                <div className="flex items-center gap-1 rounded-full bg-background p-0.5">
                  {(["4w", "8w"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setRange(option)}
                      className={cn(
                        "rounded-full px-2 py-1 text-[0.64rem] font-semibold tracking-[0.16em] uppercase transition-colors",
                        option === range
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="font-metric text-2xl font-semibold tracking-tight text-foreground">
                  {latestPoint ? `$${latestPoint.forecast}K` : "Syncing"}
                </p>
                <p className="text-xs text-muted-foreground">forecast</p>
              </div>
              <div className="h-[12rem] w-full">
                <ChartContainer
                  config={chartConfig}
                  className="h-full w-full aspect-auto [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/40"
                >
                  <AreaChart
                    data={visibleData}
                    margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      fontSize={11}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      width={50}
                      fontSize={11}
                      tickFormatter={(value) => `$${value}K`}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="line" />}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-chart-1)"
                      strokeWidth={2.5}
                      fill="url(#growthFill)"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="var(--color-chart-3)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
              {forecastGap > 0 && (
                <div className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                  <span className="font-semibold">Target Risk:</span> ${forecastGap}K gap in visible range.
                </div>
              )}
            </div>

            <div className="rounded-xl bg-surface-subtle/30 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-foreground">Recent Activity</p>
              </div>
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background">
                      {item.tone === "primary" ? (
                        <TrendingUp className="size-3 text-primary" />
                      ) : item.tone === "success" ? (
                        <Sparkles className="size-3 text-success" />
                      ) : (
                        <Clock3 className="size-3 text-info" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/80">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

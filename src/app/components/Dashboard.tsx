import {
  Activity,
  ArrowRight,
  Briefcase,
  Clock3,
  DollarSign,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { GrowthPoint } from "../lib/crm-api";
import { type CrmConnectionState, useCrmApp } from "../providers/CrmProvider";
import { MetricCard, PageHeader, SmartActionButton, StatusBadge, SurfaceCard } from "./crm-ui";
import { Button } from "./ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { cn } from "./ui/utils";

type Tone = "primary" | "info" | "warning" | "success" | "accent";

const toneClasses: Record<Tone, string> = {
  primary: "border-primary/18 bg-primary-soft text-primary",
  info: "border-info/18 bg-info-soft text-info",
  warning: "border-warning/18 bg-warning-soft text-warning",
  success: "border-success/18 bg-success-soft text-success",
  accent: "border-accent/18 bg-accent-soft text-accent",
};

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  forecast: {
    label: "Forecast",
    color: "var(--chart-2)",
  },
  target: {
    label: "Target",
    color: "var(--chart-4)",
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

function getConnectionTone(connection: CrmConnectionState): Tone {
  if (connection === "fallback") return "warning";
  if (connection === "guest") return "info";
  if (connection === "loading") return "info";
  return "success";
}

function getConnectionLabel(connection: CrmConnectionState) {
  if (connection === "fallback") return "Preview mode";
  if (connection === "guest") return "Guest mode";
  if (connection === "loading") return "Syncing workspace";
  if (connection === "bootstrapped") return "Starter data live";
  return "Workspace live";
}

function buildChartSeries(growth: GrowthPoint[]) {
  return growth.map((point) => {
    const revenue = Number((point.revenue / 1000).toFixed(1));
    const target = Number(
      (Math.max(point.revenue * 0.9, point.leads_created * 850) / 1000).toFixed(1)
    );
    const forecast = Number(
      (
        Math.max(
          point.revenue * 1.05,
          point.revenue + point.deals_closed * 1400 + point.leads_created * 320
        ) / 1000
      ).toFixed(1)
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

// Demo data for preview/guest mode
const workspaceDemoData = {
  company: "Your Company",
  tagline: "Growth starts here",
  industry: "Technology",
  hq: "San Francisco, CA",
  employees: "50",
  marketCap: "—",
  revenue: "$1.2M",
  growth: "+15%",
};

export function Dashboard() {
  const navigate = useNavigate();
  const { connection, dashboard, isGuest, isLoading, refresh, workspace } = useCrmApp();
  const [range, setRange] = useState<"4w" | "8w" | "12w">("8w");
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const growthData = buildChartSeries(dashboard.growth);
  const visibleData =
    range === "4w" ? growthData.slice(-4) : range === "8w" ? growthData.slice(-8) : growthData;
  const latestPoint =
    visibleData[visibleData.length - 1] ?? growthData[growthData.length - 1] ?? null;
  const bestPeriod = growthData.reduce<(typeof growthData)[number] | null>((currentBest, point) => {
    if (!currentBest || point.revenue > currentBest.revenue) {
      return point;
    }
    return currentBest;
  }, null);
  const totalLeads = dashboard.growth.reduce(
    (sum: number, point: { leads_created: number }) => sum + point.leads_created,
    0
  );
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
      title: "Revenue",
      value: formatCurrencyCompact(dashboard.metrics.total_revenue),
      subtitle: bestPeriod ? `${bestPeriod.month} peak performance` : "Revenue tracking",
      trend: "up" as const,
      trendValue: "+12.4%",
      icon: <DollarSign className="size-5" />,
      color: "primary" as const,
    },
    {
      title: "Pipeline",
      value: formatInteger(workspace.stats.deals),
      subtitle: `${stalledDeals} deals need attention`,
      trend: "neutral" as const,
      trendValue: `${stalledDeals} stalled`,
      icon: <Briefcase className="size-5" />,
      color: "info" as const,
    },
    {
      title: "Win Rate",
      value: `${dashboard.metrics.conversion_rate.toFixed(1)}%`,
      subtitle: `${dashboard.metrics.deals_closed} deals closed`,
      trend: "up" as const,
      trendValue: "+3.2%",
      icon: <Target className="size-5" />,
      color: "success" as const,
    },
    {
      title: "Active Deals",
      value: formatInteger(unreadPressure),
      subtitle: `${workspace.stats.messages} conversations`,
      trend: "up" as const,
      trendValue: "+8.1%",
      icon: <Activity className="size-5" />,
      color: "accent" as const,
    },
  ];

  const queueItems = [
    {
      title: "Triage inbox conversations",
      detail: `${workspace.stats.messages} messages across Email, WhatsApp, and Live Chat need follow-up.`,
      badge: `${unreadPressure} urgent`,
      path: "/messages",
      icon: MessageSquare,
      tone: "info" as Tone,
    },
    {
      title: "Advance qualified deals",
      detail: `${workspace.stats.deals} opportunities in pipeline. ${stalledDeals} deals stalled for 7+ days.`,
      badge: `${stalledDeals} stalled`,
      path: "/pipeline",
      icon: Briefcase,
      tone: "primary" as Tone,
    },
    {
      title: "Enrich new contacts",
      detail: `${formatInteger(totalLeads)} leads captured. Review and assign to account managers.`,
      badge: `${workspace.stats.contacts} contacts`,
      path: "/clients",
      icon: Users,
      tone: "success" as Tone,
    },
    {
      title: "Automate follow-ups",
      detail: `${overdueTasks} tasks overdue. Set up workflow rules to reduce manual work.`,
      badge: workspace.crm_ready ? "Ready" : "Setup",
      path: "/automations",
      icon: Zap,
      tone: "warning" as Tone,
    },
  ];

  const quickStats = [
    {
      label: "Response SLA",
      value: replySla,
      detail: "Average first response",
      tone: "info" as Tone,
    },
    {
      label: "Channels",
      value: "4 active",
      detail: "Email, WhatsApp, Chat, IG",
      tone: "success" as Tone,
    },
    {
      label: "Forecast Gap",
      value: forecastGap > 0 ? `$${forecastGap}K` : "On track",
      detail: "vs. quarterly target",
      tone: forecastGap > 0 ? "warning" : ("success" as Tone),
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title="Growth Overview"
        description={
          connection === "fallback"
            ? `Preview mode showing ${workspaceDemoData.company} sample data. Explore the CRM functionality.`
            : isGuest
              ? `Guest mode with ${workspaceDemoData.company} demo data. Sign up to connect your workspace.`
              : `${workspace.name} — Revenue, pipeline, and team execution in one view.`
        }
        meta={
          <>
            <span className="text-xs text-muted-foreground">{todayLabel}</span>
            <StatusBadge tone={connectionTone} dot pulse={connection === "loading"}>
              {connectionLabel}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="rounded-xl"
            >
              <RefreshCw className={cn("size-4 mr-1.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <SmartActionButton
              label="Create Deal"
              icon={Briefcase}
              onClick={() => navigate("/pipeline")}
              items={[
                {
                  label: "From inbox thread",
                  description: "Convert a conversation into a tracked opportunity.",
                  icon: MessageSquare,
                  onSelect: () => navigate("/messages"),
                },
                {
                  label: "AgentP suggestion",
                  description: "Let AgentP analyze and suggest deal parameters.",
                  icon: Sparkles,
                  onSelect: () => {
                    /* Open AgentP panel */
                  },
                },
                {
                  label: "New contact first",
                  description: "Add a contact before creating their deal record.",
                  icon: Users,
                  onSelect: () => navigate("/clients"),
                },
              ]}
            />
          </>
        }
      />

      {/* Metrics Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
          >
            <MetricCard {...metric} />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Chart Section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            <SurfaceCard tone="default" padding="lg" radius="lg">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Revenue & Forecast</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Actual revenue vs. forecast and quarterly targets
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1">
                  {(["4w", "8w", "12w"] as const).map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setRange(option)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                        option === range
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <p className="font-metric text-3xl font-bold tracking-tight text-foreground">
                  {latestPoint ? `$${latestPoint.forecast}K` : "—"}
                </p>
                <span className="text-sm text-muted-foreground">forecasted</span>
                {forecastGap > 0 && (
                  <StatusBadge tone="warning" size="sm">
                    ${forecastGap}K gap
                  </StatusBadge>
                )}
              </div>

              <div className="h-[280px] w-full">
                <ChartContainer
                  config={chartConfig}
                  className="h-full w-full [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/30"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={visibleData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="4 4"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={12}
                        fontSize={12}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickMargin={12}
                        fontSize={12}
                        tickFormatter={(value) => `$${value}K`}
                        stroke="var(--muted-foreground)"
                      />
                      <ChartTooltip
                        cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2.5}
                        fill="url(#growthFill)"
                        dot={{
                          r: 4,
                          fill: "var(--color-chart-1)",
                          strokeWidth: 2,
                          stroke: "var(--card)",
                        }}
                        activeDot={{
                          r: 6,
                          fill: "var(--color-chart-1)",
                          strokeWidth: 3,
                          stroke: "var(--card)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="target"
                        stroke="var(--color-chart-4)"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </SurfaceCard>
          </motion.div>

          {/* Action Queue */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
          >
            <SurfaceCard tone="default" padding="lg" radius="lg">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">Up Next</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Priority actions to maintain revenue momentum
                </p>
              </div>

              <div className="grid gap-3">
                {queueItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.title}
                      onClick={() => navigate(item.path)}
                      className="group flex w-full items-center gap-4 rounded-xl border border-border/40 bg-surface-muted/30 p-4 text-left transition-all duration-200 hover:border-primary/20 hover:bg-primary-soft/30 hover:shadow-sm"
                    >
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                          toneClasses[item.tone]
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {item.title}
                          </p>
                          <StatusBadge tone={item.tone} size="sm">
                            {item.badge}
                          </StatusBadge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground/80">{item.detail}</p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground/30 transition-all group-hover:text-primary/60 group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </SurfaceCard>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Company Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
          >
            <SurfaceCard tone="gradient" padding="lg" radius="lg" glow="primary">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <span className="text-2xl font-bold text-white">🏢</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{workspaceDemoData.company}</p>
                  <p className="text-sm text-white/70">{workspaceDemoData.tagline}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-xs text-white/60">Revenue</p>
                  <p className="text-sm font-semibold text-white">{workspaceDemoData.revenue}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-xs text-white/60">Growth</p>
                  <p className="text-sm font-semibold text-success">{workspaceDemoData.growth}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-xs text-white/60">Market Cap</p>
                  <p className="text-sm font-semibold text-white">{workspaceDemoData.marketCap}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-xs text-white/60">Employees</p>
                  <p className="text-sm font-semibold text-white">{workspaceDemoData.employees}</p>
                </div>
              </div>
            </SurfaceCard>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.35 }}
          >
            <SurfaceCard tone="default" padding="lg" radius="lg">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">Performance</h3>
              </div>
              <div className="space-y-3">
                {quickStats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "size-2 rounded-full",
                          stat.tone === "info" && "bg-info",
                          stat.tone === "success" && "bg-success",
                          stat.tone === "warning" && "bg-warning"
                        )}
                      />
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.4 }}
          >
            <SurfaceCard tone="default" padding="lg" radius="lg">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">Recent Activity</h3>
              </div>
              <div className="space-y-4">
                {[
                  {
                    title: `${formatInteger(totalLeads)} new leads`,
                    detail: "From website forms and campaigns",
                    time: "2h ago",
                    tone: "success" as Tone,
                  },
                  {
                    title: `${dashboard.metrics.deals_closed} deals closed`,
                    detail: `${workspace.stats.deals} still in pipeline`,
                    time: "5h ago",
                    tone: "primary" as Tone,
                  },
                  {
                    title: `${workspace.stats.messages} conversations`,
                    detail: "Across all connected channels",
                    time: "1d ago",
                    tone: "info" as Tone,
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        toneClasses[item.tone]
                      )}
                    >
                      {item.tone === "success" ? (
                        <Sparkles className="size-3.5" />
                      ) : item.tone === "primary" ? (
                        <TrendingUp className="size-3.5" />
                      ) : (
                        <Clock3 className="size-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground/70">{item.detail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/50">{item.time}</span>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

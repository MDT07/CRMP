import { Activity, Gauge, Radar, Target, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { type Deal, fetchDeals } from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { MetricCard, PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";

interface ScenarioRow {
  name: string;
  commit: number;
  upside: number;
  risk: number;
}

function toAmount(value: Deal["amount"]) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(value);
}

const previewDeals: Deal[] = [
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

function buildScenarioRows(deals: Deal[]): ScenarioRow[] {
  const openDeals = deals.filter(
    (deal) => deal.pipeline_stage !== "closed_won" && deal.pipeline_stage !== "closed_lost"
  );

  const stageWeights: Record<
    Deal["pipeline_stage"],
    { commit: number; upside: number; risk: number }
  > = {
    lead: { commit: 0.08, upside: 0.3, risk: 0.62 },
    qualified: { commit: 0.18, upside: 0.46, risk: 0.36 },
    proposal: { commit: 0.36, upside: 0.42, risk: 0.22 },
    negotiation: { commit: 0.58, upside: 0.32, risk: 0.1 },
    closed_won: { commit: 1, upside: 0, risk: 0 },
    closed_lost: { commit: 0, upside: 0, risk: 1 },
  };

  const buckets: Record<string, ScenarioRow> = {
    "New business": { name: "New business", commit: 0, upside: 0, risk: 0 },
    Expansion: { name: "Expansion", commit: 0, upside: 0, risk: 0 },
    Renewal: { name: "Renewal", commit: 0, upside: 0, risk: 0 },
  };

  for (const deal of openDeals) {
    const amount = toAmount(deal.amount);
    const type =
      deal.source?.includes("renew") || deal.title.toLowerCase().includes("renew")
        ? "Renewal"
        : deal.source?.includes("expand") || deal.title.toLowerCase().includes("expansion")
          ? "Expansion"
          : "New business";
    const weight = stageWeights[deal.pipeline_stage];
    buckets[type].commit += amount * weight.commit;
    buckets[type].upside += amount * weight.upside;
    buckets[type].risk += amount * weight.risk;
  }

  return Object.values(buckets);
}

export function ForecastPage() {
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    dashboard,
    setAssistantSelection,
    workspace,
  } = useCrmApp();
  const [deals, setDeals] = useState<Deal[]>(previewDeals);
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
          ? "Forecasting is using preview opportunities because backend sync is unavailable."
          : "Guest mode uses sample forecasting data."
      );
      setDeals(previewDeals);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const dealRecords = await fetchDeals();
        if (cancelled) {
          return;
        }
        setDeals(dealRecords.length ? dealRecords : previewDeals);
        setSource("live");
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Forecast page fell back to preview data.", loadError);
        setSource("preview");
        setError("Using preview forecast because live opportunities could not be loaded.");
        setDeals(previewDeals);
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
        page: "Forecast",
        route: "/forecast",
        dataSource: source,
        selectedEntities: deals.slice(0, 4).map((deal) => ({
          entity_type: "deal",
          entity_id: deal.id,
        })),
        summary: "Forecast model and deal probability context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, deals, setAssistantSelection, source]);

  const openDeals = deals.filter(
    (deal) => deal.pipeline_stage !== "closed_won" && deal.pipeline_stage !== "closed_lost"
  );
  const commitValue = openDeals.reduce(
    (sum, deal) =>
      sum +
      toAmount(deal.amount) *
        (deal.pipeline_stage === "negotiation"
          ? 0.72
          : deal.pipeline_stage === "proposal"
            ? 0.52
            : 0.3),
    0
  );
  const weightedValue = openDeals.reduce(
    (sum, deal) => sum + toAmount(deal.amount) * (deal.probability / 100),
    0
  );
  const bestCaseValue = openDeals.reduce((sum, deal) => sum + toAmount(deal.amount), 0);
  const targetValue = Math.max(
    dashboard.metrics.total_revenue * 0.26,
    dashboard.growth[dashboard.growth.length - 1]?.revenue ?? 1
  );
  const coverageRatio = targetValue > 0 ? bestCaseValue / targetValue : 0;
  const riskValue = Math.max(bestCaseValue - commitValue, 0);
  const scenarios = useMemo(() => buildScenarioRows(deals), [deals]);

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live forecast"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest forecast"
          : "Preview forecast";

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Forecast"
        description="Run commit, upside, and risk scenarios from pipeline reality instead of static spreadsheets."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="primary">{workspace.stats.deals} tracked opportunities</StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Set target", {
                  description: "Forecast target configuration will open here.",
                });
              }}
            >
              <Target className="size-4" />
              Set target
            </Button>
            <Button
              onClick={() => {
                toast.success("Recalculating outlook", {
                  description: "Forecast scenarios updated from latest pipeline data.",
                });
              }}
            >
              <Radar className="size-4" />
              Recalculate outlook
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
          label="Weighted forecast"
          value={formatCurrency(weightedValue)}
          delta="Probability-adjusted expected revenue"
          icon={Gauge}
          tone="primary"
        />
        <MetricCard
          label="Commit"
          value={formatCurrency(commitValue)}
          delta="High-confidence opportunities this cycle"
          icon={Target}
          tone="success"
        />
        <MetricCard
          label="Best case"
          value={formatCurrency(bestCaseValue)}
          delta={`${openDeals.length} open opportunities in play`}
          icon={TrendingUp}
          tone="info"
        />
        <MetricCard
          label="Coverage ratio"
          value={`${coverageRatio.toFixed(2)}x`}
          delta={`Target baseline ${formatCurrency(targetValue)}`}
          icon={Activity}
          tone={coverageRatio >= 2 ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.9fr)]">
        <SurfaceCard tone="accent" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Scenario planning</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Split outlook by motion type to see where you need pipeline quality versus volume.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {scenarios.map((scenario) => (
              <div
                key={scenario.name}
                className="rounded-[calc(var(--radius)-1px)] border border-border/80 bg-card px-3 py-3 transition-all duration-200 hover:border-primary/15 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{scenario.name}</p>
                  <StatusBadge tone="primary">{formatCurrency(scenario.commit)} commit</StatusBadge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Upside
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(scenario.upside)}
                    </p>
                  </div>
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Risk
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(scenario.risk)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-4">
          <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
            <div className="border-b border-border/75 px-4 py-3.5">
              <p className="text-sm font-semibold text-foreground">Risk radar</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep forecast confidence high by watching coverage and downside early.
              </p>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="rounded-[calc(var(--radius)-2px)] border border-warning/25 bg-warning-soft px-3 py-3">
                <p className="text-sm font-semibold text-foreground">Downside exposure</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {formatCurrency(riskValue)} remains outside of commit and needs stage movement.
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)-2px)] border border-info/22 bg-info-soft px-3 py-3">
                <p className="text-sm font-semibold text-foreground">Pipeline quality</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {
                    openDeals.filter(
                      (deal) =>
                        deal.pipeline_stage === "proposal" || deal.pipeline_stage === "negotiation"
                    ).length
                  }{" "}
                  deals are in late stage and suitable for commit coaching.
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)-2px)] border border-success/22 bg-success-soft px-3 py-3">
                <p className="text-sm font-semibold text-foreground">Capacity signal</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {coverageRatio >= 2
                    ? "Coverage is healthy for this cycle."
                    : "Coverage is thin; seed top-of-funnel now to protect next cycle."}
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

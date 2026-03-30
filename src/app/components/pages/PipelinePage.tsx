import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Briefcase,
  Calendar,
  Clock3,
  DollarSign,
  MoreHorizontal,
  Plus,
  Sparkles,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  createDeal,
  fetchCompanies,
  fetchContacts,
  fetchDeals,
  type Contact,
  type DealStage,
} from "../../lib/crm-api";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { formatCurrencyValue, formatDueLabel } from "../../lib/crm-format";
import { fallbackDeals, dealTemplates } from "../../lib/fallback-data";
import { useCrmApp } from "../../providers/CrmProvider";
import {
  MetricCard,
  PageHeader,
  SmartActionButton,
  StatusBadge,
  SurfaceCard,
} from "../crm-ui";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";

type StageTone = "primary" | "info" | "warning" | "success" | "danger";

type DealBoard = Record<DealStage, DealCard>;

const stageConfigs: { id: DealStage; label: string; tone: StageTone }[] = [
  { id: "lead", label: "Lead", tone: "info" },
  { id: "qualified", label: "Qualified", tone: "info" },
  { id: "proposal", label: "Proposal", tone: "primary" },
  { id: "negotiation", label: "Negotiation", tone: "warning" },
  { id: "closed_won", label: "Closed Won", tone: "success" },
  { id: "closed_lost", label: "Closed Lost", tone: "danger" },
];

const toneClasses: Record<StageTone, string> = {
  primary: "bg-primary text-primary",
  info: "bg-info text-info",
  warning: "bg-warning text-warning",
  success: "bg-success text-success",
  danger: "bg-danger text-danger",
};

const badgeTone: Record<
  StageTone,
  "primary" | "info" | "warning" | "success" | "danger"
> = {
  primary: "primary",
  info: "info",
  warning: "warning",
  success: "success",
  danger: "danger",
};

const buttonVariant: Record<
  StageTone,
  "default" | "info" | "warning" | "success" | "destructive"
> = {
  primary: "default",
  info: "info",
  warning: "warning",
  success: "success",
  danger: "destructive",
};

function emptyBoard(): DealBoard {
  return {
    lead: [],
    qualified: [],
    proposal: [],
    negotiation: [],
    closed_won: [],
    closed_lost: [],
  };
}

function parseCurrencyLabel(value: string) {
  return Number(value.replace(/[$,]/g, "")) || 0;
}

function buildDealBoard(
  deals: Awaited<ReturnType<typeof fetchDeals>>,
  contacts: Awaited<ReturnType<typeof fetchContacts>>,
  companies: Awaited<ReturnType<typeof fetchCompanies>>,
) {
  const board = emptyBoard();
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const companyMap = new Map(companies.map((company) => [company.id, company]));

  for (const deal of deals) {
    const contact = contactMap.get(deal.contact_id);
    const company =
      contact?.company_id ? companyMap.get(contact.company_id)?.name : undefined;

    board[deal.pipeline_stage].push({
      id: deal.id,
      company: company ?? deal.title,
      contact: contact?.name ?? "Unassigned contact",
      title: deal.title,
      value: formatCurrencyValue(deal.amount, deal.currency),
      close: formatDueLabel(deal.expected_close_date),
      prob: Math.round(deal.probability),
    });
  }

  for (const stageId of Object.keys(board) as DealStage[]) {
    board[stageId].sort(
      (left, right) => parseCurrencyLabel(right.value) - parseCurrencyLabel(left.value),
    );
  }

  return board;
}

function addDays(days: number) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

export function PipelinePage() {
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    setAssistantSelection,
  } = useCrmApp();
  const guestPreviewMessage =
    "Guest mode is showing demo pipeline data so you can explore deals without registration.";
  const [deals, setDeals] = useState<DealBoard>(fallbackDeals);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview",
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(
    connection === "fallback"
      ? "Backend connection is unavailable, so the pipeline board is showing preview data."
      : isGuest
        ? guestPreviewMessage
        : null,
  );
  const sourceTone =
    dataSource === "live" ? "success" : dataSource === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    dataSource === "live"
      ? "Live pipeline"
      : dataSource === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest pipeline"
          : "Preview board";

  const loadPipeline = async () => {
    const [companyRecords, contactRecords, dealRecords] = await Promise.all([
      fetchCompanies(),
      fetchContacts(),
      fetchDeals(),
    ]);

    setContacts(contactRecords);
    setDeals(buildDealBoard(dealRecords, contactRecords, companyRecords));
    setDataSource("live");
    setError(null);
  };

  useEffect(() => {
    if (connection === "loading") {
      setDataSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setDataSource("preview");
      setError(
        connection === "fallback"
          ? "Backend connection is unavailable, so the pipeline board is showing preview data."
          : guestPreviewMessage,
      );
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        await loadPipeline();
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Pipeline workspace fell back to preview data.", loadError);
        setDataSource("preview");
        setError(
          isGuest
            ? guestPreviewMessage
            : "Using preview pipeline data because the live deal records could not be loaded.",
        );
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    const selectedEntities = stageConfigs
      .flatMap((stage) => deals[stage.id].slice(0, 2))
      .slice(0, 6)
      .map((deal) => ({
        entity_type: "deal",
        entity_id: String(deal.id),
      }));

    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Pipeline",
        route: "/pipeline",
        dataSource,
        selectedEntities,
        summary: "Pipeline stage and deal momentum context",
      }),
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, dataSource, deals, setAssistantSelection]);

  const allDeals = Object.values(deals).flat();
  const totalDeals = allDeals.length;
  const totalPipelineValue = allDeals.reduce(
    (sum, deal) => sum + parseCurrencyLabel(deal.value),
    0,
  );
  const activeDeals = useMemo(
    () => [...deals.lead, ...deals.qualified, ...deals.proposal, ...deals.negotiation],
    [deals],
  );
  const highIntentCount = deals.proposal.length + deals.negotiation.length;
  const averageProbability =
    activeDeals.length > 0
      ? Math.round(
          activeDeals.reduce((sum, deal) => sum + deal.prob, 0) / activeDeals.length,
        )
      : 0;
  const stalledPressure = deals.negotiation.length + Math.max(0, deals.proposal.length - 1);

  const createLiveDeal = async (stageId: DealStage) => {
    if (contacts.length === 0) {
      toast.warning("No contacts available", {
        description: "Create a contact first so a deal can be linked to a person.",
      });
      return;
    }

    const contact = contacts[allDeals.length % contacts.length];
    const template = dealTemplates[stageId];

    await createDeal({
      contact_id: contact.id,
      title: `${contact.name} · ${template.title}`,
      pipeline_stage: stageId,
      amount: template.amount,
      currency: "USD",
      probability: template.probability,
      expected_close_date: addDays(template.closeInDays),
      source: "frontend",
      description: `Created from the ${stageId} board in the CRMP workspace.`,
    });

    await loadPipeline();
  };

  const handleNewDeal = async () => {
    if (dataSource === "live") {
      setIsCreating(true);
      try {
        await createLiveDeal("lead");
        toast.success("New deal created", {
          description: "A live CRM deal was added to the lead stage.",
        });
      } catch (createError) {
        console.error(createError);
        toast.error("Could not create deal", {
          description: "The live deal record could not be created right now.",
        });
      } finally {
        setIsCreating(false);
      }

      return;
    }

    const nextDeal = {
      id: Math.max(...allDeals.map((deal) => Number(deal.id))) + 1,
      company: "Atlas Advisory",
      contact: "Maya Foster",
      title: "Atlas expansion brief",
      value: "$29,800",
      close: "Apr 15",
      prob: 34,
    };

    setDeals((previous) => ({
      ...previous,
      lead: [nextDeal, ...previous.lead],
    }));

    toast.success("New deal created", {
      description: `${nextDeal.company} was added to the lead stage.`,
    });
  };

  const handleAddDealToStage = async (stageId: DealStage) => {
    if (dataSource === "live") {
      setIsCreating(true);
      try {
        await createLiveDeal(stageId);
        toast.info("Deal added to stage", {
          description: `A live CRM deal was added to ${stageConfigs.find((stage) => stage.id === stageId)?.label ?? "that stage"}.`,
        });
      } catch (createError) {
        console.error(createError);
        toast.error("Could not add deal", {
          description: "The live stage record could not be created right now.",
        });
      } finally {
        setIsCreating(false);
      }

      return;
    }

    const template = dealTemplates[stageId];
    const nextDeal = {
      id: Math.max(...allDeals.map((deal) => Number(deal.id))) + 1,
      company: "Northwind Studio",
      contact: "Riley James",
      title: template.title,
      value: formatCurrencyValue(template.amount),
      close: formatDueLabel(addDays(template.closeInDays)),
      prob: template.probability,
    };

    setDeals((previous) => ({
      ...previous,
      [stageId]: [nextDeal, ...previous[stageId]],
    }));

    toast.info("Deal added to stage", {
      description: `${nextDeal.company} is now in ${stageConfigs.find((stage) => stage.id === stageId)?.label ?? stageId}.`,
    });
  };

  const handleDealOptions = (dealId: number | string) => {
    const activeDeal = allDeals.find((deal) => deal.id === dealId);
    if (!activeDeal) {
      return;
    }

    toast("Deal quick actions", {
      description: `${activeDeal.title} is closing ${activeDeal.close} with ${activeDeal.prob}% probability.`,
    });
  };

  const handleAIDealSuggestion = async () => {
    if (dataSource === "live") {
      setIsCreating(true);
      try {
        await createLiveDeal("qualified");
        toast.success("AI-assisted deal created", {
          description:
            "CRMP suggested a qualified stage entry with a stronger amount and close-date baseline.",
        });
      } catch (createError) {
        console.error(createError);
        toast.error("Could not create suggested deal", {
          description: "The AI-assisted live deal could not be created right now.",
        });
      } finally {
        setIsCreating(false);
      }

      return;
    }

    toast.info("AI suggestion ready", {
      description:
        "The next step is wiring model-assisted stage, value, and probability suggestions into the live pipeline form.",
    });
  };

  const handleCreateFromInbox = () => {
    toast("Conversation handoff ready", {
      description:
        "Unread conversations can be turned into deals with source, contact, and urgency carried over automatically.",
    });
  };

  const handleLaunchAutomation = () => {
    toast.success("Automation template prepared", {
      description:
        "This pipeline can auto-create follow-ups, legal review tasks, and stage reminders from the deal action menu.",
    });
  };

  const handleOpenDeal = (dealId: number | string) => {
    const activeDeal = allDeals.find((entry) => entry.id === dealId);
    if (!activeDeal) {
      return;
    }

    toast.success(activeDeal.company, {
      description: `${activeDeal.contact} is attached to ${activeDeal.value} and closes ${activeDeal.close}.`,
    });
  };

  const visibleStages = stageConfigs.filter(
    (stage) => stage.id !== "closed_lost" || deals.closed_lost.length > 0,
  );
  const topStage =
    [...visibleStages]
      .sort((left, right) => deals[right.id].length - deals[left.id].length)[0] ?? stageConfigs[0];
  const topStageValue = deals[topStage.id].reduce(
    (sum, deal) => sum + parseCurrencyLabel(deal.value),
    0,
  );

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Deals workspace"
        description="Keep the pipeline tighter, denser, and easier to move so stage pressure and forecast risk are visible without oversized cards."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="success">
              {totalDeals} deals · {formatCurrencyValue(totalPipelineValue)} pipeline
            </StatusBadge>
          </>
        }
        actions={
          <SmartActionButton
            label="Create Deal"
            icon={Plus}
            variant="success"
            onClick={() => {
              void handleNewDeal();
            }}
            disabled={isCreating}
            items={[
              {
                label: "AI-suggest amount and stage",
                description: "Use current pipeline patterns to start with a stronger value, stage, and probability.",
                icon: Bot,
                onSelect: () => {
                  void handleAIDealSuggestion();
                },
              },
              {
                label: "Convert inbox thread",
                description: "Create a deal from an active conversation and keep the communication history attached.",
                icon: Sparkles,
                onSelect: handleCreateFromInbox,
              },
              {
                label: "Launch deal automation",
                description: "Attach reminders, stakeholder follow-ups, and stage-based automations from day one.",
                icon: Zap,
                onSelect: handleLaunchAutomation,
              },
            ]}
          />
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-3">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pipeline value"
          value={formatCurrencyValue(totalPipelineValue)}
          delta={`${totalDeals} total deals`}
          icon={TrendingUp}
          tone="primary"
        />
        <MetricCard
          label="Open stages"
          value={String(activeDeals.length)}
          delta={`${visibleStages.length} visible columns`}
          icon={Briefcase}
          tone="info"
        />
        <MetricCard
          label="High intent"
          value={String(highIntentCount)}
          delta={`${deals.negotiation.length} in negotiation`}
          icon={Sparkles}
          tone="warning"
        />
        <MetricCard
          label="Avg confidence"
          value={`${averageProbability}%`}
          delta={`${stalledPressure} deals need movement`}
          icon={Clock3}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
            <div className="border-b border-border/75 px-4 py-3.5">
              <p className="text-sm font-semibold text-foreground">Stage summary</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep every stage readable before you open the full board.
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto p-3">
              {visibleStages.map((stage) => {
                const stageDeals = deals[stage.id] ?? [];
                const stageTotal = stageDeals.reduce(
                  (sum, deal) => sum + parseCurrencyLabel(deal.value),
                  0,
                );

                return (
                  <button
                    key={stage.id}
                    onClick={() => void handleAddDealToStage(stage.id)}
                    className="min-w-[11rem] rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 px-3 py-3 text-left transition-colors hover:border-primary/18 hover:bg-surface-strong"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${toneClasses[stage.tone]}`} />
                        <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                      </div>
                      <StatusBadge tone={badgeTone[stage.tone]}>{stageDeals.length}</StatusBadge>
                    </div>
                    <p className="mt-2 font-metric text-sm font-semibold text-foreground">
                      {formatCurrencyValue(stageTotal)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a deal directly into this lane.
                    </p>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {visibleStages.map((stage, stageIndex) => {
                const stageDeals = deals[stage.id] || [];
                const stageTotal = stageDeals.reduce(
                  (sum, deal) => sum + parseCurrencyLabel(deal.value),
                  0,
                );

                return (
                  <SurfaceCard
                    key={stage.id}
                    tone="subtle"
                    className="w-[16.5rem] min-w-[16.5rem] gap-0 overflow-hidden"
                  >
                    <div className="flex items-start justify-between border-b border-border/75 px-3.5 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${toneClasses[stage.tone]}`} />
                          <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                          <StatusBadge tone={badgeTone[stage.tone]}>{stageDeals.length}</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrencyValue(stageTotal)} total value
                        </p>
                      </div>
                      <Button
                        variant={buttonVariant[stage.tone]}
                        size="icon"
                        className="rounded-[0.95rem]"
                        onClick={() => void handleAddDealToStage(stage.id)}
                        disabled={isCreating}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>

                    <div className="max-h-[34rem] space-y-2.5 overflow-y-auto p-3">
                      {stageDeals.map((deal, index) => (
                        <motion.div
                          key={deal.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: stageIndex * 0.04 + index * 0.02 }}
                          onClick={() => handleOpenDeal(deal.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleOpenDeal(deal.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="w-full cursor-pointer rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/18 hover:bg-surface-strong"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {deal.company}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {deal.title}
                              </p>
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <User className="size-3.5" />
                                {deal.contact}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-[0.95rem]"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDealOptions(deal.id);
                              }}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-2">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 font-metric font-semibold text-foreground">
                                <DollarSign className="size-3.5" />
                                {deal.value}
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="size-3.5" />
                                {deal.close}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-[0.72rem] text-muted-foreground">
                                <span>Close confidence</span>
                                <span className="font-metric text-foreground">{deal.prob}%</span>
                              </div>
                              <div className="mt-1.5 h-1.5 rounded-full bg-background/60">
                                <div
                                  className={cn(
                                    "h-1.5 rounded-full",
                                    stage.tone === "success"
                                      ? "bg-success"
                                      : stage.tone === "warning"
                                        ? "bg-warning"
                                        : stage.tone === "danger"
                                          ? "bg-danger"
                                          : stage.tone === "primary"
                                            ? "bg-primary"
                                            : "bg-info",
                                  )}
                                  style={{ width: `${deal.prob}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <SurfaceCard tone="accent" className="gap-3 border-primary/16 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Pipeline pressure</p>
            </div>
            <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 px-3 py-3">
              <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-primary/80 uppercase">
                Most active lane
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{topStage.label}</p>
              <p className="mt-1 font-metric text-sm text-muted-foreground">
                {formatCurrencyValue(topStageValue)} across {deals[topStage.id].length} deals
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 px-3 py-3">
              <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Risk note
              </p>
              <p className="mt-1 text-sm text-foreground">
                {stalledPressure > 0
                  ? `${stalledPressure} high-intent deals need a faster next step.`
                  : "The board is moving cleanly right now."}
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="subtle" className="gap-3 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">AI-assisted moves</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep the highest-value shortcuts visible instead of hiding them behind the board.
              </p>
            </div>

            <button
              onClick={() => void handleAIDealSuggestion()}
              className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-colors hover:border-primary/18 hover:bg-surface-strong"
            >
              <div className="flex size-9 items-center justify-center rounded-[0.9rem] border border-primary/18 bg-primary/12 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Suggest a stronger deal</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Start with AI-suggested stage, amount, and confidence instead of a blank form.
                </p>
              </div>
            </button>

            <button
              onClick={handleCreateFromInbox}
              className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-colors hover:border-primary/18 hover:bg-surface-strong"
            >
              <div className="flex size-9 items-center justify-center rounded-[0.9rem] border border-info/18 bg-info-soft text-info">
                <Briefcase className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Promote from inbox</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Convert active conversations into deals with source and urgency already attached.
                </p>
              </div>
            </button>
          </SurfaceCard>

          <SurfaceCard tone="subtle" className="gap-3 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Automation hooks</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Stage changes should trigger reminders, review tasks, and no-response workflows.
              </p>
            </div>

            <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 px-3 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" />
                <p className="text-sm font-semibold text-foreground">Follow-up risk</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Proposal and negotiation stages are the best place to automate nudges and internal alerts.
              </p>
            </div>

            <Button variant="outline" onClick={handleLaunchAutomation}>
              <Zap className="size-4" />
              Prepare automation
            </Button>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

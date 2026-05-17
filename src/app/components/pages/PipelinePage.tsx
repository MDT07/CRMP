import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Filter,
  Flag,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import {
  type Contact,
  createDeal,
  type DealStage,
  fetchCompanies,
  fetchContacts,
  fetchDeals,
  updateDeal,
} from "../../lib/crm-api";
import { formatCurrencyValue, formatDueLabel } from "../../lib/crm-format";
import { dealTemplates, fallbackDeals } from "../../lib/fallback-data";
import { useCrmApp } from "../../providers/CrmProvider";
import { MetricCard, PageHeader, SmartActionButton, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";

// Types
interface DealCard {
  id: string | number;
  company: string;
  contact: string;
  title: string;
  value: string;
  close: string;
  prob: number;
  priority?: "high" | "medium" | "low";
  tags?: string[];
  lastActivity?: string;
}

type DealBoard = Record<DealStage, DealCard[]>;

interface StageConfig {
  id: DealStage;
  label: string;
  tone: StageTone;
  color: string;
  limit?: number;
}

type StageTone = "primary" | "info" | "warning" | "success" | "danger";

// Stage Configuration
const stageConfigs: StageConfig[] = [
  { id: "lead", label: "Lead", tone: "info", color: "#0071e3" },
  { id: "qualified", label: "Qualified", tone: "info", color: "#5ac8fa" },
  { id: "proposal", label: "Proposal", tone: "primary", color: "#af52de" },
  { id: "negotiation", label: "Negotiation", tone: "warning", color: "#ff9500" },
  { id: "closed_won", label: "Closed Won", tone: "success", color: "#34c759" },
  { id: "closed_lost", label: "Closed Lost", tone: "danger", color: "#ff3b30" },
];

const toneClasses: Record<StageTone, string> = {
  primary: "bg-primary/15 text-primary",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/15 text-destructive",
};

const badgeTone: Record<StageTone, "primary" | "info" | "warning" | "success" | "danger"> = {
  primary: "primary",
  info: "info",
  warning: "warning",
  success: "success",
  danger: "danger",
};

const buttonVariant: Record<StageTone, "default" | "info" | "warning" | "success" | "destructive"> =
  {
    primary: "default",
    info: "info",
    warning: "warning",
    success: "success",
    danger: "destructive",
  };

// Sortable Deal Card Component
function SortableDealCard({
  deal,
  stageId,
  onClick,
  onOptions,
  isOverlay = false,
}: {
  deal: DealCard;
  stageId: DealStage;
  onClick: () => void;
  onOptions: (e: React.MouseEvent) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(deal.id),
    data: {
      type: "Deal",
      deal,
      stageId,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const stage = stageConfigs.find((s) => s.id === stageId);
  if (!stage) return null;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={!isOverlay ? { opacity: 0, y: 8 } : undefined}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative w-full cursor-pointer rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/18 hover:bg-surface-strong hover:shadow-lg",
        isOverlay && "shadow-2xl rotate-2 scale-105 cursor-grabbing z-50",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag Handle */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="size-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{deal.company}</p>
            {deal.priority === "high" && <Flag className="size-3 text-warning" />}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{deal.title}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5" />
            {deal.contact}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-[0.95rem] opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(event) => {
            event.stopPropagation();
            onOptions(event);
          }}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {deal.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[0.65rem] rounded-full bg-primary/10 text-primary"
            >
              {tag}
            </span>
          ))}
          {deal.tags.length > 2 && (
            <span className="px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
              +{deal.tags.length - 2}
            </span>
          )}
        </div>
      )}

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

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-[0.72rem] text-muted-foreground">
            <span>Confidence</span>
            <span className="font-metric text-foreground">{deal.prob}%</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-background/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${deal.prob}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={cn(
                "h-full rounded-full",
                stage.tone === "success"
                  ? "bg-success"
                  : stage.tone === "warning"
                    ? "bg-warning"
                    : stage.tone === "danger"
                      ? "bg-danger"
                      : stage.tone === "primary"
                        ? "bg-primary"
                        : "bg-info"
              )}
            />
          </div>
        </div>

        {/* Last Activity */}
        {deal.lastActivity && (
          <div className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
            <Clock className="size-3" />
            {deal.lastActivity}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Stage Column Component
function StageColumn({
  stage,
  deals,
  onAddDeal,
  onDealClick,
  onDealOptions,
  isCreating,
  searchQuery,
}: {
  stage: StageConfig;
  deals: DealCard[];
  onAddDeal: () => void;
  onDealClick: (deal: DealCard) => void;
  onDealOptions: (deal: DealCard, e: React.MouseEvent) => void;
  isCreating: boolean;
  searchQuery: string;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: stage.id,
    data: {
      type: "Stage",
      stageId: stage.id,
    },
  });

  const filteredDeals = useMemo(() => {
    if (!searchQuery) return deals;
    const query = searchQuery.toLowerCase();
    return deals.filter(
      (deal) =>
        deal.company.toLowerCase().includes(query) ||
        deal.contact.toLowerCase().includes(query) ||
        deal.title.toLowerCase().includes(query) ||
        deal.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [deals, searchQuery]);

  const stageTotal = filteredDeals.reduce((sum, deal) => sum + parseCurrencyLabel(deal.value), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[18rem] min-w-[18rem] flex-col rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card transition-colors",
        isOver && "border-primary/40 bg-primary/5"
      )}
    >
      {/* Stage Header */}
      <div className="flex items-center justify-between border-b border-border/75 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", toneClasses[stage.tone])} />
          <p className="text-sm font-semibold text-foreground">{stage.label}</p>
          <StatusBadge tone={badgeTone[stage.tone]}>{filteredDeals.length}</StatusBadge>
        </div>
        <Button
          variant={buttonVariant[stage.tone]}
          size="icon"
          className="rounded-[0.95rem]"
          onClick={onAddDeal}
          disabled={isCreating}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Stage Value */}
      <div className="border-b border-border/50 px-3.5 py-2">
        <p className="font-metric text-sm font-semibold text-foreground">
          {formatCurrencyValue(stageTotal)}
        </p>
      </div>

      {/* Deals List */}
      <div className="min-h-[200px] flex-1 space-y-2.5 overflow-y-auto p-3">
        <SortableContext
          items={filteredDeals.map((d) => String(d.id))}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            {filteredDeals.map((deal) => (
              <SortableDealCard
                key={deal.id}
                deal={deal}
                stageId={stage.id}
                onClick={() => onDealClick(deal)}
                onOptions={(e) => onDealOptions(deal, e)}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {filteredDeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 rounded-full bg-muted p-3">
              <Briefcase className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No deals</p>
            <p className="text-xs text-muted-foreground">Drag deals here or click + to add</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
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
  companies: Awaited<ReturnType<typeof fetchCompanies>>
) {
  const board = emptyBoard();
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const companyMap = new Map(companies.map((company) => [company.id, company]));

  for (const deal of deals) {
    const contact = contactMap.get(deal.contact_id);
    const company = contact?.company_id ? companyMap.get(contact.company_id)?.name : undefined;

    // Calculate priority based on days until close and probability
    const daysUntilClose = deal.expected_close_date
      ? Math.ceil(
          (new Date(deal.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : 999;
    let priority: "high" | "medium" | "low" = "low";
    if (daysUntilClose <= 7 && deal.probability >= 50) priority = "high";
    else if (daysUntilClose <= 14 || deal.probability >= 30) priority = "medium";

    board[deal.pipeline_stage].push({
      id: deal.id,
      company: company ?? deal.title,
      contact: contact?.name ?? "Unassigned contact",
      title: deal.title,
      value: formatCurrencyValue(deal.amount, deal.currency),
      close: formatDueLabel(deal.expected_close_date),
      prob: Math.round(deal.probability),
      priority,
      lastActivity: deal.updated_at ? new Date(deal.updated_at).toLocaleDateString() : undefined,
    });
  }

  // Sort by value descending
  for (const stageId of Object.keys(board) as DealStage[]) {
    board[stageId].sort(
      (left, right) => parseCurrencyLabel(right.value) - parseCurrencyLabel(left.value)
    );
  }

  return board;
}

function addDays(days: number) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

// Main Pipeline Component
export function PipelinePage() {
  const { clearAssistantSelection, connection, isGuest, setAssistantSelection } = useCrmApp();
  const guestPreviewMessage =
    "Guest mode is showing demo pipeline data so you can explore deals without registration.";

  const [deals, setDeals] = useState<DealBoard>(fallbackDeals);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(
    connection === "fallback"
      ? "Backend connection is unavailable, so the pipeline board is showing preview data."
      : isGuest
        ? guestPreviewMessage
        : null
  );

  // Drag and Drop State
  const [activeDeal, setActiveDeal] = useState<DealCard | null>(null);
  const [activeStage, setActiveStage] = useState<DealStage | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: load function defined below
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
          : guestPreviewMessage
      );
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        await loadPipeline();
      } catch (_loadError) {
        if (cancelled) {
          return;
        }
        toast.warning("Pipeline workspace fell back to preview data.");
        setDataSource("preview");
        setError(
          isGuest
            ? guestPreviewMessage
            : "Using preview pipeline data because the live deal records could not be loaded."
        );
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [connection, isGuest]);

  useEffect(() => {
    const selectedEntities = stageConfigs
      .flatMap((stage) => deals[stage.id].slice(0, 2))
      .slice(0, 6)
      .map((deal) => ({
        entity_type: "deal" as const,
        entity_id: String(deal.id),
      }));

    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Pipeline",
        route: "/pipeline",
        dataSource,
        selectedEntities,
        summary: "Pipeline stage and deal momentum context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, dataSource, deals, setAssistantSelection]);

  // Drag and Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dealId = active.id as string;

    // Find the deal in any stage
    for (const stageId of Object.keys(deals) as DealStage[]) {
      const deal = deals[stageId].find((d) => String(d.id) === dealId);
      if (deal) {
        setActiveDeal(deal);
        setActiveStage(stageId);
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find active deal
    let activeDealData: DealCard | null = null;
    let activeStageId: DealStage | null = null;

    for (const stageId of Object.keys(deals) as DealStage[]) {
      const deal = deals[stageId].find((d) => String(d.id) === activeId);
      if (deal) {
        activeDealData = deal;
        activeStageId = stageId;
        break;
      }
    }

    if (!activeDealData || !activeStageId) return;

    // Check if over a stage
    const overStage = stageConfigs.find((s) => s.id === overId);
    if (overStage && activeStageId !== overStage.id) {
      // Move deal to new stage
      setDeals((prev) => {
        const newDeals = { ...prev };
        newDeals[activeStageId] = newDeals[activeStageId].filter((d) => String(d.id) !== activeId);
        newDeals[overStage.id] = activeDealData
          ? [activeDealData, ...newDeals[overStage.id]]
          : newDeals[overStage.id];
        return newDeals;
      });

      // Update backend if live
      if (dataSource === "live") {
        updateDeal(activeId, { pipeline_stage: overStage.id }).catch(() => {
          toast.error("Failed to update deal stage. Please try again.");
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveDeal(null);
    setActiveStage(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle reordering within same stage
    if (activeId === overId) return;

    // Find which stage the deal is in
    for (const stageId of Object.keys(deals) as DealStage[]) {
      const stageDeals = deals[stageId];
      const activeIndex = stageDeals.findIndex((d) => String(d.id) === activeId);
      const overIndex = stageDeals.findIndex((d) => String(d.id) === overId);

      if (activeIndex !== -1 && overIndex !== -1) {
        // Reorder within same stage
        setDeals((prev) => ({
          ...prev,
          [stageId]: arrayMove(prev[stageId], activeIndex, overIndex),
        }));
        break;
      }
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  // Metrics
  const allDeals = Object.values(deals).flat();
  const totalDeals = allDeals.length;
  const totalPipelineValue = allDeals.reduce(
    (sum, deal) => sum + parseCurrencyLabel(deal.value),
    0
  );
  const activeDeals = useMemo(
    () => [...deals.lead, ...deals.qualified, ...deals.proposal, ...deals.negotiation],
    [deals]
  );
  const highIntentCount = deals.proposal.length + deals.negotiation.length;
  const averageProbability =
    activeDeals.length > 0
      ? Math.round(activeDeals.reduce((sum, deal) => sum + deal.prob, 0) / activeDeals.length)
      : 0;
  const stalledPressure = deals.negotiation.length + Math.max(0, deals.proposal.length - 1);

  // Create Deal
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
      } catch {
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
      priority: "medium" as const,
      tags: ["Enterprise"],
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
          description: `A live CRM deal was added to ${
            stageConfigs.find((stage) => stage.id === stageId)?.label ?? "that stage"
          }.`,
        });
      } catch {
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
      priority: "medium" as const,
      tags: [],
    };

    setDeals((previous) => ({
      ...previous,
      [stageId]: [nextDeal, ...previous[stageId]],
    }));

    toast.info("Deal added to stage", {
      description: `${nextDeal.company} is now in ${
        stageConfigs.find((stage) => stage.id === stageId)?.label ?? stageId
      }.`,
    });
  };

  const handleDealClick = (deal: DealCard) => {
    toast.success(deal.company, {
      description: `${deal.contact} is attached to ${deal.value} and closes ${deal.close}.`,
    });
  };

  const handleDealOptions = (deal: DealCard, e: React.MouseEvent) => {
    e.stopPropagation();
    toast("Deal quick actions", {
      description: `${deal.title} is closing ${deal.close} with ${deal.prob}% probability.`,
    });
  };

  const visibleStages = stageConfigs.filter(
    (stage) => stage.id !== "closed_lost" || deals.closed_lost.length > 0
  );

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Deals Pipeline"
        description="Drag and drop deals between stages. Track progress, value, and probability in real-time."
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
            onClick={() => void handleNewDeal()}
            disabled={isCreating}
            items={[
              {
                label: "AgentP suggest amount and stage",
                description:
                  "Use current pipeline patterns to start with a stronger value, stage, and probability.",
                icon: Sparkles,
                onSelect: () => {
                  toast.info("AgentP suggest", {
                    description:
                      "Pipeline pattern analysis will suggest optimal amount, stage, and probability.",
                  });
                },
              },
              {
                label: "Convert inbox thread",
                description:
                  "Create a deal from an active conversation and keep the communication history attached.",
                icon: Sparkles,
                onSelect: () => {
                  toast.info("Convert inbox thread", {
                    description: "Select an active conversation to convert into a pipeline deal.",
                  });
                },
              },
              {
                label: "Launch deal automation",
                description:
                  "Attach reminders, stakeholder follow-ups, and stage-based automations from day one.",
                icon: Zap,
                onSelect: () => {
                  toast.info("Launch deal automation", {
                    description: "Automation builder will open with deal-triggered templates.",
                  });
                },
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

      {/* Metrics */}
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
          icon={Clock}
          tone="success"
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals by company, contact, or tags..."
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="size-4 mr-2" />
          Filters
          {showFilters ? (
            <ChevronUp className="size-4 ml-2" />
          ) : (
            <ChevronDown className="size-4 ml-2" />
          )}
        </Button>
      </div>

      {/* Pipeline Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {visibleStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={deals[stage.id]}
                onAddDeal={() => void handleAddDealToStage(stage.id)}
                onDealClick={handleDealClick}
                onDealOptions={handleDealOptions}
                isCreating={isCreating}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeDeal && activeStage ? (
            <div className="cursor-grabbing">
              <SortableDealCard
                deal={activeDeal}
                stageId={activeStage}
                onClick={() => {
                  toast.info("Release to drop the deal in a new stage");
                }}
                onOptions={(e) => {
                  e.stopPropagation();
                  toast.info("Options available after dropping the deal");
                }}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

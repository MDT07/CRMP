import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle,
  Clock,
  GitBranch,
  type LucideIcon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  createAutomationRule,
  fetchAutomationRules,
  fetchAutomationRuleRuns,
  updateAutomationRule,
  type AutomationRule,
  type AutomationRuleRun,
} from "../../lib/crm-api";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { useCrmApp } from "../../providers/CrmProvider";
import { PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";

interface AutomationView {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  runs: number;
  lastRun: string;
  active: boolean;
}

const fallbackAutomations: AutomationView[] = [
  {
    id: "preview-1",
    name: "New Lead Welcome Sequence",
    description: "Sends a personalized welcome message when a lead enters CRM.",
    trigger: "contact_created",
    actions: ["Create follow-up task"],
    runs: 247,
    lastRun: "Preview mode",
    active: true,
  },
  {
    id: "preview-2",
    name: "Deal Stage Nudge",
    description: "Adds a follow-up task whenever a deal changes stages.",
    trigger: "deal_stage_changed",
    actions: ["Create follow-up task", "Refresh deal score"],
    runs: 89,
    lastRun: "Preview mode",
    active: true,
  },
  {
    id: "preview-3",
    name: "Inbox Priority Scoring",
    description: "Refreshes deal score on inbound messages linked to opportunities.",
    trigger: "message_received",
    actions: ["Refresh deal score"],
    runs: 52,
    lastRun: "Preview mode",
    active: false,
  },
];

const automationTemplates = [
  {
    name: "Follow-up on stage changes",
    description: "Create one owner task every time a deal changes stage.",
    event_type: "deal_stage_changed",
    actions: [
      {
        type: "create_follow_up_task",
        title: "Review stage change and follow up",
      },
    ],
  },
  {
    name: "Score refresh on inbound messages",
    description: "Refresh deal probability after customer replies.",
    event_type: "message_received",
    actions: [
      {
        type: "refresh_deal_score",
      },
    ],
  },
  {
    name: "New contact qualification",
    description: "Create an initial qualification task for new contacts.",
    event_type: "contact_created",
    actions: [
      {
        type: "create_follow_up_task",
        title: "Qualify new contact and capture next step",
      },
    ],
  },
];

const actionIcons: Record<string, LucideIcon> = {
  "Create follow-up task": CheckCircle,
  "Refresh deal score": GitBranch,
};

function toActionLabel(action: Record<string, unknown>) {
  const actionType = String(action.type ?? "");
  if (actionType === "create_follow_up_task") {
    return "Create follow-up task";
  }
  if (actionType === "refresh_deal_score") {
    return "Refresh deal score";
  }
  return actionType || "Action";
}

function formatLastRun(runs: AutomationRuleRun[]) {
  const latest = runs[0]?.executed_at;
  if (!latest) {
    return "Not run yet";
  }
  return new Date(latest).toLocaleString();
}

async function buildAutomationViews(rules: AutomationRule[]): Promise<AutomationView[]> {
  const runsByRule = await Promise.all(
    rules.map(async (rule) => {
      try {
        const runs = await fetchAutomationRuleRuns(rule.id, 50);
        return [rule.id, runs] as const;
      } catch {
        return [rule.id, [] as AutomationRuleRun[]] as const;
      }
    }),
  );
  const runsMap = new Map(runsByRule);

  return rules.map((rule) => {
    const runs = runsMap.get(rule.id) ?? [];
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description ?? "No description",
      trigger: rule.event_type,
      actions: (rule.actions ?? []).map(toActionLabel),
      runs: runs.length,
      lastRun: formatLastRun(runs),
      active: rule.is_active,
    };
  });
}

export function AutomationsPage() {
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    setAssistantSelection,
  } = useCrmApp();
  const [automations, setAutomations] = useState<AutomationView[]>(fallbackAutomations);
  const [source, setSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live automations"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest automations"
          : "Preview automations";

  const activeCount = useMemo(
    () => automations.filter((automation) => automation.active).length,
    [automations],
  );

  const loadAutomations = async () => {
    const rules = await fetchAutomationRules();
    const views = await buildAutomationViews(rules);
    setAutomations(views);
    setSource("live");
    setError(null);
  };

  useEffect(() => {
    if (connection === "loading") {
      setSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setSource("preview");
      setError(
        connection === "fallback"
          ? "Backend connection is unavailable. Showing preview automations."
          : "Guest mode keeps automations in preview.",
      );
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        await loadAutomations();
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Falling back to preview automations.", loadError);
        setSource("preview");
        setError("Using preview automations because live workflow data could not be loaded.");
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Automations",
        route: "/automations",
        dataSource: source,
        selectedEntities: automations.slice(0, 4).map((automation) => ({
          entity_type: "automation_rule",
          entity_id: automation.id,
        })),
        summary: "Automation rules and runs context",
      }),
    );

    return () => {
      clearAssistantSelection();
    };
  }, [automations, clearAssistantSelection, setAssistantSelection, source]);

  const toggle = async (id: string) => {
    const activeRule = automations.find((automation) => automation.id === id);
    if (!activeRule) {
      return;
    }

    if (source !== "live") {
      setAutomations((previous) =>
        previous.map((automation) =>
          automation.id === id ? { ...automation, active: !automation.active } : automation,
        ),
      );
      toast(activeRule.active ? "Automation paused" : "Automation resumed", {
        description: `${activeRule.name} is now ${activeRule.active ? "paused" : "active"}.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateAutomationRule(id, { is_active: !activeRule.active });
      await loadAutomations();
      toast.success(activeRule.active ? "Automation paused" : "Automation resumed", {
        description: `${activeRule.name} is now ${activeRule.active ? "paused" : "active"}.`,
      });
    } catch (toggleError) {
      console.error(toggleError);
      toast.error("Could not update automation", {
        description: "The workflow state could not be changed right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAutomation = async () => {
    const template = automationTemplates[automations.length % automationTemplates.length];

    if (source !== "live") {
      const nextAutomation: AutomationView = {
        id: `preview-${Date.now()}`,
        name: template.name,
        description: template.description,
        trigger: template.event_type,
        actions: template.actions.map(toActionLabel),
        runs: 0,
        lastRun: "Not run yet",
        active: true,
      };
      setAutomations((previous) => [nextAutomation, ...previous]);
      toast.success("Preview automation created", {
        description: `${nextAutomation.name} is now visible in preview mode.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      await createAutomationRule({
        ...template,
        is_active: true,
      });
      await loadAutomations();
      toast.success("Automation created", {
        description: `${template.name} is active and ready to run.`,
      });
    } catch (createError) {
      console.error(createError);
      toast.error("Could not create automation", {
        description: "The workflow rule could not be created right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditAutomation = async (id: string) => {
    if (source !== "live") {
      setAutomations((previous) =>
        previous.map((automation) =>
          automation.id === id
            ? {
                ...automation,
                actions: automation.actions.includes("Refresh deal score")
                  ? automation.actions.filter((action) => action !== "Refresh deal score")
                  : [...automation.actions, "Refresh deal score"],
              }
            : automation,
        ),
      );
      toast.info("Preview automation updated", {
        description: "Action mix was adjusted in preview mode.",
      });
      return;
    }

    const rule = (await fetchAutomationRules()).find((item) => item.id === id);
    if (!rule) {
      return;
    }
    const hasRefreshScore = (rule.actions ?? []).some(
      (action) => String(action.type ?? "") === "refresh_deal_score",
    );
    const nextActions = hasRefreshScore
      ? rule.actions.filter((action) => String(action.type ?? "") !== "refresh_deal_score")
      : [...rule.actions, { type: "refresh_deal_score" }];

    setIsSaving(true);
    try {
      await updateAutomationRule(rule.id, { actions: nextActions });
      await loadAutomations();
      toast.info("Automation updated", {
        description: `${rule.name} action set was updated.`,
      });
    } catch (updateError) {
      console.error(updateError);
      toast.error("Could not update automation", {
        description: "The workflow actions could not be updated right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Automations"
        description="Monitor repeatable work, keep owners aligned, and run rule-based follow-ups from one place."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="success">{activeCount} active workflows</StatusBadge>
          </>
        }
        actions={
          <Button variant="warning" onClick={() => void handleAddAutomation()} disabled={isSaving}>
            <Plus className="size-4" />
            New Automation
          </Button>
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-3">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {automations.map((automation, index) => {
          const isActive = automation.active;

          return (
            <motion.div
              key={automation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <SurfaceCard tone={isActive ? "accent" : "subtle"} className={`gap-0 ${isActive ? "" : "opacity-85"}`}>
                <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/18 bg-primary/12 text-primary">
                      <Zap className="size-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{automation.name}</p>
                        <StatusBadge tone={isActive ? "success" : "neutral"}>
                          {isActive ? "Active" : "Paused"}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{automation.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={isActive ? "warning" : "success"}
                      size="icon"
                      className="rounded-2xl"
                      onClick={() => void toggle(automation.id)}
                      disabled={isSaving}
                    >
                      {isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-2xl"
                      onClick={() => void handleEditAutomation(automation.id)}
                      disabled={isSaving}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="primary">{automation.trigger}</StatusBadge>
                    {automation.actions.map((action) => {
                      const Icon = actionIcons[action] || Bell;

                      return (
                        <div
                          key={action}
                          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/35 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          <ArrowRight className="size-3 text-primary" />
                          <Icon className="size-3.5 text-foreground" />
                          {action}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone="neutral">{automation.runs} runs</StatusBadge>
                      <span>Last run {automation.lastRun}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      <span className="font-medium text-foreground">
                        {isActive ? "Watching for events" : "Paused"}
                      </span>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

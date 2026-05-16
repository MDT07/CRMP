import { useEffect, useState } from "react";
import {
  Bot,
  ChevronRight,
  Clock3,
  GitBranch,
  MessageSquare,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useLocation } from "react-router";
import { toast } from "sonner";

import {
  approveAiProposal,
  type AIActionProposal,
  bulkDecideAiProposals,
  createAgentRun,
  CrmApiError,
  fetchAgentRun,
  fetchAgentRuns,
  fetchAiStatus,
  fetchAiProposals,
  fetchAiRecommendations,
  type AgentRun,
  type GroundedEvidenceItem,
  rejectAiProposal,
  sendInboxCopilotMessage,
  sendNemotronChatMessage,
  type AiAssistantStatusResponse,
  type AiRecommendationItem,
} from "../lib/crm-api";
import {
  executePermittedAction,
  getPageContext,
  getSelectionContext,
  isInboxAssistantSelection,
} from "../lib/assistant-hooks";
import { useCrmApp } from "../providers/CrmProvider";
import { getPageMeta } from "./shell-nav";
import { StatusBadge, SurfaceCard } from "./crm-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "./ui/utils";

const channelBadges = ["Instagram", "WhatsApp", "Email", "Live chat"];
const WORKSPACE_DEFAULT_MODEL = "workspace-default";
const toneOptions = [
  { value: "focused", label: "Focused" },
  { value: "direct", label: "Direct" },
  { value: "warm", label: "Warm" },
];

type DockTab = "chat" | "actions" | "history" | "settings";
type Tone = "primary" | "info" | "warning" | "success";

interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
}

interface QuickAction {
  id: string;
  icon: typeof Sparkles;
  label: string;
  description: string;
  prompt: string;
  tone: Tone;
}

interface CRMAgentPanelProps {
  onClose?: () => void;
  mode?: "rail" | "page";
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const toneIconClasses: Record<Tone, string> = {
  primary: "border-primary bg-primary text-primary",
  info: "border-info bg-info-soft text-info",
  warning: "border-warning bg-warning-soft text-warning",
  success: "border-success bg-success-soft text-success",
};

interface LiveInsight {
  id: string | number;
  icon: typeof Sparkles;
  tone: Tone;
  title: string;
  description: string;
  action: string;
}

const proposalTone = {
  pending: "warning",
  approved: "info",
  rejected: "neutral",
  executed: "success",
  failed: "warning",
} as const;

function getErrorMessage(error: unknown) {
  if (error instanceof CrmApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The CRM AI service is temporarily unavailable.";
}

function getRecommendationTone(priority?: string): Tone {
  if (priority === "high") {
    return "warning";
  }

  if (priority === "low") {
    return "success";
  }

  return "info";
}

function getRecommendationIcon(item: AiRecommendationItem) {
  if (item.entity_type === "deal") {
    return GitBranch;
  }

  if (item.entity_type === "message") {
    return MessageSquare;
  }

  if (item.entity_type === "task") {
    return Zap;
  }

  return TrendingUp;
}

function formatProposalDiff(proposal: AIActionProposal) {
  const maybeDiff = proposal.diff_payload?.after;
  if (!maybeDiff || typeof maybeDiff !== "object" || Array.isArray(maybeDiff)) {
    return "";
  }

  return Object.entries(maybeDiff as Record<string, unknown>)
    .slice(0, 4)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(", ")}`;
      }

      return `${key}: ${String(value)}`;
    })
    .join(" | ");
}

export function CRMAgentPanel({
  onClose,
  mode = "rail",
  collapsed = false,
  onToggleCollapsed,
}: CRMAgentPanelProps) {
  const location = useLocation();
  const {
    assistantSelection,
    authState,
    connection,
    dashboard,
    isGuest,
    workspace,
  } = useCrmApp();
  const pageMeta = getPageMeta(location.pathname);
  const [activeTab, setActiveTab] = useState<DockTab>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [insightOffset, setInsightOffset] = useState(0);
  const [selectedModel, setSelectedModel] = useState(WORKSPACE_DEFAULT_MODEL);
  const [assistantTone, setAssistantTone] = useState(toneOptions[0].value);
  const [pageAwareContext, setPageAwareContext] = useState(true);
  const [smartActionsEnabled, setSmartActionsEnabled] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [isRefreshingInsights, setIsRefreshingInsights] = useState(false);
  const [recommendations, setRecommendations] = useState<AiRecommendationItem[]>([]);
  const [aiStatus, setAiStatus] = useState<AiAssistantStatusResponse | null>(null);
  const [lastResponseMode, setLastResponseMode] = useState<string | null>(null);
  const [groundedEvidence, setGroundedEvidence] = useState<GroundedEvidenceItem[]>([]);
  const [threadProposals, setThreadProposals] = useState<AIActionProposal[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [proposalSource, setProposalSource] = useState<"inbox" | "agent" | null>(null);
  const [proposalDecisionId, setProposalDecisionId] = useState<string | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [activeBackgroundRunId, setActiveBackgroundRunId] = useState<string | null>(null);
  const [isQueueingBackgroundRun, setIsQueueingBackgroundRun] = useState(false);
  const [bulkDecisionMode, setBulkDecisionMode] = useState<"approve" | "reject" | null>(null);

  const isPageMode = mode === "page";
  const isCollapsibleRail = mode === "rail" && Boolean(onToggleCollapsed);
  const canUseLiveAI =
    authState === "authenticated" &&
    !isGuest &&
    connection !== "fallback" &&
    connection !== "loading";
  const activeAiMode =
    !canUseLiveAI
      ? "preview"
      : lastResponseMode === "fallback"
        ? "fallback"
        : (aiStatus?.mode ?? "checking");
  const connectionTone =
    connection === "fallback"
      ? "warning"
      : connection === "guest"
        ? "info"
        : connection === "loading"
          ? "info"
          : "success";
  const connectionLabel =
    connection === "fallback"
      ? "Preview mode"
      : connection === "guest"
        ? "Guest mode"
        : connection === "loading"
          ? "Syncing"
          : connection === "bootstrapped"
            ? "Starter workspace"
            : "Context live";
  const inboxSelection = isInboxAssistantSelection(assistantSelection)
    ? assistantSelection
    : null;
  const isGroundedInboxContext =
    canUseLiveAI &&
    inboxSelection &&
    inboxSelection.dataSource === "live" &&
    location.pathname.startsWith("/messages");
  const aiStatusTone =
    activeAiMode === "llm"
      ? "success"
      : activeAiMode === "fallback"
        ? "warning"
        : activeAiMode === "checking"
          ? "info"
          : "neutral";
  const aiStatusLabel =
    activeAiMode === "llm"
      ? "LLM live"
      : activeAiMode === "fallback"
        ? "Fallback AI"
        : activeAiMode === "checking"
          ? "Checking AI"
          : connection === "fallback"
            ? "Preview AI"
            : isGuest
              ? "Guest AI"
              : "AI ready";
  const workspaceSummary =
    connection === "fallback"
      ? "The assistant is using local preview data while backend sync is offline."
      : isGuest
        ? "Guest mode keeps the assistant focused on demo contacts, deals, and inbox pressure."
        : isGroundedInboxContext && inboxSelection
          ? `Grounded on ${inboxSelection.participantName}'s live thread${inboxSelection.company ? ` at ${inboxSelection.company}` : ""}. Evidence and proposed CRM writes stay reviewable before anything changes.`
        : `Watching ${workspace.stats.deals} deals, ${workspace.stats.messages} conversations, and ${workspace.stats.tasks} active tasks inside ${workspace.name}.`;
  const statusSummary =
    !canUseLiveAI
      ? connection === "fallback"
        ? "Live AI stays paused until the backend and local model are both reachable."
        : authState === "authenticated"
          ? "CRMagent is waiting for the workspace to finish syncing."
          : "Sign in to a live workspace to unlock backend-driven AI."
      : isGroundedInboxContext
        ? "Inbox copilot is grounded in the selected thread and will keep every proposed CRM write pending until you approve it."
      : aiStatus?.detail ?? "Checking the configured AI runtime.";
  const selectionContext = getSelectionContext(assistantSelection);
  const assistantContext = {
    ...getPageContext({
      pathname: location.pathname,
      pageTitle: pageMeta.title,
      workspace,
      dashboard,
      pageAwareContext,
    }),
    selection: selectionContext,
  };
  const selectedEntities = Array.isArray(selectionContext.selected_entities)
    ? selectionContext.selected_entities
        .filter(
          (item): item is { entity_type: string; entity_id: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                "entity_type" in item &&
                "entity_id" in item &&
                typeof (item as { entity_type: unknown }).entity_type === "string" &&
                typeof (item as { entity_id: unknown }).entity_id === "string",
            ),
        )
        .slice(0, 24)
    : [];
  const agentSelectionPayload = {
    page: pageMeta.title,
    route: location.pathname,
    data_source: (canUseLiveAI
      ? "live"
      : connection === "loading"
        ? "loading"
        : "preview") as "live" | "preview" | "loading",
    thread_id:
      (selectionContext as any)?.threadId ||
      (selectionContext as any)?.thread_id ||
      undefined,
    selected_entities: selectedEntities,
  };
  const availableModels = Array.from(
    new Set(
      [
        ...(aiStatus?.loaded_models ?? []),
        ...(aiStatus?.available_models ?? []),
      ].filter(Boolean),
    ),
  );
  const modelOptions = [
    {
      value: WORKSPACE_DEFAULT_MODEL,
      label: aiStatus?.configured_model
        ? `Workspace default (${aiStatus.configured_model})`
        : "Workspace default",
    },
    ...availableModels.map((model) => ({
      value: model,
      label: model,
    })),
  ];
  const selectedModelLabel =
    selectedModel === WORKSPACE_DEFAULT_MODEL
      ? aiStatus?.configured_model ?? "Workspace default"
      : selectedModel;

  const fallbackInsights: LiveInsight[] = [
    {
      id: 1,
      icon: TrendingUp,
      tone: "primary" as const,
      title:
        connection === "fallback"
          ? "Growth signals in preview"
          : isGuest
            ? "Guest growth signals"
            : `${dashboard.metrics.conversion_rate.toFixed(1)}% conversion rate`,
      description:
        connection === "fallback"
          ? "Revenue and pipeline patterns stay visible even while live sync is paused."
          : isGuest
            ? "Guest mode mirrors live growth patterns so the CRM stays explorable."
            : `${dashboard.metrics.deals_closed} won deals and ${workspace.stats.deals} tracked opportunities are shaping the forecast.`,
      action: "Review chart",
    },
    {
      id: 2,
      icon: MessageSquare,
      tone: "info" as const,
      title: `${workspace.stats.messages} tracked conversations`,
      description:
        connection === "fallback"
          ? "Inbox pressure is simulated right now, but the workflow is already structured."
          : isGuest
            ? "Conversation pressure is simulated in guest mode, but the inbox flow matches the live model."
            : `${workspace.stats.messages} messages are linked to contacts and deals inside ${workspace.name}.`,
      action: "Open inbox",
    },
    {
      id: 3,
      icon: Zap,
      tone: "success" as const,
      title: workspace.crm_ready ? "Automation-ready workspace" : "Workspace needs seed data",
      description: workspace.crm_ready
        ? `${workspace.stats.tasks} tasks are available for reminders, follow-ups, and AI-triggered workflows.`
        : "Seed the workspace with CRM data before turning on assistant-led automations.",
      action: workspace.crm_ready ? "Build flow" : "Seed workspace",
    },
  ];
  const liveInsights: LiveInsight[] =
    recommendations.length > 0
      ? recommendations.map((item, index) => ({
          id: `${item.title}-${index}`,
          icon: getRecommendationIcon(item),
          tone: getRecommendationTone(item.priority),
          title: item.title,
          description: item.description,
          action: item.action_label ?? "Review",
        }))
      : fallbackInsights;
  const insightItems = liveInsights.map((_, index) => {
    return liveInsights[(index + insightOffset) % liveInsights.length];
  });
  const quickActions: QuickAction[] = [
    {
      id: "summary",
      icon: Sparkles,
      label: "Summarize current context",
      description: "Turn the current page state into a compact operational summary.",
      prompt: `Summarize the ${pageMeta.title.toLowerCase()} context and highlight the biggest risk.`,
      tone: "primary",
    },
    {
      id: "deal",
      icon: GitBranch,
      label: "Create deal draft",
      description: "Draft a new opportunity with suggested stage, value, and owner.",
      prompt: "Create a deal draft from the current CRM context with stage and value suggestions.",
      tone: "info",
    },
    {
      id: "reply",
      icon: MessageSquare,
      label: "Draft reply",
      description: "Prepare a fast response using the latest inbox or account context.",
      prompt: "Draft a reply from the latest CRM context and keep it concise.",
      tone: "success",
    },
    {
      id: "next-step",
      icon: TrendingUp,
      label: "Next best action",
      description: "Recommend the fastest move to increase momentum or reduce risk.",
      prompt: "What is the next best action right now based on this CRM context?",
      tone: "warning",
    },
  ];
  const starterMessage: Message = {
    id: 0,
    role: "ai",
    content:
      connection === "fallback"
        ? "I am ready in preview mode. Once the backend is reachable, I can work against live deals, contacts, and inbox history."
        : isGuest
          ? "I am ready in guest mode. Explore summaries, next-best actions, and reply drafts before creating a live workspace."
          : isGroundedInboxContext && inboxSelection
            ? `I am grounded in ${inboxSelection.participantName}'s live inbox thread. Ask for a summary, reply draft, or next action and I will keep any CRM write behind an approval step.`
          : `I am watching ${workspace.stats.deals} deals, ${workspace.stats.messages} conversations, and ${dashboard.metrics.active_clients} active contacts in ${workspace.name}.`,
  };
  const visibleMessages = messages.length > 0 ? messages : [starterMessage];
  const messageHistoryItems =
    messages.length > 0
      ? messages
          .slice(-6)
          .reverse()
          .map((message, index) => ({
            id: `msg-${message.id}-${index}`,
            title: message.role === "user" ? "Prompt sent" : "Assistant response",
            detail: message.content,
            tone: message.role === "user" ? "info" : "success",
            statusLabel: "saved",
          }))
      : [
          {
            id: "page-context",
            title: `Context synced to ${pageMeta.title}`,
            detail: pageAwareContext
              ? "The assistant is prepared to use route context, counts, and current workspace status."
              : "Route context can be re-enabled from settings at any time.",
            tone: "primary" as const,
            statusLabel: "ready",
          },
          {
            id: "workflow-ready",
            title: "Quick actions ready",
            detail:
              "Deal creation, reply drafting, summaries, and next-step suggestions are available from this dock.",
            tone: "success" as const,
            statusLabel: "ready",
          },
        ];
  const runHistoryItems = agentRuns.slice(0, 6).map((run) => ({
    id: `run-${run.id}`,
    title: run.page ? `Agent run on ${run.page}` : "Agent background run",
    detail:
      run.status === "completed"
        ? run.output_content ?? "Run completed."
        : run.status === "failed"
          ? run.error_detail ?? "Run failed."
          : "Run is still in progress.",
    tone: (run.status === "completed" ? "success" : run.status === "failed" ? "warning" : "info") as "success" | "warning" | "info",
    statusLabel: run.status,
  }));
  const historyItems = [...runHistoryItems, ...messageHistoryItems].slice(0, 10);
  const contextStats = [
    { label: "Page", value: pageMeta.title },
    { label: "Deals", value: String(workspace.stats.deals) },
    { label: "Inbox", value: String(workspace.stats.messages) },
  ];

  useEffect(() => {
    if (!canUseLiveAI) {
      setAiStatus(null);
      setLastResponseMode(null);
      return;
    }

    let cancelled = false;

    const syncAiStatus = async () => {
      try {
        const response = await fetchAiStatus();
        if (!cancelled) {
          setAiStatus(response);
        }
      } catch (error) {
        if (!cancelled) {
          setAiStatus({
            mode: "fallback",
            reachable: false,
            is_local: true,
            base_url: "",
            configured_model: null,
            available_models: [],
            loaded_models: [],
            detail: getErrorMessage(error),
          });
        }
      }
    };

    void syncAiStatus();

    return () => {
      cancelled = true;
    };
  }, [canUseLiveAI]);

  useEffect(() => {
    if (!canUseLiveAI) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;

    const syncRecommendations = async () => {
      try {
        const response = await fetchAiRecommendations();
        if (!cancelled) {
          setRecommendations(response.items);
          setInsightOffset(0);
        }
      } catch {
        if (!cancelled) {
          setRecommendations([]);
        }
      }
    };

    void syncRecommendations();

    return () => {
      cancelled = true;
    };
  }, [canUseLiveAI, location.pathname]);

  useEffect(() => {
    if (!canUseLiveAI) {
      setAgentRuns([]);
      setActiveBackgroundRunId(null);
      return;
    }

    let cancelled = false;

    const syncRuns = async () => {
      try {
        const runs = await fetchAgentRuns(20);
        if (!cancelled) {
          setAgentRuns(runs);
        }
      } catch {
        if (!cancelled) {
          setAgentRuns([]);
        }
      }
    };

    void syncRuns();

    return () => {
      cancelled = true;
    };
  }, [canUseLiveAI]);

  useEffect(() => {
    if (!activeBackgroundRunId || !canUseLiveAI) {
      return;
    }

    let cancelled = false;
    let timerId: number | null = null;

    const pollRun = async (attempt: number) => {
      try {
        const detail = await fetchAgentRun(activeBackgroundRunId);
        if (cancelled) {
          return;
        }

        setAgentRuns((previous) => {
          const next = [detail.run, ...previous.filter((run) => run.id !== detail.run.id)];
          return next.slice(0, 20);
        });

        if (detail.run.status === "completed" || detail.run.status === "failed") {
          setActiveBackgroundRunId(null);
          if (detail.run.status === "completed") {
            setLastResponseMode(detail.run.output_mode ?? "fallback");
            setGroundedEvidence(detail.run.evidence ?? []);
            setThreadProposals(detail.proposed_actions ?? []);
            setProposalSource("agent");
            setActiveTraceId(detail.run.trace_id);
            if (detail.run.output_content && typeof detail.run.output_content === 'string') {
              setMessages((previous) => [
                ...previous,
                {
                  id: Date.now() + attempt,
                  role: "ai" as const,
                  content: detail.run.output_content as string,
                },
              ]);
            }
            toast.success("Background run completed", {
              description: "The CRM operator agent finished and saved new proposals.",
            });
          } else {
            toast.warning("Background run failed", {
              description:
                detail.run.error_detail ??
                "The operator run failed before returning a response.",
            });
          }
          return;
        }

        if (attempt >= 30) {
          setActiveBackgroundRunId(null);
          toast.warning("Background run still in progress", {
            description: "Polling timed out. Open history to check the latest status.",
          });
          return;
        }

        timerId = window.setTimeout(() => {
          void pollRun(attempt + 1);
        }, 3000);
      } catch (error) {
        if (!cancelled) {
          setActiveBackgroundRunId(null);
          toast.warning("Could not poll background run", {
            description: getErrorMessage(error),
          });
        }
      }
    };

    void pollRun(0);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [activeBackgroundRunId, canUseLiveAI]);

  useEffect(() => {
    if (!isGroundedInboxContext || !inboxSelection) {
      if (proposalSource === "inbox") {
        setGroundedEvidence([]);
        setThreadProposals([]);
        setActiveTraceId(null);
        setProposalSource(null);
      }
      return;
    }

    let cancelled = false;

    const syncThreadProposals = async () => {
      try {
        const proposals = await fetchAiProposals({
          threadId: inboxSelection.threadId,
          limit: 12,
        });
        if (!cancelled) {
          setThreadProposals(proposals);
          setProposalSource("inbox");
        }
      } catch {
        if (!cancelled) {
          setThreadProposals([]);
        }
      }
    };

    setGroundedEvidence([]);
    setActiveTraceId(null);
    void syncThreadProposals();

    return () => {
      cancelled = true;
    };
  }, [inboxSelection, isGroundedInboxContext, proposalSource]);

  const buildFallbackResponse = () => {
    if (connection === "fallback") {
      return "The CRM AI service is currently in preview mode. Live AI responses will be available once the backend connection is restored.";
    }

    if (isGuest) {
      return "The clearest move in guest mode is still to work the inbox and high-intent deals first. Once you create a workspace, I can turn that into live recommendations.";
    }

    if (inboxSelection) {
      return `I can help with ${inboxSelection.participantName}'s thread as soon as the live inbox and local model are both available.`;
    }

    return `Start with the ${workspace.stats.messages} linked conversations, then focus on the ${workspace.stats.deals} active deals while automation handles routine follow-ups.`;
  };

  const handleSend = async (value?: string) => {
    const message = (value ?? input).trim();
    if (!message) {
      return;
    }
    const requestedModel =
      selectedModel === WORKSPACE_DEFAULT_MODEL ? undefined : selectedModel;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: message,
    };
    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);
    setInput("");
    setActiveTab("chat");

    if (!canUseLiveAI) {
      // Even in fallback mode, try to use Nemotron AI for basic chat
      try {
        const response = await sendNemotronChatMessage(message);
        setLastResponseMode(response.mode);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "ai",
            content: response.content,
          },
        ]);
        return;
      } catch (error) {
        // If Nemotron fails, fall back to generic response
        setLastResponseMode("fallback");
        window.setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              role: "ai",
              content: buildFallbackResponse(),
            },
          ]);
        }, 700);
        return;
      }
    }

    setIsResponding(true);

    try {
      let outputContent = "";

      if (isGroundedInboxContext && inboxSelection) {
        const response = await sendInboxCopilotMessage({
          prompt: message,
          thread_id: inboxSelection.threadId,
          message_ids: inboxSelection.messageIds,
          contact_id: inboxSelection.contactId,
          deal_id: inboxSelection.dealId,
          page: pageMeta.title,
          tone: assistantTone,
          model: requestedModel,
          context: assistantContext,
        });
        setLastResponseMode(response.mode);
        setGroundedEvidence(response.evidence);
        setThreadProposals(response.proposed_actions);
        setProposalSource("inbox");
        setActiveTraceId(response.trace_id);
        outputContent = response.content;
      } else {
        // Use Nemotron AI for direct chat
        const response = await sendNemotronChatMessage(message);
        setLastResponseMode(response.mode);
        outputContent = response.content;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          content: outputContent,
        },
      ]);
    } catch (error) {
      setLastResponseMode("fallback");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          content: buildFallbackResponse(),
        },
      ]);
      toast.warning("CRMagent fell back", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsResponding(false);
    }
  };

  const handleQueueBackgroundRun = async () => {
    const message = input.trim();
    if (!message) {
      return;
    }
    if (!canUseLiveAI) {
      toast.info("Live agent unavailable", {
        description: "Background runs are available when the live workspace is connected.",
      });
      return;
    }

    const requestedModel =
      selectedModel === WORKSPACE_DEFAULT_MODEL ? undefined : selectedModel;
    setIsQueueingBackgroundRun(true);

    try {
      const response = await createAgentRun({
        prompt: message,
        page: pageMeta.title,
        tone: assistantTone,
        model: requestedModel,
        selection: agentSelectionPayload,
        context: assistantContext,
      });
      setAgentRuns((previous) => [
        response.run,
        ...previous.filter((run) => run.id !== response.run.id),
      ]);
      setActiveBackgroundRunId(response.run.id);
      setInput("");
      setActiveTab("history");
      toast.success("Background run queued", {
        description: "The operator agent is running in the background.",
      });
    } catch (error) {
      toast.error("Could not queue background run", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsQueueingBackgroundRun(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    setProposalDecisionId(proposalId);
    try {
      const response = await approveAiProposal(proposalId);
      setThreadProposals((previous) =>
        previous.map((proposal) =>
          proposal.id === proposalId ? response.proposal : proposal,
        ),
      );
      toast.success("AI action approved", {
        description:
          response.execution?.detail ??
          `${response.proposal.title} was executed inside the local CRM.`,
      });
    } catch (error) {
      toast.error("Could not approve action", {
        description: getErrorMessage(error),
      });
    } finally {
      setProposalDecisionId(null);
    }
  };

  const handleBulkProposalDecision = async (decision: "approve" | "reject") => {
    const pendingIds = threadProposals
      .filter((proposal) => proposal.status === "pending")
      .map((proposal) => proposal.id);

    if (pendingIds.length === 0) {
      toast.info("No pending actions", {
        description: "There are no pending proposals to update.",
      });
      return;
    }

    setBulkDecisionMode(decision);
    try {
      const response = await bulkDecideAiProposals({
        proposal_ids: pendingIds,
        decision,
        reason:
          decision === "reject"
            ? "Rejected in bulk from the CRM assistant dock."
            : undefined,
      });
      const nextById = new Map(
        response.results
          .filter((item) => item.status === "ok" && item.decision?.proposal)
          .map((item) => [item.proposal_id, item.decision!.proposal]),
      );

      setThreadProposals((previous) =>
        previous.map((proposal) => nextById.get(proposal.id) ?? proposal),
      );

      const successCount = response.results.filter((item) => item.status === "ok").length;
      const failedCount = response.results.length - successCount;
      toast.success(
        decision === "approve" ? "Bulk approval completed" : "Bulk rejection completed",
        {
          description:
            failedCount > 0
              ? `${successCount} updated, ${failedCount} failed.`
              : `${successCount} proposals updated.`,
        },
      );
    } catch (error) {
      toast.error("Bulk decision failed", {
        description: getErrorMessage(error),
      });
    } finally {
      setBulkDecisionMode(null);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setProposalDecisionId(proposalId);
    try {
      const response = await rejectAiProposal(
        proposalId,
        "Rejected from the assistant action rail.",
      );
      setThreadProposals((previous) =>
        previous.map((proposal) =>
          proposal.id === proposalId ? response.proposal : proposal,
        ),
      );
      toast.success("AI action rejected", {
        description: "The proposal was left unexecuted until you approve a future action.",
      });
    } catch (error) {
      toast.error("Could not reject action", {
        description: getErrorMessage(error),
      });
    } finally {
      setProposalDecisionId(null);
    }
  };

  const handleRefreshInsights = async () => {
    if (!canUseLiveAI) {
      setInsightOffset((current) => (current + 1) % liveInsights.length);
      toast.success("AI priorities refreshed", {
        description:
          connection === "fallback"
            ? "Preview priorities were refreshed."
            : `Signals and workflow suggestions were refreshed for ${workspace.name}.`,
      });
      return;
    }

    setIsRefreshingInsights(true);

    try {
      const response = await fetchAiRecommendations();
      setRecommendations(response.items);
      setInsightOffset(0);
      toast.success("AI priorities refreshed", {
        description: `Signals and workflow suggestions were refreshed for ${workspace.name}.`,
      });
    } catch (error) {
      toast.warning("Unable to refresh live AI recommendations", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsRefreshingInsights(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    if (!smartActionsEnabled) {
      toast.info("Smart actions are paused", {
        description: "Turn them back on in settings to launch AI-assisted actions from the dock.",
      });
      return;
    }

    void executePermittedAction(action.id, {
      route: location.pathname,
    }).then((result) => {
      if (!result.ok) {
        toast.warning("Action is not permitted", {
          description: result.detail,
        });
        return;
      }
      void handleSend(action.prompt);
    });
  };

  const handleInsightClick = (title: string) => {
    void handleSend(title);
  };

  if (collapsed && isCollapsibleRail) {
    return (
      <div className="flex h-full flex-col items-center justify-between bg-canvas-strong px-1.5 py-3">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleCollapsed}
            className="flex size-10 items-center justify-center rounded-[calc(var(--radius)-3px)] border border-primary bg-primary text-primary transition-colors hover:bg-primary"
            aria-label="Expand CRM Agent"
          >
            <Bot className="size-4" />
          </button>

          <div className="grid gap-1.5">
            {quickActions.slice(0, 3).map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.id}
                  onClick={() => {
                    onToggleCollapsed?.();
                    handleQuickAction(action);
                  }}
                  className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:bg-surface-strong hover:text-foreground"
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          {contextStats.slice(1).map((stat) => (
            <div
              key={stat.label}
              className="flex w-10 flex-col items-center rounded-lg border border-border bg-card px-1.5 py-1.5"
            >
              <span className="font-metric text-[0.72rem] font-semibold text-foreground">
                {stat.value}
              </span>
              <span className="mt-0.5 text-[0.5rem] tracking-[0.14em] text-muted-foreground uppercase">
                {stat.label}
              </span>
            </div>
          ))}

          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg bg-transparent text-muted-foreground"
            onClick={onToggleCollapsed}
            aria-label="Open CRM Agent"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas-strong">
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg border border-primary bg-primary text-primary">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-foreground">CRMagent</p>
                  <StatusBadge tone={connectionTone}>{connectionLabel}</StatusBadge>
                  <StatusBadge tone={aiStatusTone}>{aiStatusLabel}</StatusBadge>
                  {isGroundedInboxContext ? (
                    <StatusBadge tone="info">Grounded inbox</StatusBadge>
                  ) : null}
                  {isPageMode ? <StatusBadge tone="primary">Full page</StatusBadge> : null}
                </div>
                <p className="truncate text-[0.72rem] text-muted-foreground">
                  {pageMeta.title}
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge tone="info">{selectedModelLabel}</StatusBadge>
              <StatusBadge tone={pageAwareContext ? "success" : "neutral"}>
                {pageAwareContext ? "Page-aware" : "Workspace-only"}
              </StatusBadge>
              <StatusBadge tone={smartActionsEnabled ? "primary" : "warning"}>
                {smartActionsEnabled ? "Actions ready" : "Actions paused"}
              </StatusBadge>
            </div>

            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              {workspaceSummary}
            </p>
            <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
              {statusSummary}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {isCollapsibleRail ? (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg"
                onClick={onToggleCollapsed}
                aria-label="Minimize CRM Agent panel"
              >
                <ChevronRight className="size-4 rotate-180" />
              </Button>
            ) : null}
            {onClose ? (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg"
                onClick={onClose}
                aria-label="Close CRM Agent panel"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DockTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b border-border px-3 py-2">
          <TabsList className="h-7 w-full rounded-lg bg-surface-muted p-0.5">
            <TabsTrigger value="chat" className="text-[0.72rem]">
              Chat
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-[0.72rem]">
              Actions
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[0.72rem]">
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-[0.72rem]">
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border px-3 py-2.5">
              <div className="grid grid-cols-3 gap-2">
                {contextStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[calc(var(--radius)-5px)] border border-border bg-card px-2.5 py-2"
                  >
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {stat.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-surface-strong hover:text-foreground"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-border px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.78rem] font-semibold text-foreground">Current focus</p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    Live priorities from the current CRM context
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  onClick={() => {
                    void handleRefreshInsights();
                  }}
                  disabled={isRefreshingInsights}
                >
                  <RefreshCw className={cn("size-4", isRefreshingInsights && "animate-spin")} />
                </Button>
              </div>

              <div className="mt-2 space-y-1.5">
                {insightItems.slice(0, 2).map((insight) => {
                  const Icon = insight.icon;

                  return (
                    <button
                      key={insight.id}
                      onClick={() => handleInsightClick(insight.title)}
                      className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-surface-strong"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "mt-0.5 flex size-7 items-center justify-center rounded-[calc(var(--radius)-5px)] border",
                            toneIconClasses[insight.tone],
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground">
                              {insight.title}
                            </p>
                            <StatusBadge tone={insight.tone}>{insight.action}</StatusBadge>
                          </div>
                          <p className="mt-0.5 text-[0.72rem] leading-5 text-muted-foreground">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[92%] rounded-lg border px-3 py-2",
                      message.role === "user"
                        ? "border-primary bg-primary text-foreground"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    <p className="text-sm leading-6">{message.content}</p>
                  </div>
                </div>
              ))}
              {isResponding ? (
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    <p className="text-sm leading-6 text-muted-foreground">
                      CRMagent is thinking...
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {groundedEvidence.length > 0 ? (
              <div className="border-t border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[0.78rem] font-semibold text-foreground">
                      Grounded evidence
                    </p>
                    <p className="text-[0.72rem] text-muted-foreground">
                      Live CRM records supporting the latest inbox response
                    </p>
                  </div>
                  {activeTraceId ? (
                    <StatusBadge tone="info">{activeTraceId.slice(0, 8)}</StatusBadge>
                  ) : null}
                </div>

                <div className="mt-2 space-y-1.5">
                  {groundedEvidence.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card px-2.5 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <StatusBadge tone="info">{item.source}</StatusBadge>
                      </div>
                      <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
                        {item.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-border px-3 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSend();
                    }
                  }}
                  placeholder="Ask about deals, replies, or next steps..."
                  className="border-none bg-transparent shadow-none focus-visible:ring-0"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg"
                  onClick={() => {
                    void handleQueueBackgroundRun();
                  }}
                  disabled={!input.trim() || isResponding || isQueueingBackgroundRun}
                >
                  <Clock3 className="size-4" />
                </Button>
                <Button
                  size="icon"
                  className="rounded-lg"
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={!input.trim() || isResponding || isQueueingBackgroundRun}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col gap-3 px-3 py-3">
            <SurfaceCard tone="accent" className="gap-2.5 p-3">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                Context-aware actions
              </p>
              <p className="text-sm text-foreground">
                {pageMeta.title} is active, so the dock is prioritizing actions that fit this workflow.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {channelBadges.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                  >
                    {channel}
                  </span>
                ))}
              </div>
            </SurfaceCard>

            {isGroundedInboxContext || threadProposals.length > 0 ? (
              <SurfaceCard tone="subtle" className="gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Approval-gated CRM actions
                    </p>
                    <p className="text-[0.72rem] text-muted-foreground">
                      AI can suggest CRM updates, but nothing changes until you approve them.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="info">{threadProposals.length} ready</StatusBadge>
                    {threadProposals.some((proposal) => proposal.status === "pending") ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bulkDecisionMode !== null}
                          onClick={() => {
                            void handleBulkProposalDecision("reject");
                          }}
                        >
                          Reject All
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={bulkDecisionMode !== null}
                          onClick={() => {
                            void handleBulkProposalDecision("approve");
                          }}
                        >
                          Approve All
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  {threadProposals.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                      <p className="text-[0.72rem] text-muted-foreground">
                        No pending actions for the selected thread yet.
                      </p>
                    </div>
                  ) : (
                    threadProposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold text-foreground">
                                {proposal.title}
                              </p>
                              <StatusBadge
                                tone={
                                  proposalTone[
                                    proposal.status as keyof typeof proposalTone
                                  ] ?? "info"
                                }
                              >
                                {proposal.status}
                              </StatusBadge>
                            </div>
                            <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
                              {proposal.detail ?? proposal.reasoning ?? "No extra detail."}
                            </p>
                            {formatProposalDiff(proposal) ? (
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {formatProposalDiff(proposal)}
                              </p>
                            ) : null}
                          </div>

                          {proposal.status === "pending" ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={proposalDecisionId === proposal.id}
                                onClick={() => {
                                  void handleRejectProposal(proposal.id);
                                }}
                              >
                                Reject
                              </Button>
                              <Button
                                variant="success"
                                size="sm"
                                disabled={proposalDecisionId === proposal.id}
                                onClick={() => {
                                  void handleApproveProposal(proposal.id);
                                }}
                              >
                                Approve
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            ) : null}

            <div className="min-h-0 space-y-2 overflow-y-auto">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-surface-strong"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border",
                          toneIconClasses[action.tone],
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[0.82rem] font-semibold text-foreground">
                            {action.label}
                          </p>
                          <StatusBadge tone={action.tone}>Ready</StatusBadge>
                        </div>
                        <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col gap-3 px-3 py-3">
            <SurfaceCard tone="subtle" className="gap-2 p-3">
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Recent interaction history
                  </p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    Keep prompts and outputs visible as reusable workspace context.
                  </p>
                </div>
              </div>
            </SurfaceCard>

            <div className="min-h-0 space-y-2 overflow-y-auto">
              {historyItems.map((item) => (
                <SurfaceCard
                  key={item.id}
                  tone="subtle"
                  className="gap-2 border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <StatusBadge tone={item.tone as "success" | "warning" | "info" | "neutral" | "primary" | "danger"}>{item.statusLabel}</StatusBadge>
                  </div>
                  <p className="text-[0.72rem] leading-5 text-muted-foreground">{item.detail}</p>
                </SurfaceCard>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col gap-3 px-3 py-3">
            <SurfaceCard tone="subtle" className="gap-3 p-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                  <Settings2 className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Assistant behavior</p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    Tune model choice, tone, and context behavior.
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">AI runtime</p>
                      <p className="text-[0.72rem] text-muted-foreground">{statusSummary}</p>
                    </div>
                    <StatusBadge tone={aiStatusTone}>{aiStatusLabel}</StatusBadge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Model
                  </p>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Tone
                  </p>
                  <Select value={assistantTone} onValueChange={setAssistantTone}>
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {toneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard tone="subtle" className="gap-2.5 p-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Page-aware context</p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    Use the current route and selected workflow context.
                  </p>
                </div>
                <Switch
                  checked={pageAwareContext}
                  onCheckedChange={setPageAwareContext}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Smart actions</p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    Keep quick actions available across CRM records.
                  </p>
                </div>
                <Switch
                  checked={smartActionsEnabled}
                  onCheckedChange={setSmartActionsEnabled}
                />
              </div>
            </SurfaceCard>

            <SurfaceCard tone="accent" className="gap-2 p-3">
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Dock ready for live logic</p>
              </div>
              <p className="text-[0.72rem] leading-5 text-muted-foreground">
                Model selection, history, route context, and workflow actions are structured so the copilot can grow without redesigning the shell again.
              </p>
            </SurfaceCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

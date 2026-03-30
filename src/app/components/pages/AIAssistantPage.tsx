import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Clock3,
  FolderSearch,
  GitBranch,
  Lightbulb,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchProjectIntelligence,
  sendProjectIntelligenceMessage,
  type ProjectDecisionHint,
  type ProjectFileSignal,
  type ProjectFocusMatch,
  type ProjectIntelligenceSnapshot,
} from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";

const POLL_INTERVAL_MS = 8000;
const SNAPSHOT_LIMIT = 8;

function buildPreviewSnapshot(): ProjectIntelligenceSnapshot {
  const now = new Date().toISOString();
  return {
    snapshot_id: "preview-snapshot",
    generated_at: now,
    project_root: "/workspace/preview",
    total_files: 236,
    total_directories: 22,
    language_breakdown: {
      TypeScript: 118,
      Python: 64,
      JSON: 23,
      Markdown: 12,
    },
    areas: [
      { path: "src", file_count: 128, last_modified_at: now },
      { path: "backend", file_count: 88, last_modified_at: now },
      { path: "guidelines", file_count: 6, last_modified_at: now },
    ],
    recent_files: [
      {
        path: "src/app/components/AIAssistantPanel.tsx",
        reason: "Edited recently.",
        score: 1,
        last_modified_at: now,
      },
      {
        path: "backend/app/services/ai_agent_service.py",
        reason: "Edited recently.",
        score: 1,
        last_modified_at: now,
      },
    ],
    hotspots: [
      {
        path: "backend/app/services/ai_agent_service.py",
        reason: "Edited 12m ago, core backend path",
        score: 5,
        last_modified_at: now,
      },
      {
        path: "src/app/components/AIAssistantPanel.tsx",
        reason: "Edited 18m ago, core frontend path",
        score: 4,
        last_modified_at: now,
      },
    ],
    decision_hints: [
      {
        title: "Start from the highest hotspot",
        detail: "Review backend service changes before syncing UI behavior.",
        confidence: "high",
      },
      {
        title: "Cross-layer edits detected",
        detail: "Validate API contracts and frontend error states together.",
        confidence: "medium",
      },
    ],
    focus: null,
    focus_matches: [],
    detail: "Preview snapshot is shown while live backend analysis is unavailable.",
  };
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const deltaSeconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);
  if (deltaSeconds < 60) {
    return "just now";
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)}h ago`;
  }
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

function getHintTone(confidence: ProjectDecisionHint["confidence"]) {
  if (confidence === "high") {
    return "warning";
  }
  if (confidence === "low") {
    return "neutral";
  }
  return "info";
}

function getSignalTone(score: number) {
  if (score >= 6) {
    return "warning";
  }
  if (score >= 3) {
    return "info";
  }
  return "success";
}

function renderMatchLabel(match: ProjectFocusMatch) {
  if (match.source === "content" && match.line) {
    return `${match.path}:${match.line}`;
  }
  return match.path;
}

function renderSignalSubtitle(item: ProjectFileSignal) {
  return `${item.reason} • ${formatRelativeTime(item.last_modified_at)}`;
}

export function AIAssistantPage() {
  const { authState, connection, isGuest } = useCrmApp();
  const [snapshot, setSnapshot] = useState<ProjectIntelligenceSnapshot | null>(null);
  const [focusInput, setFocusInput] = useState("");
  const [activeFocus, setActiveFocus] = useState("");
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = useState<"llm" | "fallback" | string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const canUseLiveAnalysis =
    authState === "authenticated" &&
    !isGuest &&
    connection !== "loading" &&
    connection !== "fallback";
  const previewSnapshot = useMemo(buildPreviewSnapshot, []);
  const visibleSnapshot = snapshot ?? previewSnapshot;
  const analysisStatusTone = canUseLiveAnalysis ? "success" : "warning";
  const analysisStatusLabel = canUseLiveAnalysis ? "Live project analysis" : "Preview analysis";

  const loadSnapshot = async (options?: { silent?: boolean }) => {
    if (!canUseLiveAnalysis) {
      setSnapshot(null);
      return;
    }

    const silent = options?.silent ?? false;
    if (!silent) {
      setIsLoadingSnapshot(true);
    }

    try {
      const response = await fetchProjectIntelligence({
        focus: activeFocus || undefined,
        limit: SNAPSHOT_LIMIT,
      });
      setSnapshot(response);
    } catch (error) {
      if (!silent) {
        toast.warning("Live project analysis unavailable", {
          description:
            error instanceof Error
              ? error.message
              : "The backend could not return project intelligence.",
        });
      }
      setSnapshot(null);
    } finally {
      if (!silent) {
        setIsLoadingSnapshot(false);
      }
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, [canUseLiveAnalysis, activeFocus]);

  useEffect(() => {
    if (!canUseLiveAnalysis) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadSnapshot({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [canUseLiveAnalysis, activeFocus]);

  const handleRefresh = async () => {
    if (!canUseLiveAnalysis) {
      toast.info("Preview analysis refreshed", {
        description: "Live backend analysis will unlock automatically when the workspace syncs.",
      });
      return;
    }

    setIsRefreshingSnapshot(true);
    await loadSnapshot();
    setIsRefreshingSnapshot(false);
  };

  const handleFocusSearch = () => {
    setActiveFocus(focusInput.trim());
  };

  const handleAskAssistant = async () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    if (!canUseLiveAnalysis) {
      setAnswerMode("fallback");
      setAnswer(
        "Live project analysis is paused in preview mode. Connect a live workspace to get file-level navigation guidance from the backend.",
      );
      return;
    }

    setIsAsking(true);
    try {
      const response = await sendProjectIntelligenceMessage({
        prompt: nextPrompt,
        focus: activeFocus || undefined,
        limit: SNAPSHOT_LIMIT,
      });
      setSnapshot(response.snapshot);
      setAnswer(response.content);
      setAnswerMode(response.mode);
    } catch (error) {
      setAnswerMode("fallback");
      setAnswer(
        error instanceof Error
          ? error.message
          : "The project assistant could not answer right now.",
      );
      toast.warning("Project assistant fell back", {
        description: "The local decision hints are still available in this page.",
      });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="AI Workspace"
        description="Real-time project intelligence for faster code navigation and safer implementation decisions."
        meta={
          <>
            <StatusBadge tone={analysisStatusTone}>{analysisStatusLabel}</StatusBadge>
            <StatusBadge tone="info">
              Updated {formatRelativeTime(visibleSnapshot.generated_at)}
            </StatusBadge>
            {answerMode ? (
              <StatusBadge tone={answerMode === "llm" ? "success" : "warning"}>
                {answerMode === "llm" ? "LLM guidance" : "Fallback guidance"}
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isLoadingSnapshot || isRefreshingSnapshot}
          >
            <RefreshCw
              className={cn(
                "mr-2 size-4",
                (isLoadingSnapshot || isRefreshingSnapshot) && "animate-spin",
              )}
            />
            Refresh Snapshot
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <SurfaceCard tone="accent" className="gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-[calc(var(--radius)-3px)] border border-primary/18 bg-primary/12 text-primary">
              <Bot className="size-4" />
            </div>
            <div>
              <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-primary/80 uppercase">
                Project intelligence
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Analyze code movement while you work
              </p>
              <p className="mt-1 text-[0.8rem] leading-6 text-muted-foreground">
                This assistant continuously snapshots the repository, highlights hotspots, and
                proposes next checks so implementation decisions stay grounded in the latest code
                changes.
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-3 py-2.5">
              <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Files
              </p>
              <p className="mt-1 text-[0.86rem] font-semibold text-foreground">
                {visibleSnapshot.total_files}
              </p>
              <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
                Tracked code and config files
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-3 py-2.5">
              <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Directories
              </p>
              <p className="mt-1 text-[0.86rem] font-semibold text-foreground">
                {visibleSnapshot.total_directories}
              </p>
              <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
                Workspace scope analyzed
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-3 py-2.5">
              <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Hotspots
              </p>
              <p className="mt-1 text-[0.86rem] font-semibold text-foreground">
                {visibleSnapshot.hotspots.length}
              </p>
              <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground">
                High-signal files to inspect first
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(visibleSnapshot.language_breakdown)
              .slice(0, 6)
              .map(([language, count]) => (
                <StatusBadge key={language} tone="info">
                  {language}: {count}
                </StatusBadge>
              ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-3 p-3">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-primary" />
            <p className="text-[0.8rem] font-semibold text-foreground">Focus navigator</p>
          </div>
          <p className="text-[0.72rem] leading-5 text-muted-foreground">
            Narrow analysis to a module, endpoint, feature flag, or keyword.
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={focusInput}
              onChange={(event) => setFocusInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleFocusSearch();
                }
              }}
              placeholder="Try: assistant, auth, pipeline, api key"
              className="h-9"
            />
            <Button variant="outline" size="sm" onClick={handleFocusSearch}>
              Apply
            </Button>
          </div>
          <div className="space-y-1.5">
            {visibleSnapshot.focus_matches.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-2.5 py-2">
                <p className="text-[0.72rem] text-muted-foreground">
                  {activeFocus
                    ? `No direct matches for "${activeFocus}" yet.`
                    : "Apply a focus to surface matching files and lines."}
                </p>
              </div>
            ) : (
              visibleSnapshot.focus_matches.slice(0, 5).map((match) => (
                <div
                  key={`${match.path}-${match.source}-${match.line ?? "path"}`}
                  className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5">
                    <StatusBadge tone={match.source === "content" ? "primary" : "info"}>
                      {match.source}
                    </StatusBadge>
                    <p className="truncate text-[0.76rem] font-semibold text-foreground">
                      {renderMatchLabel(match)}
                    </p>
                  </div>
                  <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">
                    {match.snippet}
                  </p>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfaceCard tone="subtle" className="gap-2.5 p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-primary" />
            <p className="text-[0.8rem] font-semibold text-foreground">Hotspots</p>
          </div>
          <p className="text-[0.72rem] leading-5 text-muted-foreground">
            Start from these files to understand the latest change pressure.
          </p>
          <div className="space-y-2">
            {visibleSnapshot.hotspots.slice(0, 6).map((item) => (
              <div
                key={item.path}
                className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[0.78rem] font-semibold text-foreground">
                    {item.path}
                  </p>
                  <StatusBadge tone={getSignalTone(item.score)}>
                    score {item.score}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">
                  {renderSignalSubtitle(item)}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-2.5 p-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <p className="text-[0.8rem] font-semibold text-foreground">Decision hints</p>
          </div>
          <p className="text-[0.72rem] leading-5 text-muted-foreground">
            Suggested next checks based on repository movement.
          </p>
          <div className="space-y-2">
            {visibleSnapshot.decision_hints.slice(0, 6).map((hint) => (
              <div
                key={`${hint.title}-${hint.detail}`}
                className="rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card px-2.5 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-[0.78rem] font-semibold text-foreground">{hint.title}</p>
                  <StatusBadge tone={getHintTone(hint.confidence)}>
                    {hint.confidence}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">{hint.detail}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard tone="accent" className="gap-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-[0.82rem] font-semibold text-foreground">
            Ask project assistant
          </p>
          <StatusBadge tone="info">
            <Clock3 className="mr-1 size-3" />
            Real-time snapshot
          </StatusBadge>
        </div>
        <p className="text-[0.72rem] leading-5 text-muted-foreground">
          Ask where to implement a feature, which files are risky, or what to validate before
          shipping.
        </p>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: I need to add role-based checks to API keys. Where should we edit first and what tests should we run?"
          className="min-h-24 resize-y"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => {
              void handleAskAssistant();
            }}
            disabled={!prompt.trim() || isAsking}
          >
            <FolderSearch className="mr-2 size-4" />
            {isAsking ? "Analyzing..." : "Analyze and guide"}
          </Button>
        </div>

        {answer ? (
          <div className="rounded-[calc(var(--radius)-3px)] border border-border/80 bg-card px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Bot className="size-4 text-primary" />
              <p className="text-[0.78rem] font-semibold text-foreground">Assistant response</p>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-6 text-foreground">
              {answer}
            </p>
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  );
}

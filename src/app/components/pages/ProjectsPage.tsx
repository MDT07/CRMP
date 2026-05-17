import { ArrowRight, CheckCircle2, FolderKanban, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import {
  convertDealToProject,
  type Deal,
  fetchDeals,
  fetchProjects,
  type Project,
  type ProjectStatus,
  updateProject,
} from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { PageHeader, SmartActionButton, StatusBadge, SurfaceCard } from "../crm-ui";

const statusOrder: ProjectStatus[] = ["planned", "active", "on_hold", "completed", "cancelled"];

const statusTone: Record<ProjectStatus, "info" | "primary" | "warning" | "success" | "danger"> = {
  planned: "info",
  active: "primary",
  on_hold: "warning",
  completed: "success",
  cancelled: "danger",
};

const fallbackProjects: Project[] = [
  {
    id: "preview-project-1",
    organization_id: "preview-org",
    deal_id: "preview-deal-1",
    owner_user_id: null,
    name: "Northstar rollout implementation",
    status: "active",
    kickoff_date: "2026-02-01",
    target_end_date: "2026-04-12",
    notes: "Preview project created from a closed-won deal.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function nextStatus(status: ProjectStatus) {
  const index = statusOrder.indexOf(status);
  if (index === -1 || index === statusOrder.length - 1) {
    return statusOrder[0];
  }
  return statusOrder[index + 1];
}

export function ProjectsPage() {
  const { clearAssistantSelection, connection, isGuest, setAssistantSelection } = useCrmApp();
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [source, setSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live projects"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest projects"
          : "Preview projects";

  const wonDeals = useMemo(
    () => deals.filter((deal) => deal.pipeline_stage === "closed_won"),
    [deals]
  );
  const unconvertedWonDeal = useMemo(() => {
    const converted = new Set(projects.map((project) => project.deal_id));
    return wonDeals.find((deal) => !converted.has(deal.id)) ?? null;
  }, [projects, wonDeals]);
  const dealMap = useMemo(() => new Map(deals.map((deal) => [deal.id, deal])), [deals]);

  const loadProjects = async () => {
    const [projectRecords, dealRecords] = await Promise.all([fetchProjects(), fetchDeals()]);
    setProjects(projectRecords);
    setDeals(dealRecords);
    setSource("live");
    setError(null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load function defined below
  useEffect(() => {
    if (connection === "loading") {
      setSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setSource("preview");
      setProjects(fallbackProjects);
      setDeals([]);
      setError(
        connection === "fallback"
          ? "Backend connection is unavailable. Showing preview project workspace."
          : "Guest mode keeps projects in preview."
      );
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        await loadProjects();
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Projects page switched to preview data.", loadError);
        setSource("preview");
        setProjects(fallbackProjects);
        setDeals([]);
        setError("Using preview projects because live project data could not be loaded.");
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
        page: "Projects",
        route: "/projects",
        dataSource: source,
        selectedEntities: projects.slice(0, 4).map((project) => ({
          entity_type: "project",
          entity_id: project.id,
        })),
        summary: "Project delivery and deal conversion context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, projects, setAssistantSelection, source]);

  const handleConvertDeal = async () => {
    if (!unconvertedWonDeal) {
      toast.info("No convertible deals", {
        description: "Closed-won deals are already converted into projects.",
      });
      return;
    }

    if (source !== "live") {
      toast.info("Live conversion unavailable", {
        description: "Deal-to-project conversion runs in live workspace mode.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await convertDealToProject(unconvertedWonDeal.id, {
        name: `${unconvertedWonDeal.title} - Delivery`,
      });
      await loadProjects();
      toast.success("Project created", {
        description: `${unconvertedWonDeal.title} was converted into a project.`,
      });
    } catch (convertError) {
      console.error(convertError);
      toast.error("Could not convert deal", {
        description: "This deal could not be converted into a project right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdvanceStatus = async (project: Project) => {
    const next = nextStatus(project.status);

    if (source !== "live") {
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? { ...item, status: next } : item))
      );
      toast.info("Preview status changed", {
        description: `${project.name} moved to ${next}.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateProject(project.id, { status: next });
      await loadProjects();
      toast.success("Project status updated", {
        description: `${project.name} moved to ${next}.`,
      });
    } catch (updateError) {
      console.error(updateError);
      toast.error("Could not update status", {
        description: "The project status could not be updated right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Projects"
        description="Run post-win delivery with linked deal context, status progression, and owner accountability."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="success">{projects.length} active project records</StatusBadge>
          </>
        }
        actions={
          <SmartActionButton
            label="Convert Won Deal"
            icon={Plus}
            variant="success"
            onClick={() => void handleConvertDeal()}
            disabled={isSaving}
            items={[
              {
                label: "Convert next won deal",
                description:
                  "Create a delivery project from the next available closed-won opportunity.",
                icon: FolderKanban,
                onSelect: () => void handleConvertDeal(),
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

      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => {
          const relatedDeal = dealMap.get(project.deal_id);
          return (
            <SurfaceCard key={project.id} tone="accent" className="gap-0">
              <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{project.name}</p>
                    <StatusBadge tone={statusTone[project.status]}>{project.status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {relatedDeal ? `From deal: ${relatedDeal.title}` : "Linked to a won deal"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdvanceStatus(project)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/35 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background/60"
                  disabled={isSaving}
                >
                  <ArrowRight className="size-3.5" />
                  Advance
                </button>
              </div>

              <div className="space-y-3 px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/35 px-3 py-2 transition-all duration-200 hover:border-primary/15 hover:shadow-sm">
                    <p className="text-xs text-muted-foreground">Kickoff</p>
                    <p className="text-sm font-medium text-foreground">
                      {project.kickoff_date || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/35 px-3 py-2 transition-all duration-200 hover:border-primary/15 hover:shadow-sm">
                    <p className="text-xs text-muted-foreground">Target End</p>
                    <p className="text-sm font-medium text-foreground">
                      {project.target_end_date || "Not set"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {project.notes ||
                    "No project notes yet. Add milestones, deliverables, and owner actions."}
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-success/18 bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
                  <CheckCircle2 className="size-3.5" />
                  Deal-to-project flow linked
                </div>
              </div>
            </SurfaceCard>
          );
        })}
      </div>
    </div>
  );
}

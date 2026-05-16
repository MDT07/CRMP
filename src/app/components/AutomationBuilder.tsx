import { useState } from "react";
import {
  Calendar,
  Clock,
  Copy,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// Types
interface WorkflowNode {
  id: string;
  type: "trigger" | "condition" | "action" | "delay";
  position: { x: number; y: number };
  data: TriggerNodeData | ConditionNodeData | ActionNodeData | DelayNodeData;
}

interface TriggerNodeData {
  triggerType: "deal_stage_change" | "task_created" | "email_received" | "no_activity" | "scheduled";
  config: Record<string, unknown>;
}

interface ConditionNodeData {
  conditionType: "deal_value" | "contact_tag" | "days_since" | "probability";
  operator: "equals" | "greater_than" | "less_than" | "contains";
  value: string | number;
}

interface ActionNodeData {
  actionType: "send_email" | "create_task" | "update_deal" | "add_tag" | "notify_user" | "webhook";
  config: Record<string, unknown>;
}

interface DelayNodeData {
  delayType: "minutes" | "hours" | "days";
  amount: number;
}

interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "draft";
  triggerCount: number;
  lastTriggered?: string;
  nodes: WorkflowNode[];
  createdAt: string;
}

// Mock workflows
const mockWorkflows: AutomationWorkflow[] = [
  {
    id: "1",
    name: "New Lead Welcome Sequence",
    description: "Automatically send welcome email and create follow-up task when new lead is created",
    status: "active",
    triggerCount: 156,
    lastTriggered: "2 hours ago",
    createdAt: "2024-01-15",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 100, y: 100 },
        data: { triggerType: "deal_stage_change", config: { stage: "lead" } },
      },
      {
        id: "action-1",
        type: "action",
        position: { x: 100, y: 200 },
        data: { actionType: "send_email", config: { template: "welcome" } },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 100, y: 300 },
        data: { delayType: "days", amount: 2 },
      },
      {
        id: "action-2",
        type: "action",
        position: { x: 100, y: 400 },
        data: { actionType: "create_task", config: { title: "Follow up with new lead" } },
      },
    ],
  },
  {
    id: "2",
    name: "High-Value Deal Alert",
    description: "Notify sales manager when deal value exceeds $50,000 and probability is above 70%",
    status: "active",
    triggerCount: 23,
    lastTriggered: "1 day ago",
    createdAt: "2024-02-01",
    nodes: [],
  },
  {
    id: "3",
    name: "No Activity Follow-up",
    description: "Send reminder email if no activity for 7 days in negotiation stage",
    status: "paused",
    triggerCount: 89,
    lastTriggered: "3 days ago",
    createdAt: "2024-01-20",
    nodes: [],
  },
  {
    id: "4",
    name: "Proposal to Contract",
    description: "Auto-create contract review task when deal moves to proposal stage",
    status: "draft",
    triggerCount: 0,
    createdAt: "2024-03-10",
    nodes: [],
  },
];

// Component for workflow card
function WorkflowCard({
  workflow,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  workflow: AutomationWorkflow;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const statusColors = {
    active: "bg-success/10 text-success border-success/20",
    paused: "bg-warning/10 text-warning border-warning/20",
    draft: "bg-neutral/10 text-muted-foreground border-border",
  };

  const statusLabels = {
    active: "Active",
    paused: "Paused",
    draft: "Draft",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-[calc(var(--radius)+4px)] border border-border/80 bg-card p-5 transition-all hover:border-primary/20 hover:shadow-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-10 items-center justify-center rounded-xl border ${statusColors[workflow.status]}`}
            >
              <Zap className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{workflow.name}</h3>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[workflow.status]}`}
              >
                {statusLabels[workflow.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDuplicate(workflow.id)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Duplicate"
          >
            <Copy className="size-4" />
          </button>
          <button
            onClick={() => onEdit(workflow.id)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Edit"
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={() => onDelete(workflow.id)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-muted-foreground">{workflow.description}</p>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Play className="size-3.5" />
          <span>Triggered {workflow.triggerCount} times</span>
        </div>
        {workflow.lastTriggered && (
          <div className="flex items-center gap-1">
            <Clock className="size-3.5" />
            <span>Last run {workflow.lastTriggered}</span>
          </div>
        )}
      </div>

      {/* Toggle Switch */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
        <span className="text-xs text-muted-foreground">Created {workflow.createdAt}</span>
        <button
          onClick={() => onToggle(workflow.id)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            workflow.status === "active" ? "bg-success" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
              workflow.status === "active" ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </motion.div>
  );
}

// Main Automation Builder Component
export function AutomationBuilder() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(mockWorkflows);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "draft">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");

  // Filter workflows
  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || workflow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: workflows.length,
    active: workflows.filter((w) => w.status === "active").length,
    paused: workflows.filter((w) => w.status === "paused").length,
    draft: workflows.filter((w) => w.status === "draft").length,
    totalTriggers: workflows.reduce((sum, w) => sum + w.triggerCount, 0),
  };

  // Handlers
  const handleToggle = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const newStatus = w.status === "active" ? "paused" : "active";
          toast.success(`Workflow ${newStatus === "active" ? "activated" : "paused"}`);
          return { ...w, status: newStatus };
        }
        return w;
      })
    );
  };

  const handleEdit = (_id: string) => {
    toast.info("Opening workflow editor...");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this workflow?")) {
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      toast.success("Workflow deleted");
    }
  };

  const handleDuplicate = (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (workflow) {
      const newWorkflow: AutomationWorkflow = {
        ...workflow,
        id: `new-${Date.now()}`,
        name: `${workflow.name} (Copy)`,
        status: "draft",
        triggerCount: 0,
        lastTriggered: undefined,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setWorkflows((prev) => [...prev, newWorkflow]);
      toast.success("Workflow duplicated");
    }
  };

  const handleCreateWorkflow = () => {
    if (!newWorkflowName.trim()) return;

    const newWorkflow: AutomationWorkflow = {
      id: `new-${Date.now()}`,
      name: newWorkflowName,
      description: "New automation workflow",
      status: "draft",
      triggerCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      nodes: [],
    };

    setWorkflows((prev) => [...prev, newWorkflow]);
    setNewWorkflowName("");
    setIsCreating(false);
    toast.success("New workflow created");
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflow Automation</h1>
          <p className="text-sm text-muted-foreground">Build automated workflows to streamline your sales process</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Create Workflow
        </button>
      </div>

      {/* Preview Mode Banner */}
      <div className="rounded-lg border border-info/20 bg-info/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-info">
          <span className="flex size-2 rounded-full bg-info" />
          <span className="font-medium">Preview Mode</span>
          <span className="text-muted-foreground">— Showing sample workflow data</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Workflows", value: stats.total, icon: Zap, color: "text-primary" },
          { label: "Active", value: stats.active, icon: Play, color: "text-success" },
          { label: "Paused", value: stats.paused, icon: RefreshCw, color: "text-warning" },
          { label: "Drafts", value: stats.draft, icon: Calendar, color: "text-muted-foreground" },
          { label: "Total Triggers", value: stats.totalTriggers, icon: Sparkles, color: "text-info" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <stat.icon className={`size-4 ${stat.color}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase">{stat.label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="w-full rounded-lg border border-border/80 bg-card px-3 py-2 pl-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <svg
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          {(["all", "active", "paused", "draft"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border/80 bg-card/50 text-muted-foreground hover:border-primary/10 hover:text-foreground"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredWorkflows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Zap className="size-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No workflows found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first workflow to get started"}
          </p>
        </div>
      )}

      {/* Create Workflow Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-border/80 bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Create New Workflow</h2>
            <p className="mt-1 text-sm text-muted-foreground">Give your workflow a name to get started</p>

            <div className="mt-4">
              <label className="text-sm font-medium text-foreground">Workflow Name</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="e.g., New Lead Follow-up"
                className="mt-1 w-full rounded-lg border border-border/80 bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateWorkflow();
                }}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewWorkflowName("");
                }}
                className="rounded-lg border border-border/80 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={!newWorkflowName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Create Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutomationBuilder;

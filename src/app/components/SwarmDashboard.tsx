import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Globe,
  LayoutGrid,
  Play,
  RefreshCw,
  Send,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  emergencyStopSwarm,
  getSwarmStatus,
  initializeSwarm,
  shutdownSwarm,
  submitSwarmTask,
  type SwarmAgentInfo,
  type SwarmStatusResponse,
} from "../lib/crm-api";
import { PageHeader, SurfaceCard } from "./crm-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface SwarmDashboardProps {
  className?: string;
}

export function SwarmDashboard({ className }: SwarmDashboardProps) {
  const [status, setStatus] = useState<SwarmStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setSelectedAgent] = useState<SwarmAgentInfo | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Task submission state
  const [taskType, setTaskType] = useState("analyze_deal_health");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStatus();
    
    if (autoRefresh) {
      const interval = setInterval(loadStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadStatus = async () => {
    try {
      const data = await getSwarmStatus();
      setStatus(data);
    } catch (error) {
      console.error("Failed to load swarm status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      const result = await initializeSwarm();
      toast.success(`Swarm initialized with ${result.agent_count} agents`);
      loadStatus();
    } catch (error) {
      toast.error("Failed to initialize swarm");
    }
  };

  const handleShutdown = async () => {
    try {
      await shutdownSwarm();
      toast.success("Swarm shutdown successfully");
      loadStatus();
    } catch (error) {
      toast.error("Failed to shutdown swarm");
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await emergencyStopSwarm();
      toast.success("Emergency stop executed");
      loadStatus();
    } catch (error) {
      toast.error("Emergency stop failed");
    }
  };

  const handleSubmitTask = async () => {
    if (!taskDescription) {
      toast.error("Please enter a task description");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitSwarmTask({
        task_type: taskType,
        description: taskDescription,
        priority: taskPriority as any,
        required_capabilities: getCapabilitiesForTask(taskType),
      });
      
      toast.success(`Task submitted! Execution ID: ${result.execution_id}`);
      setTaskDialogOpen(false);
      setTaskDescription("");
    } catch (error) {
      toast.error("Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  };

  const getCapabilitiesForTask = (type: string): string[] => {
    const capabilityMap: Record<string, string[]> = {
      analyze_deal_health: ["analyze_deal_health"],
      draft_reply: ["draft_reply"],
      create_task: ["create_task"],
      summarize_conversation: ["summarize_conversation"],
      monitor_inbox: ["monitor_inbox"],
      qualify_lead: ["qualify_lead"],
    };
    return capabilityMap[type] || [];
  };

  const getAgentClassColor = (agentClass: string) => {
    const colors: Record<string, string> = {
      sensory: "bg-blue-500",
      analysis: "bg-purple-500",
      action: "bg-green-500",
      coordination: "bg-orange-500",
      meta: "bg-pink-500",
    };
    return colors[agentClass] || "bg-gray-500";
  };

  const getAgentClassIcon = (agentClass: string) => {
    switch (agentClass) {
      case "sensory":
        return <Globe className="h-4 w-4" />;
      case "analysis":
        return <Brain className="h-4 w-4" />;
      case "action":
        return <Zap className="h-4 w-4" />;
      case "coordination":
        return <LayoutGrid className="h-4 w-4" />;
      case "meta":
        return <Activity className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "idle":
        return "bg-green-500";
      case "active":
        return "bg-blue-500";
      case "executing":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Swarm Not Initialized</h3>
        <p className="text-muted-foreground mb-4">
          The agent swarm needs to be initialized before use.
        </p>
        <Button onClick={handleInitialize}>
          <Play className="h-4 w-4 mr-2" />
          Initialize Swarm
        </Button>
      </div>
    );
  }

  const metrics = status.metrics;
  const agents = Object.values(status.agents);

  return (
    <div className={className}>
      <PageHeader
        title="Agent Swarm Dashboard"
        description="Monitor and manage your AI agent swarm"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto" : "Manual"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShutdown}
            >
              <Shield className="h-4 w-4 mr-2" />
              Shutdown
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmergencyStop}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Emergency Stop
            </Button>
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  Submit Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Submit Task to Swarm</DialogTitle>
                  <DialogDescription>
                    The swarm will automatically select the best agents for this task.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Task Type</label>
                    <Select value={taskType} onValueChange={setTaskType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="analyze_deal_health">Analyze Deal Health</SelectItem>
                        <SelectItem value="draft_reply">Draft Email Reply</SelectItem>
                        <SelectItem value="create_task">Create Task</SelectItem>
                        <SelectItem value="summarize_conversation">Summarize Conversation</SelectItem>
                        <SelectItem value="monitor_inbox">Monitor Inbox</SelectItem>
                        <SelectItem value="qualify_lead">Qualify Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      placeholder="Describe what the swarm should do..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select value={taskPriority} onValueChange={setTaskPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="background">Background</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitTask} disabled={submitting}>
                    {submitting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Task
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents ({agents.length})</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SurfaceCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Agents</p>
                  <p className="text-2xl font-bold">{metrics.active_agents}</p>
                </div>
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                  {metrics.idle_agents} idle
                </span>
                <span className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
                  {metrics.executing_agents} busy
                </span>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{(metrics.success_rate * 100).toFixed(1)}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <Progress value={metrics.success_rate * 100} className="mt-2" />
            </SurfaceCard>

            <SurfaceCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Queued Tasks</p>
                  <p className="text-2xl font-bold">{metrics.queued_tasks}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics.completed_tasks_24h} completed in last 24h
              </p>
            </SurfaceCard>

            <SurfaceCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pheromone Trails</p>
                  <p className="text-2xl font-bold">{metrics.pheromone_trails_active}</p>
                </div>
                <Sparkles className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Learning velocity: {metrics.learning_velocity.toFixed(2)}
              </p>
            </SurfaceCard>
          </div>

          {/* Agent Class Distribution */}
          <SurfaceCard>
            <h3 className="text-lg font-medium mb-4">Agent Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {["sensory", "analysis", "action", "coordination", "meta"].map((agentClass) => {
                const count = agents.filter((a) => a.agent_class === agentClass).length;
                return (
                  <div key={agentClass} className="text-center p-4 rounded-lg border">
                    <div className={`w-10 h-10 rounded-full ${getAgentClassColor(agentClass)} mx-auto mb-2 flex items-center justify-center text-white`}>
                      {getAgentClassIcon(agentClass)}
                    </div>
                    <p className="font-medium capitalize">{agentClass}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="agents">
          <SurfaceCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.agent_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{agent.agent_type}</p>
                          <p className="text-xs text-muted-foreground">{agent.agent_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {getAgentClassIcon(agent.agent_class)}
                        <span className="ml-1">{agent.agent_class}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                        <span className="capitalize">{agent.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-green-600">{agent.tasks_completed}</span>
                        {" / "}
                        <span className="text-red-600">{agent.tasks_failed}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={agent.success_rate * 100} className="w-16" />
                        <span className="text-sm">{(agent.success_rate * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(agent)}>
                            <Terminal className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Agent Details: {agent.agent_type}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">ID</p>
                                <p className="font-mono text-sm">{agent.agent_id}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Class</p>
                                <p className="capitalize">{agent.agent_class}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <p className="capitalize">{agent.status}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Confidence</p>
                                <p>{(agent.avg_confidence * 100).toFixed(1)}%</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Capabilities</p>
                              <div className="flex flex-wrap gap-2">
                                {agent.capabilities.map((cap) => (
                                  <Badge key={cap} variant="secondary" className="text-xs">
                                    {cap}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {agent.has_active_task && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p className="text-sm text-yellow-800 flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  Currently executing task
                                </p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SurfaceCard>
              <h3 className="text-lg font-medium mb-4">Performance Metrics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Avg Task Completion Time</span>
                    <span className="font-medium">{metrics.avg_task_completion_time_ms}ms</span>
                  </div>
                  <Progress value={Math.min(100, metrics.avg_task_completion_time_ms / 50)} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Conflict Rate</span>
                    <span className="font-medium">{(metrics.conflict_rate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.conflict_rate * 100} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Learning Velocity</span>
                    <span className="font-medium">{metrics.learning_velocity.toFixed(3)}</span>
                  </div>
                  <Progress value={Math.min(100, metrics.learning_velocity * 100)} />
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <h3 className="text-lg font-medium mb-4">Task Statistics (24h)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{metrics.completed_tasks_24h}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{metrics.failed_tasks_24h}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </SurfaceCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

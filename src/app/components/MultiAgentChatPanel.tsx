import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  chatWithMultiAgent,
  executeWithAgent,
  fetchAvailableAgents,
  fetchMultiAgentStatus,
  queryMultiAgent,
  runMorningBriefing,
  type AgentInfo,
  type MultiAgentChatResponse,
} from "../lib/crm-api";
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  Users,
  BrainCircuit,
  Target,
  BarChart3,
  Mail,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  agentInfo?: {
    id: string;
    role: string;
  };
  suggestedActions?: {
    type: string;
    description: string;
  }[];
  timestamp: Date;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  contact_analyst: <Users className="h-4 w-4" />,
  deal_strategist: <Target className="h-4 w-4" />,
  email_assistant: <Mail className="h-4 w-4" />,
  pipeline_analyst: <BarChart3 className="h-4 w-4" />,
  task_manager: <CheckCircle className="h-4 w-4" />,
  meeting_assistant: <Calendar className="h-4 w-4" />,
  generalist: <BrainCircuit className="h-4 w-4" />,
  coordinator: <Sparkles className="h-4 w-4" />,
};

const AGENT_LABELS: Record<string, string> = {
  contact_analyst: "Contact Analyst",
  deal_strategist: "Deal Strategist",
  email_assistant: "Email Assistant",
  pipeline_analyst: "Pipeline Analyst",
  task_manager: "Task Manager",
  meeting_assistant: "Meeting Assistant",
  generalist: "General Assistant",
  coordinator: "Coordinator",
};

export function MultiAgentChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgents();
    loadStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAgents = async () => {
    try {
      const data = await fetchAvailableAgents();
      setAgents(data);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  const loadStatus = async () => {
    try {
      await fetchMultiAgentStatus();
    } catch (error) {
      console.error("Failed to load status:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response: MultiAgentChatResponse;

      if (selectedAgent === "auto") {
        // Auto-route to best agent
        response = await chatWithMultiAgent(userMessage.content);
      } else {
        // Use specific agent
        const result = await executeWithAgent(selectedAgent, "general_query", {
          query: userMessage.content,
        });
        response = {
          success: result.success,
          message: userMessage.content,
          response: result.response?.response as string,
          agent_used: result.agent,
          suggested_actions: [],
          execution_time_ms: result.execution_time_ms,
        };
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.response || "I'm not sure how to help with that.",
        agentInfo: response.agent_used,
        suggestedActions: response.suggested_actions,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Failed to get response:", error);
      toast.error("Failed to get response from AI agents");
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "Sorry, I'm having trouble connecting to the AI agents. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    setIsLoading(true);
    
    try {
      let response;
      
      switch (action) {
        case "morning_briefing":
          response = await runMorningBriefing();
          break;
        case "pipeline_analysis":
          const pipelineResult = await queryMultiAgent("Analyze my pipeline health");
          response = {
            success: pipelineResult.success,
            workflow_name: "Pipeline Analysis",
            status: "completed",
            results: { analysis: pipelineResult.response },
          };
          break;
        default:
          return;
      }

      const aiMessage: Message = {
        id: Date.now().toString(),
        role: "ai",
        content: JSON.stringify(response, null, 2),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Quick action failed:", error);
      toast.error("Action failed");
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <Card className="flex flex-col h-full border-0 shadow-none">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Multi-Agent Assistant</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Beta
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Auto-Route
                  </div>
                </SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.agent_id} value={agent.agent_id}>
                    <div className="flex items-center gap-2">
                      {AGENT_ICONS[agent.role] || <Bot className="h-3 w-3" />}
                      {AGENT_LABELS[agent.role] || agent.role}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 text-xs">
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Multi-Agent CRM Assistant</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                I have 7 specialized agents that can help you with contacts, deals, emails, 
                pipeline analysis, tasks, and meetings.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("morning_briefing")}
                disabled={isLoading}
                className="justify-start"
              >
                <Sparkles className="h-3 w-3 mr-2" />
                Morning Briefing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("pipeline_analysis")}
                disabled={isLoading}
                className="justify-start"
              >
                <BarChart3 className="h-3 w-3 mr-2" />
                Pipeline Analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("What tasks should I prioritize today?")}
                className="justify-start"
              >
                <CheckCircle className="h-3 w-3 mr-2" />
                Prioritize Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Analyze my top deals")}
                className="justify-start"
              >
                <Target className="h-3 w-3 mr-2" />
                Analyze Deals
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-2">Available Agents:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {agents.slice(0, 6).map((agent) => (
                  <Badge key={agent.agent_id} variant="outline" className="text-xs">
                    {AGENT_ICONS[agent.role]}
                    <span className="ml-1">{AGENT_LABELS[agent.role] || agent.role}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className={message.role === "ai" ? "bg-primary/10" : ""}>
                    <AvatarFallback>
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        AGENT_ICONS[message.agentInfo?.role || "generalist"] || (
                          <Bot className="h-4 w-4" />
                        )
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`flex flex-col gap-1 max-w-[80%] ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {message.agentInfo && (
                      <Badge variant="secondary" className="text-xs">
                        {AGENT_LABELS[message.agentInfo.role] || message.agentInfo.role}
                      </Badge>
                    )}
                    <div
                      className={`rounded-lg px-4 py-2 text-sm ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {message.suggestedActions.map((action, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs cursor-pointer hover:bg-secondary">
                            {action.description}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Ask anything about your CRM..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {selectedAgent === "auto"
              ? "Questions are automatically routed to the best specialist agent"
              : `Using ${AGENT_LABELS[selectedAgent] || selectedAgent} agent`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  User,
  Zap,
  MessageSquare,
  Brain,
  TrendingUp,
  Clock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  sendNemotronChatMessage,
} from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  mode?: "llm" | "fallback";
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi! How can I assist you with your CRM task today?",
  timestamp: new Date(),
  mode: "llm",
};

export function CRMAgentPage() {
  const { authState, connection, isGuest } = useCrmApp();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canUseAI = authState === "authenticated" && !isGuest && connection !== "loading" && connection !== "fallback";
  const connectionStatus = canUseAI ? "success" : "warning";
  const connectionLabel = canUseAI ? "AI Connected" : "Limited Mode";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    const message = input.trim();
    if (!message) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await sendNemotronChatMessage(message);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
        mode: response.mode as "llm" | "fallback",
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error
          ? `I encountered an issue: ${error.message}`
          : "I'm having trouble connecting right now. Please try again.",
        timestamp: new Date(),
        mode: "fallback",
      };

      setMessages(prev => [...prev, errorMessage]);
      toast.warning("Connection issue", {
        description: "The AI assistant is temporarily unavailable.",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col space-y-4">
      <PageHeader
        title="CRM Agent"
        description="Advanced AI assistant for intelligent CRM operations and strategic guidance"
        meta={
          <>
            <StatusBadge tone={connectionStatus}>
              <Brain className="mr-1 size-3" />
              {connectionLabel}
            </StatusBadge>
            <StatusBadge tone="info">
              <TrendingUp className="mr-1 size-3" />
              2026 AI Model
            </StatusBadge>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="text-xs"
          >
            <RefreshCw className="mr-2 size-3" />
            New Chat
          </Button>
        }
      />

      {/* Main Chat Interface */}
      <SurfaceCard tone="accent" className="flex flex-1 flex-col overflow-hidden p-0">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">CRM Agent</h3>
              <p className="text-xs text-muted-foreground">Powered by advanced 2026 neural networks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-2 items-center justify-center rounded-full bg-green-500">
              <div className="size-1 rounded-full bg-green-300 animate-pulse" />
            </div>
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-4",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
                  <Bot className="size-4" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted/50 border border-border/50"
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
                  <Clock className="size-3" />
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {message.mode && (
                    <span className="flex items-center gap-1">
                      <Zap className="size-3" />
                      {message.mode === "llm" ? "AI" : "Fallback"}
                    </span>
                  )}
                </div>
              </div>

              {message.role === "user" && (
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground flex-shrink-0">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-4 justify-start">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
                <Bot className="size-4" />
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="size-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="size-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="size-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 bg-background/50 p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me about CRM strategy, lead analysis, deal optimization, or anything else..."
                className="min-h-[60px] resize-none pr-12 border-0 bg-muted/30 focus:bg-background transition-colors"
                disabled={isTyping}
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                Press Enter to send
              </div>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isTyping}
              size="lg"
              className="px-6"
            >
              <Send className="size-4" />
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("Analyze my current pipeline performance")}
              className="text-xs h-8"
            >
              <TrendingUp className="mr-1 size-3" />
              Pipeline Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("Help me draft an email to a prospect")}
              className="text-xs h-8"
            >
              <MessageSquare className="mr-1 size-3" />
              Email Draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("What are my top priority actions today?")}
              className="text-xs h-8"
            >
              <Sparkles className="mr-1 size-3" />
              Daily Priorities
            </Button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

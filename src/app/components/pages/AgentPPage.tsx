import {
  BarChart3,
  Bot,
  FileText,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  Target,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCrmApp } from "../../providers/CrmProvider";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Привет! Я AgentP — ваш AI-ассистент для CRM.\n\nЯ могу помочь:\n• Проанализировать контакты и сделки\n• Составить письма и follow-up\n• Приоритизировать задачи\n• Дать insights по воронке продаж\n\nВыберите действие слева или напишите мне.",
  timestamp: new Date(),
};

const QUICK_ACTIONS = [
  {
    id: "analyze-deals",
    label: "Анализ сделок",
    description: "Оценка воронки и рекомендации",
    icon: BarChart3,
    prompt: "Проанализируй мои сделки в pipeline и дай рекомендации по приоритетам",
  },
  {
    id: "draft-email",
    label: "Составить письмо",
    description: "Follow-up и outreach",
    icon: Mail,
    prompt: "Помоги составить follow-up письмо для последнего контакта",
  },
  {
    id: "prioritize-tasks",
    label: "Приоритеты",
    description: "Сортировка задач",
    icon: Target,
    prompt: "Проанализируй мои задачи и расставь приоритеты",
  },
  {
    id: "enrich-contact",
    label: "Обогатить контакт",
    description: "Дополнить профиль",
    icon: Sparkles,
    prompt: "Помоги обогатить данные о последнем добавленном контакте",
  },
  {
    id: "pipeline-insight",
    label: "Insights",
    description: "Тренды и прогнозы",
    icon: Zap,
    prompt: "Дай insights по трендам в моей воронке продаж",
  },
  {
    id: "meeting-prep",
    label: "Подготовка",
    description: "К встрече с клиентом",
    icon: FileText,
    prompt: "Подготовь бриф к следующей встрече с клиентом",
  },
];

export function AgentPPage() {
  const { authState, connection, isGuest } = useCrmApp();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canUseAgentP =
    authState === "authenticated" &&
    !isGuest &&
    connection !== "loading" &&
    connection !== "fallback";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setSelectedAction(null);

    setTimeout(() => {
      const responses: Record<string, string> = {
        "analyze-deals":
          "📊 **Анализ воронки продаж**\n\nНа основе ваших данных:\n• 12 сделок в стадии Proposal — фокус здесь даст быстрый результат\n• 3 сделки stalled >14 дней — требуют follow-up\n• Средний чек вырос на 8% по сравнению с прошлым кварталом\n\n**Рекомендация:** Сфокусируйтесь на сделках в Negotiation — вероятность закрытия 65%.",
        "draft-email":
          "✉️ **Draft follow-up email**\n\nSubject: Following up on our conversation\n\nHi [Name],\n\nI hope you're doing well. I wanted to follow up on our recent conversation about [topic].\n\nBased on what we discussed, I believe [solution] could help you achieve [benefit].\n\nWould you be available for a brief call this week to explore this further?\n\nBest regards,",
        "prioritize-tasks":
          "🎯 **Приоритизация задач**\n\nВаши задачи отсортированы по влиянию:\n\n1. **Высокий приоритет:** Follow-up с NovaStar (deal $45K)\n2. **Высокий приоритет:** Подготовка proposal для TechCorp\n3. **Средний приоритет:** Обновление контактных данных\n4. **Низкий приоритет:** Административные задачи\n\nФокус на первых двух даст 80% результата.",
        "enrich-contact":
          "✨ **Обогащение контакта**\n\nДля контакта [Name] найдена дополнительная информация:\n• LinkedIn: Senior VP at TechCorp\n• Последняя активность: просмотрел pricing page 2 дня назад\n• Интересы: AI automation, team productivity\n\n**Рекомендуемый подход:** Акцент на ROI и case studies.",
        "pipeline-insight":
          "⚡ **Insights по pipeline**\n\nТренды за последние 30 дней:\n• Conversion rate: 23% (+3% vs прошлый месяц)\n• Средний цикл сделки: 34 дня (-5 дней)\n• Win rate по сегменту Enterprise: 41%\n\n**Прогноз:** При текущей скорости закроете $180K до конца квартала.",
        "meeting-prep":
          "📋 **Бриф к встрече**\n\n**Клиент:** TechCorp\n**Участники:** [Name], VP Sales\n**Цель:** Презентация enterprise plan\n\n**Ключевые моменты:**\n• Предыдущий контакт: demo 2 недели назад\n• Pain points: slow lead response, manual reporting\n• Budget range: $25-40K annually\n• Decision timeline: end of quarter\n\n**Подготовить:** ROI calculator, 2 case studies, pricing sheet",
      };

      const actionId =
        selectedAction || QUICK_ACTIONS.find((a) => a.prompt === messageText.trim())?.id;
      const responseContent =
        responses[actionId || ""] ||
        `Я получил ваш запрос: "${messageText.trim()}".\n\nПолная интеграция с AI будет доступна в ближайшем обновлении. Сейчас я могу помочь с шаблонными задачами через панель действий слева.`;

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[0]) => {
    setSelectedAction(action.id);
    handleSendMessage(action.prompt);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Left Sidebar — Quick Actions */}
      <div className="flex w-72 flex-col gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">AgentP</p>
              <p className="text-xs text-muted-foreground">
                {canUseAgentP ? "AI Assistant Online" : "Limited mode"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-3">
          <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Быстрые действия
          </p>
          <div className="grid gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  type="button"
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  disabled={isTyping}
                  className={cn(
                    "flex items-start gap-3 rounded-xl p-3 text-left transition-colors",
                    selectedAction === action.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-surface-strong"
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Статус
          </p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Соединение</span>
              <span className={cn(canUseAgentP ? "text-success" : "text-warning")}>
                {canUseAgentP ? "Онлайн" : "Ограничено"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Модель</span>
              <span className="text-foreground">GPT-4.1-mini</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Чат с AgentP</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {messages.length - 1} сообщений
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([WELCOME_MESSAGE]);
              setSelectedAction(null);
            }}
          >
            Очистить
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted"
                  )}
                >
                  {message.content.split("\n").map((line) => (
                    <p key={message.id} className={cn(line.startsWith("•") && "ml-3")}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
                <div className="rounded-2xl bg-surface-muted px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите AgentP о сделках, контактах или задачах..."
              className="min-h-[52px] resize-none rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isTyping}
              className="h-auto shrink-0 rounded-xl px-4"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

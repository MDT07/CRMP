import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Edit3,
  FileText,
  Mail,
  Phone,
  Plus,
  Tag,
  TrendingUp,
  User,
  Zap,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { cn } from "./ui/utils";
import { fetchEmailMessages, type EmailMessage } from "../lib/crm-api";

// Types
interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, unknown>;
  relatedEntity?: {
    type: "deal" | "contact" | "company" | "task";
    id: string;
    name: string;
  };
}

type TimelineEventType =
  | "note"
  | "email"
  | "call"
  | "meeting"
  | "deal_stage_change"
  | "deal_created"
  | "deal_won"
  | "deal_lost"
  | "task_created"
  | "task_completed"
  | "contact_created"
  | "contact_updated"
  | "tag_added"
  | "file_attached"
  | "automation_triggered"
  | "ai_suggestion";

interface TimelineProps {
  entityId: string;
  entityType: "contact" | "company" | "deal";
  className?: string;
}

// Event type configuration
const eventConfig: Record<
  TimelineEventType,
  {
    icon: typeof Activity;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  note: {
    icon: FileText,
    color: "text-info",
    bgColor: "bg-info",
    label: "Note",
  },
  email: {
    icon: Mail,
    color: "text-primary",
    bgColor: "bg-primary",
    label: "Email",
  },
  call: {
    icon: Phone,
    color: "text-success",
    bgColor: "bg-success",
    label: "Call",
  },
  meeting: {
    icon: Calendar,
    color: "text-warning",
    bgColor: "bg-warning",
    label: "Meeting",
  },
  deal_stage_change: {
    icon: TrendingUp,
    color: "text-primary",
    bgColor: "bg-primary",
    label: "Stage Change",
  },
  deal_created: {
    icon: DollarSign,
    color: "text-success",
    bgColor: "bg-success",
    label: "Deal Created",
  },
  deal_won: {
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success",
    label: "Deal Won",
  },
  deal_lost: {
    icon: XCircle,
    color: "text-danger",
    bgColor: "bg-danger",
    label: "Deal Lost",
  },
  task_created: {
    icon: Activity,
    color: "text-info",
    bgColor: "bg-info",
    label: "Task Created",
  },
  task_completed: {
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success",
    label: "Task Completed",
  },
  contact_created: {
    icon: User,
    color: "text-primary",
    bgColor: "bg-primary",
    label: "Contact Created",
  },
  contact_updated: {
    icon: Edit3,
    color: "text-warning",
    bgColor: "bg-warning",
    label: "Contact Updated",
  },
  tag_added: {
    icon: Tag,
    color: "text-info",
    bgColor: "bg-info",
    label: "Tag Added",
  },
  file_attached: {
    icon: FileText,
    color: "text-neutral",
    bgColor: "bg-muted",
    label: "File Attached",
  },
  automation_triggered: {
    icon: Zap,
    color: "text-warning",
    bgColor: "bg-warning",
    label: "Automation",
  },
  ai_suggestion: {
    icon: Bot,
    color: "text-primary",
    bgColor: "bg-primary",
    label: "AI Insight",
  },
};

// Mock data generator
function generateMockEvents(_entityId: string, _entityType: string): TimelineEvent[] {
  const now = new Date();
  const events: TimelineEvent[] = [
    {
      id: "1",
      type: "contact_created",
      title: "Contact created",
      description: "Initial contact record created in CRM",
      timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
    },
    {
      id: "2",
      type: "deal_created",
      title: "Enterprise deal initiated",
      description: "Deal value: $45,000. Expected close: Q2 2024",
      timestamp: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { amount: 45000, probability: 20 },
    },
    {
      id: "3",
      type: "email",
      title: "Initial outreach sent",
      description: "Sent introductory email with product overview and case studies",
      timestamp: new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { direction: "outbound", opened: true },
    },
    {
      id: "4",
      type: "email",
      title: "Response received",
      description: "Interested in scheduling a demo. Asked about integration capabilities.",
      timestamp: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      user: { name: "Contact" },
      metadata: { direction: "inbound" },
    },
    {
      id: "5",
      type: "call",
      title: "Discovery call completed",
      description: "30-minute call. Discussed pain points, timeline, and decision makers.",
      timestamp: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { duration: 30, outcome: "positive" },
    },
    {
      id: "6",
      type: "deal_stage_change",
      title: "Stage updated: Lead → Qualified",
      description: "Contact confirmed budget and timeline. Moving to qualified stage.",
      timestamp: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { from: "lead", to: "qualified", probability: 40 },
    },
    {
      id: "7",
      type: "meeting",
      title: "Product demo scheduled",
      description: "60-minute demo with technical team and decision makers",
      timestamp: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { duration: 60, attendees: 5 },
    },
    {
      id: "8",
      type: "meeting",
      title: "Demo completed successfully",
      description: "Positive feedback. Next step: proposal and pricing discussion.",
      timestamp: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { outcome: "positive", feedback: "excellent" },
    },
    {
      id: "9",
      type: "deal_stage_change",
      title: "Stage updated: Qualified → Proposal",
      description: "Demo successful. Preparing formal proposal.",
      timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { from: "qualified", to: "proposal", probability: 60 },
    },
    {
      id: "10",
      type: "task_created",
      title: "Follow-up task created",
      description: "Send proposal within 48 hours",
      timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { dueDate: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000) },
    },
    {
      id: "11",
      type: "email",
      title: "Proposal sent",
      description: "Sent comprehensive proposal with pricing options and implementation timeline",
      timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { direction: "outbound", opened: true },
    },
    {
      id: "12",
      type: "note",
      title: "Internal note added",
      description: "Contact seems very interested. Mentioned urgency due to current tool limitations.",
      timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
    },
    {
      id: "13",
      type: "call",
      title: "Proposal discussion call",
      description: "Addressed pricing questions. Minor concerns about implementation timeline.",
      timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { duration: 25, outcome: "positive" },
    },
    {
      id: "14",
      type: "deal_stage_change",
      title: "Stage updated: Proposal → Negotiation",
      description: "Moving to negotiation phase. Finalizing contract terms.",
      timestamp: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { from: "proposal", to: "negotiation", probability: 75 },
    },
    {
      id: "15",
      type: "ai_suggestion",
      title: "AI Insight: High win probability",
      description: "Based on engagement patterns and deal velocity, this deal has 85% likelihood to close",
      timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      metadata: { confidence: 0.85, recommendedAction: "Schedule closing call" },
    },
    {
      id: "16",
      type: "automation_triggered",
      title: "Automation: Contract reminder sent",
      description: "Automated follow-up email sent to contact about contract review",
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      metadata: { automationName: "Contract Follow-up", triggeredBy: "stage_change" },
    },
    {
      id: "17",
      type: "task_completed",
      title: "Contract review completed",
      description: "Legal team approved contract with minor revisions",
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
    },
    {
      id: "18",
      type: "email",
      title: "Contract revisions sent",
      description: "Sent updated contract with agreed-upon changes",
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
      metadata: { direction: "outbound", opened: true },
    },
    {
      id: "19",
      type: "note",
      title: "Latest interaction",
      description: "Contact confirmed receipt of revised contract. Expecting signature by EOD tomorrow.",
      timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      user: { name: "Sarah Johnson", avatar: "SJ" },
    },
  ];

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Format timestamp
function formatTimestamp(date: Date): string {
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

// Timeline Event Component
function TimelineEventCard({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const config = eventConfig[event.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex gap-4"
    >
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
      )}

      {/* Icon */}
      <div
        className={cn(
          "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2",
          config.bgColor,
          config.color.replace("text-", "border-"),
          config.color
        )}
      >
        <Icon className="size-5" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-md">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium uppercase tracking-wide", config.color)}>
                  {config.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </div>
              <h4 className="mt-1 text-sm font-semibold text-foreground">{event.title}</h4>
            </div>

            {event.user && (
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {event.user.avatar || event.user.name.charAt(0)}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">{event.user.name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
          )}

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(event.metadata).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>
                  <span>{String(value)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatTimestamp(event.timestamp)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Main Timeline Component
export function Timeline({ entityId, entityType, className }: TimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineEventType | "all">("all");
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");

  // Fetch events including emails
  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      
      try {
        // Fetch mock events
        const mockEvents = generateMockEvents(entityId, entityType);
        
        // Fetch real email events
        let emailEvents: TimelineEvent[] = [];
        try {
          const emailParams: { contact_id?: string; deal_id?: string; limit: number } = { limit: 50 };
          if (entityType === "contact") {
            emailParams.contact_id = entityId;
          } else if (entityType === "deal") {
            emailParams.deal_id = entityId;
          }
          
          const emailResponse = await fetchEmailMessages(emailParams);
          emailEvents = emailResponse.messages.map((email: EmailMessage) => ({
            id: email.id,
            type: "email" as TimelineEventType,
            title: email.subject || "(No subject)",
            description: email.snippet || email.body_text?.substring(0, 150) || "",
            timestamp: new Date(email.received_at || email.sent_at || email.created_at),
            user: { name: email.from_name || email.from_email || "Unknown" },
            metadata: {
              from: email.from_email,
              to: email.to_emails.map((r: { email: string }) => r.email).join(", "),
              is_read: email.is_read,
              has_attachments: email.has_attachments,
            },
          }));
        } catch (emailError) {
          console.log("Could not fetch emails for timeline:", emailError);
        }
        
        // Merge and sort events
        const allEvents = [...mockEvents, ...emailEvents].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        
        setEvents(allEvents);
      } catch (error) {
        console.error("Error fetching timeline events:", error);
        // Fallback to mock events
        const mockEvents = generateMockEvents(entityId, entityType);
        setEvents(mockEvents);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [entityId, entityType]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((event) => event.type === filter);
  }, [events, filter]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};

    filteredEvents.forEach((event) => {
      const dateKey = format(event.timestamp, "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [filteredEvents]);

  // Handle add note
  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const noteEvent: TimelineEvent = {
      id: `new-${Date.now()}`,
      type: "note",
      title: newNoteTitle || "Note added",
      description: newNote,
      timestamp: new Date(),
      user: { name: "You", avatar: "ME" },
    };

    setEvents((prev) => [noteEvent, ...prev]);
    setNewNote("");
    setNewNoteTitle("");
    setIsAddNoteOpen(false);
    toast.success("Note added to timeline");
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Activity Timeline</h3>
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {filteredEvents.length} events
          </span>
        </div>

        <Button size="sm" onClick={() => setIsAddNoteOpen(true)}>
          <Plus className="size-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Preview Mode Indicator */}
      <div className="rounded-lg border border-info bg-info px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-info-foreground">
          <span className="flex size-2 rounded-full bg-info-foreground" />
          <span className="font-medium">Preview Mode</span>
          <span className="text-info-foreground">— Showing sample timeline data</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["all", "note", "email", "call", "meeting", "deal_stage_change"].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type as TimelineEventType | "all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === type
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
            )}
          >
            {type === "all" ? "All Events" : eventConfig[type as TimelineEventType]?.label || type}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {groupedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Activity className="size-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No events yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity will appear here as you interact with this {entityType}
            </p>
          </div>
        ) : (
          groupedEvents.map(([date, dateEvents]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isToday(new Date(date))
                    ? "Today"
                    : isYesterday(new Date(date))
                    ? "Yesterday"
                    : format(new Date(date), "EEEE, MMMM d, yyyy")}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Events */}
              <div className="space-y-4">
                {dateEvents.map((event, index) => (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    isLast={index === dateEvents.length - 1 && date === groupedEvents[groupedEvents.length - 1][0]}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Note Dialog */}
      <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note to the activity timeline for this {entityType}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <Input
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title..."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Note</label>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!newNote.trim()}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Timeline;

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveAiProposal,
  type AIActionProposal,
  createMessage,
  createTask,
  fetchAiProposals,
  fetchCompanies,
  fetchContacts,
  fetchMessages,
  type GroundedEvidenceItem,
  rejectAiProposal,
  sendInboxCopilotMessage,
  type MessageChannel,
} from "../../lib/crm-api";
import {
  formatConversationTime,
  formatRelativeShort,
  getInitials,
} from "../../lib/crm-format";
import { useCrmApp } from "../../providers/CrmProvider";
import { PageHeader, SmartActionButton, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useIsMobile } from "../ui/use-mobile";

type UIChannel = "email" | "chat" | "whatsapp";

type ConversationMessage = {
  id: number | string;
  content: string;
  time: string;
  isMe: boolean;
};

interface ConversationSummary {
  id: string;
  name: string;
  company: string;
  preview: string;
  time: string;
  unread: number;
  avatar: string;
  channel: UIChannel;
  online: boolean;
  subject?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}

const fallbackConversations: ConversationSummary[] = [
  { id: "1", name: "Sarah Mitchell", company: "Nexus Corp", preview: "Can we schedule a call for the final contract review?", time: "2m", unread: 2, avatar: "SM", channel: "email", online: true },
  { id: "2", name: "James Hartwell", company: "TechCorp Inc.", preview: "The proposal looks great. We only have one pricing question.", time: "18m", unread: 1, avatar: "JH", channel: "chat", online: true },
  { id: "3", name: "Lena Vogt", company: "BlueSky Digital", preview: "Thanks for the follow-up. I will bring this to the team tomorrow.", time: "1h", unread: 0, avatar: "LV", channel: "whatsapp", online: false },
  { id: "4", name: "Carlos Mendes", company: "Vertex Solutions", preview: "When is the earliest we can lock the onboarding date?", time: "3h", unread: 0, avatar: "CM", channel: "email", online: false },
  { id: "5", name: "Aisha Patel", company: "NovaStar Ltd", preview: "I reviewed the contract and have two final comments for legal.", time: "1d", unread: 0, avatar: "AP", channel: "chat", online: false },
];

const fallbackMessages: Record<string, ConversationMessage[]> = {
  "1": [
    { id: 1, content: "Hi! I wanted to follow up on the proposal you sent last week.", time: "10:22 AM", isMe: false },
    { id: 2, content: "Thanks for reaching out. I attached the updated version with the enterprise pricing breakdown.", time: "10:25 AM", isMe: true },
    { id: 3, content: "This looks really good. Can we schedule a call to discuss the enterprise tier?", time: "10:28 AM", isMe: false },
    { id: 4, content: "Absolutely. I am available Thursday afternoon or Friday morning. Which works better?", time: "10:31 AM", isMe: true },
    { id: 5, content: "Friday morning works great. Can we also review the final contract language?", time: "10:35 AM", isMe: false },
  ],
  "2": [
    { id: 1, content: "We like the proposal overall and want to move quickly.", time: "9:14 AM", isMe: false },
    { id: 2, content: "Great to hear. Which part should we tighten up first?", time: "9:18 AM", isMe: true },
    { id: 3, content: "Mostly pricing and rollout timing for the second team.", time: "9:22 AM", isMe: false },
  ],
  "3": [
    { id: 1, content: "Thanks for the demo recap. I will share it with leadership tomorrow.", time: "Yesterday", isMe: false },
  ],
  "4": [
    { id: 1, content: "When is the earliest onboarding slot still open?", time: "Yesterday", isMe: false },
    { id: 2, content: "We can likely reserve next Wednesday if we finalize today.", time: "Yesterday", isMe: true },
  ],
  "5": [
    { id: 1, content: "I reviewed the contract and have two final comments for legal.", time: "Yesterday", isMe: false },
  ],
};

const channelIcons = {
  email: Mail,
  chat: MessageCircle,
  whatsapp: Phone,
} as const;

const channelTone = {
  email: "info",
  chat: "success",
  whatsapp: "primary",
} as const;

const channelButtonVariant = {
  email: "info",
  chat: "success",
  whatsapp: "warning",
} as const;

const proposalTone = {
  pending: "warning",
  approved: "info",
  rejected: "neutral",
  executed: "success",
  failed: "warning",
} as const;

function backendToUiChannel(channel: MessageChannel): UIChannel {
  if (channel === "api") {
    return "whatsapp";
  }

  return channel;
}

function uiToBackendChannel(channel: UIChannel): MessageChannel {
  if (channel === "whatsapp") {
    return "api";
  }

  return channel;
}

function addHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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

function buildConversationState(
  messages: Awaited<ReturnType<typeof fetchMessages>>,
  contacts: Awaited<ReturnType<typeof fetchContacts>>,
  companies: Awaited<ReturnType<typeof fetchCompanies>>,
) {
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const grouped = new Map<string, Awaited<ReturnType<typeof fetchMessages>>>();

  [...messages]
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    )
    .forEach((message) => {
      const key = message.contact_id ?? message.deal_id ?? String(message.id);
      const bucket = grouped.get(key) ?? [];
      bucket.push(message);
      grouped.set(key, bucket);
    });

  const threads: Record<string, ConversationMessage[]> = {};
  const conversations = Array.from(grouped.entries())
    .map(([threadId, threadMessages]) => {
      const latest = threadMessages[threadMessages.length - 1];
      const contact = latest.contact_id ? contactMap.get(latest.contact_id) : null;
      const company =
        contact?.company_id ? companyMap.get(contact.company_id)?.name : undefined;

      threads[threadId] = threadMessages.map((message) => ({
        id: message.id,
        content: message.body,
        time: formatConversationTime(message.created_at),
        isMe: message.direction === "outbound",
      }));

      return {
        id: threadId,
        name: contact?.name ?? latest.subject ?? "CRM conversation",
        company: company ?? (latest.deal_id ? "Linked deal" : "Direct thread"),
        preview: latest.body,
        time: formatRelativeShort(latest.created_at),
        unread: threadMessages.filter((message) => message.direction === "inbound").length,
        avatar: getInitials(contact?.name ?? latest.subject ?? "CRMP"),
        channel: backendToUiChannel(latest.channel),
        online: Date.now() - new Date(latest.created_at).getTime() < 2 * 60 * 60 * 1000,
        subject: latest.subject,
        contactId: latest.contact_id,
        dealId: latest.deal_id,
        sortAt: latest.created_at,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.sortAt).getTime() - new Date(left.sortAt).getTime(),
    )
    .map(({ sortAt: _sortAt, ...conversation }) => conversation);

  return { conversations, threads };
}

export function MessagesPage() {
  const isMobile = useIsMobile();
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    setAssistantSelection,
    user,
  } = useCrmApp();
  const guestPreviewMessage =
    "Guest mode is showing demo inbox data so you can explore conversations without registration.";
  const [conversations, setConversations] = useState(fallbackConversations);
  const [selectedId, setSelectedId] = useState(fallbackConversations[0].id);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(fallbackMessages);
  const [channelOverrides, setChannelOverrides] = useState<Record<string, UIChannel>>({});
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview",
  );
  const [threadProposals, setThreadProposals] = useState<AIActionProposal[]>([]);
  const [threadEvidence, setThreadEvidence] = useState<GroundedEvidenceItem[]>([]);
  const [threadTraceId, setThreadTraceId] = useState<string | null>(null);
  const [isDraftingWithAi, setIsDraftingWithAi] = useState(false);
  const [proposalDecisionId, setProposalDecisionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    connection === "fallback"
      ? "Backend connection is unavailable, so the inbox is showing preview data."
      : isGuest
        ? guestPreviewMessage
      : null,
  );
  const sourceTone =
    dataSource === "live" ? "success" : dataSource === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    dataSource === "live"
      ? "Live inbox"
      : dataSource === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest inbox"
          : "Preview inbox";

  const unreadCount = conversations.reduce(
    (sum, conversation) => sum + conversation.unread,
    0,
  );

  const loadInbox = async (preferredConversationId?: string) => {
    const [companyRecords, contactRecords, messageRecords] = await Promise.all([
      fetchCompanies(),
      fetchContacts(),
      fetchMessages(),
    ]);

    const nextState = buildConversationState(
      messageRecords,
      contactRecords,
      companyRecords,
    );

    setConversations(nextState.conversations);
    setMessages(nextState.threads);
    setSelectedId((previous) => {
      const requestedId = preferredConversationId ?? previous;
      return nextState.conversations.some((conversation) => conversation.id === requestedId)
        ? requestedId
        : nextState.conversations[0]?.id ?? "";
    });
    setDataSource("live");
    setError(null);
  };

  useEffect(() => {
    if (!isMobile) {
      setMobileThreadOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (connection === "loading") {
      setDataSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setDataSource("preview");
      setError(
        connection === "fallback"
          ? "Backend connection is unavailable, so the inbox is showing preview data."
          : guestPreviewMessage,
      );
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        await loadInbox();
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        toast.warning("Messages workspace fell back to preview data.");
        setDataSource("preview");
        setError(
          isGuest
            ? guestPreviewMessage
            : "Using preview conversation data because the live inbox could not be loaded.",
        );
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [connection]);

  const filteredConversations = conversations.filter(
    (conversation) =>
      conversation.name.toLowerCase().includes(search.toLowerCase()) ||
      conversation.company.toLowerCase().includes(search.toLowerCase()),
  );

  const activeConversation =
    conversations.find((conversation) => conversation.id === selectedId) ??
    conversations[0];
  const activeMessages = activeConversation ? messages[activeConversation.id] ?? [] : [];
  const activeMessageIds = activeMessages.map((message) => String(message.id));
  const activeMessageIdsKey = activeMessageIds.join(",");
  const activeComposeChannel = activeConversation
    ? channelOverrides[activeConversation.id] ?? activeConversation.channel
    : "email";

  useEffect(() => {
    if (!activeConversation) {
      clearAssistantSelection();
      return;
    }

    setAssistantSelection({
      kind: "inbox-thread",
      dataSource: dataSource === "live" ? "live" : "preview",
      page: "messages",
      threadId: activeConversation.id,
      threadLabel: activeConversation.subject ?? activeConversation.name,
      participantName: activeConversation.name,
      company: activeConversation.company,
      channel: activeConversation.channel,
      subject: activeConversation.subject ?? null,
      contactId: activeConversation.contactId ?? null,
      dealId: activeConversation.dealId ?? null,
      messageIds: activeMessageIds,
    });

    return () => {
      clearAssistantSelection();
    };
  }, [
    activeConversation,
    activeMessageIdsKey,
    clearAssistantSelection,
    dataSource,
    setAssistantSelection,
  ]);

  useEffect(() => {
    if (dataSource !== "live" || !activeConversation) {
      setThreadProposals([]);
      if (dataSource !== "live") {
        setThreadEvidence([]);
        setThreadTraceId(null);
      }
      return;
    }

    setThreadEvidence([]);
    setThreadTraceId(null);

    let cancelled = false;

    const syncProposals = async () => {
      try {
        const proposals = await fetchAiProposals({
          threadId: activeConversation.id,
          limit: 12,
        });
        if (!cancelled) {
          setThreadProposals(proposals);
        }
      } catch {
        if (!cancelled) {
          setThreadProposals([]);
        }
      }
    };

    void syncProposals();

    return () => {
      cancelled = true;
    };
  }, [activeConversation, dataSource]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id ? { ...conversation, unread: 0 } : conversation,
      ),
    );
    if (isMobile) {
      setMobileThreadOpen(true);
    }
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || !activeConversation) return;

    if (dataSource === "live") {
      try {
        await createMessage({
          contact_id: activeConversation.contactId ?? null,
          deal_id: activeConversation.dealId ?? null,
          author_user_id: user?.id ?? null,
          direction: "outbound",
          channel: uiToBackendChannel(activeComposeChannel),
          subject:
            activeComposeChannel === "email"
              ? activeConversation.subject ?? `Follow-up from ${activeConversation.name}`
              : null,
          body: value,
          payload_meta: { source: "messages-page" },
        });

        setInput("");
        await loadInbox(activeConversation.id);
        toast.success("Message queued", {
          description: `Your ${activeComposeChannel} reply to ${activeConversation.name} is ready.`,
        });
      } catch (sendError) {
        // Error handled by toast
        toast.error("Could not send message", {
          description: "The live CRM message could not be created right now.",
        });
      }

      return;
    }

    setMessages((previous) => ({
      ...previous,
      [activeConversation.id]: [
        ...(previous[activeConversation.id] ?? []),
        {
          id: (previous[activeConversation.id]?.length ?? 0) + 1,
          content: value,
          time: "Now",
          isMe: true,
        },
      ],
    }));
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              preview: value,
              time: "Now",
              unread: 0,
              channel: activeComposeChannel,
            }
          : conversation,
      ),
    );
    setInput("");
    toast.success("Message queued", {
      description: `Your ${activeComposeChannel} reply to ${activeConversation.name} is ready.`,
    });
  };

  const handleChannelChange = (channel: UIChannel) => {
    if (!activeConversation) return;

    setChannelOverrides((previous) => ({
      ...previous,
      [activeConversation.id]: channel,
    }));

    if (dataSource !== "live") {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === activeConversation.id ? { ...conversation, channel } : conversation,
        ),
      );
    }

    toast.info("Channel switched", {
      description: `${activeConversation.name} is now set to ${channel}.`,
    });
  };

  const handleAttachment = () => {
    if (!activeConversation) return;

    toast("Attachment ready", {
      description: `Add a file to ${activeConversation.name}'s thread next.`,
    });
  };

  const handleEmoji = () => {
    setInput((previous) => `${previous}${previous ? " " : ""}🙂`);
  };

  const draftReply = async (mode: "reply" | "ai" | "followup") => {
    if (!activeConversation) {
      return;
    }

    if (mode === "ai" && dataSource === "live") {
      setIsDraftingWithAi(true);

      try {
        const response = await sendInboxCopilotMessage({
          prompt:
            "Draft a concise reply for this inbox thread and suggest the next CRM action.",
          thread_id: activeConversation.id,
          message_ids: activeMessageIds,
          contact_id: activeConversation.contactId ?? undefined,
          deal_id: activeConversation.dealId ?? undefined,
          page: "Messages",
          tone: "warm",
        });

        setInput(response.content);
        setThreadEvidence(response.evidence);
        setThreadProposals(response.proposed_actions);
        setThreadTraceId(response.trace_id);

        toast.success("Grounded AI draft ready", {
          description:
            response.proposed_actions.length > 0
              ? `${response.proposed_actions.length} approval-gated action${response.proposed_actions.length === 1 ? "" : "s"} are ready for review.`
              : `The reply was grounded in ${activeConversation.name}'s live thread.`,
        });
      } catch (draftError) {
        // Error handled by toast
        toast.error("AI draft unavailable", {
          description: "The inbox copilot could not build a grounded reply right now.",
        });
      } finally {
        setIsDraftingWithAi(false);
      }

      if (isMobile) {
        setMobileThreadOpen(true);
      }
      return;
    }

    const firstName = activeConversation.name.split(" ")[0] ?? activeConversation.name;
    const nextMessage =
      mode === "ai"
        ? `Hi ${firstName}, thanks for the update. I reviewed the latest thread and recommend we lock the next step today. I can share a concise summary and a proposed timeline if that helps.`
        : mode === "followup"
          ? `Hi ${firstName}, checking back in on this thread. If it helps, I can send a clean recap with next steps and a target date for the follow-up.`
          : `Hi ${firstName}, thanks for the note. I am on it and will send the next update shortly.`;

    setInput(nextMessage);
    if (isMobile) {
      setMobileThreadOpen(true);
    }

    toast.success(mode === "ai" ? "AI draft ready" : "Reply prepared", {
      description:
        mode === "followup"
          ? `A follow-up reply was prepared for ${activeConversation.name}.`
          : `The composer is ready for ${activeConversation.name}.`,
    });
  };

  const handleApproveProposal = async (proposalId: string) => {
    if (!activeConversation) {
      return;
    }

    setProposalDecisionId(proposalId);
    try {
      const response = await approveAiProposal(proposalId);
      setThreadProposals((previous) =>
        previous.map((proposal) =>
          proposal.id === proposalId ? response.proposal : proposal,
        ),
      );
      await loadInbox(activeConversation.id);
      toast.success("AI action approved", {
        description:
          response.execution?.detail ??
          `${response.proposal.title} was executed inside the local CRM.`,
      });
    } catch (decisionError) {
      // Error handled by toast
      toast.error("Could not approve action", {
        description: "The proposal could not be executed right now.",
      });
    } finally {
      setProposalDecisionId(null);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setProposalDecisionId(proposalId);
    try {
      const response = await rejectAiProposal(
        proposalId,
        "Rejected from the inbox thread.",
      );
      setThreadProposals((previous) =>
        previous.map((proposal) =>
          proposal.id === proposalId ? response.proposal : proposal,
        ),
      );
      toast.success("AI action rejected", {
        description: "The proposal was explicitly declined and left unexecuted.",
      });
    } catch (decisionError) {
      // Error handled by toast
      toast.error("Could not reject action", {
        description: "The proposal status could not be updated right now.",
      });
    } finally {
      setProposalDecisionId(null);
    }
  };

  const handleCreateTaskFromThread = async () => {
    if (!activeConversation) {
      return;
    }

    if (dataSource === "live") {
      try {
        await createTask({
          contact_id: activeConversation.contactId ?? null,
          deal_id: activeConversation.dealId ?? null,
          assignee_id: user?.id ?? null,
          title: `Follow up ${activeConversation.name}`,
          description: `Created from the ${activeConversation.channel} thread in Messages.`,
          status: "open",
          due_at: addHours(24),
          source: "automation",
        });
        toast.success("Follow-up task created", {
          description: `${activeConversation.name} is now in the task queue.`,
        });
      } catch (createError) {
        // Error handled by toast
        toast.error("Could not create task", {
          description: "The follow-up task could not be saved right now.",
        });
      }

      return;
    }

    toast("Task captured", {
      description: `A follow-up reminder for ${activeConversation.name} would be created here in the live CRM.`,
    });
  };

  const showList = !isMobile || !mobileThreadOpen;
  const showThread = (!isMobile || mobileThreadOpen) && Boolean(activeConversation);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Messages"
        description="Work through the inbox with the same calm structure you use for pipeline and tasks."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="info">{unreadCount} unread conversations</StatusBadge>
          </>
        }
        actions={
          <SmartActionButton
            label="Reply"
            icon={Send}
            variant={activeConversation ? channelButtonVariant[activeComposeChannel] : "outline"}
            disabled={!activeConversation || isDraftingWithAi}
            onClick={() => {
              void draftReply("reply");
            }}
            items={[
              {
                label: "Generate AI reply",
                description: "Draft a context-aware response using the last message and the current channel.",
                icon: Bot,
                onSelect: () => {
                  void draftReply("ai");
                },
              },
              {
                label: "Queue follow-up sequence",
                description: "Prepare a softer reminder that can be used when the thread goes cold.",
                onSelect: () => {
                  void draftReply("followup");
                },
              },
              {
                label: "Create follow-up task",
                description: "Turn this conversation into a task linked to the contact and deal.",
                onSelect: () => {
                  void handleCreateTaskFromThread();
                },
              },
            ]}
          />
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-4">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <SurfaceCard tone="subtle" className="min-h-[40rem] gap-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col md:flex-row">
          {showList ? (
            <div className="flex min-h-0 flex-col border-b border-border/70 md:w-[22rem] md:border-r md:border-b-0">
              <div className="space-y-4 border-b border-border/70 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Conversation List
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Prioritized by unread activity and deal urgency
                  </p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search conversations..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {filteredConversations.length === 0 ? (
                  <div className="rounded-[calc(var(--radius)+4px)] border border-border/70 bg-background/25 p-4 text-sm text-muted-foreground">
                    No conversations match the current search.
                  </div>
                ) : null}

                {filteredConversations.map((conversation) => {
                  const ChannelIcon = channelIcons[conversation.channel];
                  const active = selectedId === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => selectConversation(conversation.id)}
                    className={`mb-2 w-full rounded-[calc(var(--radius)+4px)] border p-4 text-left transition-colors ${
                        active
                          ? "border-primary/20 bg-primary/15"
                          : "border-border/80 bg-surface-strong/70 hover:border-primary/14 hover:bg-surface-strong"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/14 bg-primary/10 font-metric text-sm font-semibold text-primary">
                            {conversation.avatar}
                          </div>
                          {conversation.online ? (
                            <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-canvas bg-success" />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {conversation.name}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {conversation.time}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge tone={channelTone[conversation.channel]}>
                              <ChannelIcon className="size-3" />
                              {conversation.channel}
                            </StatusBadge>
                            {conversation.unread > 0 ? (
                              <StatusBadge tone="warning">
                                {conversation.unread} unread
                              </StatusBadge>
                            ) : null}
                            <span className="truncate text-xs text-muted-foreground">
                              {conversation.company}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm text-muted-foreground">
                            {conversation.preview}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showThread && activeConversation ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
                {isMobile ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-2xl"
                    onClick={() => setMobileThreadOpen(false)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                ) : null}

                <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/14 bg-primary/10 font-metric text-sm font-semibold text-primary">
                  {activeConversation.avatar}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {activeConversation.name}
                    </p>
                    <StatusBadge tone={activeConversation.online ? "success" : "neutral"}>
                      {activeConversation.online ? "Online" : "Offline"}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activeConversation.company}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(["email", "chat", "whatsapp"] as const).map((channel) => {
                    const Icon = channelIcons[channel];
                    const active = activeComposeChannel === channel;

                    return (
                      <Button
                        key={channel}
                        variant={active ? channelButtonVariant[channel] : "outline"}
                        size="icon"
                        className="rounded-2xl"
                        onClick={() => handleChannelChange(channel)}
                      >
                        <Icon className="size-4" />
                      </Button>
                    );
                  })}
                </div>
              </div>

              {threadEvidence.length > 0 || threadProposals.length > 0 ? (
                <div className="border-b border-border/70 px-4 py-4 sm:px-5">
                  <div className="space-y-3">
                    {threadTraceId ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="info">Grounded thread</StatusBadge>
                        <span className="text-xs text-muted-foreground">
                          Trace {threadTraceId.slice(0, 12)}
                        </span>
                      </div>
                    ) : null}

                    {threadEvidence.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          Evidence
                        </p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {threadEvidence.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-[calc(var(--radius)+2px)] border border-border/80 bg-surface-strong/70 px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {item.title}
                                </p>
                                <StatusBadge tone="info">{item.source}</StatusBadge>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {item.snippet}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {threadProposals.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          Approval-gated actions
                        </p>
                        <div className="space-y-2">
                          {threadProposals.map((proposal) => (
                            <div
                              key={proposal.id}
                              className="rounded-[calc(var(--radius)+2px)] border border-border/80 bg-surface-strong/70 px-3 py-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
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
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {proposal.detail ?? proposal.reasoning ?? "No extra detail."}
                                  </p>
                                  {formatProposalDiff(proposal) ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
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
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                {activeMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-2xl rounded-[calc(var(--radius)+4px)] border px-4 py-3 ${
                        message.isMe
                          ? "border-primary/20 bg-primary/15 text-foreground"
                          : "border-border/80 bg-surface-strong/70 text-foreground"
                      }`}
                    >
                      <p className="text-sm leading-6">{message.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {message.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/70 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-2 rounded-[calc(var(--radius)+4px)] border border-border/80 bg-surface-strong/70 p-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl"
                    onClick={handleAttachment}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleSend();
                      }
                    }}
                    placeholder="Type a message..."
                    className="h-11 border-none bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl"
                    onClick={handleEmoji}
                  >
                    <Smile className="size-4" />
                  </Button>
                  <Button
                    variant={channelButtonVariant[activeComposeChannel]}
                    size="icon"
                    className="rounded-2xl"
                    onClick={() => void handleSend()}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              Select a conversation to open the thread.
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}

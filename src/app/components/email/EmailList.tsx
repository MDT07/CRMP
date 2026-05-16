import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Mail, Paperclip, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  fetchEmailMessages,
  updateEmailMessage,
  type EmailMessage,
} from "../../lib/crm-api";
import { PageHeader, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface EmailListProps {
  contactId?: string;
  dealId?: string;
  accountId?: string;
  className?: string;
}

export function EmailList({
  contactId,
  dealId,
  accountId,
  className,
}: EmailListProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEmails();
  }, [contactId, dealId, accountId]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      console.log("Fetching emails with params:", { contactId, dealId, accountId });
      const response = await fetchEmailMessages({
        contact_id: contactId,
        deal_id: dealId,
        account_id: accountId,
        limit: 50,
      });
      console.log("Email response:", response);
      setEmails(response.messages);
    } catch (error: any) {
      console.error("Error loading emails:", error);
      const errorMessage = error?.message || "Failed to load emails";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEmails();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (email: EmailMessage) => {
    if (email.is_read) return;

    try {
      await updateEmailMessage(email.id, { is_read: true });
      setEmails(
        emails.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
      );
    } catch (error) {
      toast.error("Failed to mark email as read");
      console.error("Error marking email as read:", error);
    }
  };

  const handleEmailClick = (email: EmailMessage) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      handleMarkAsRead(email);
    }
  };

  const formatRecipients = (recipients: { email: string; name?: string | null }[]) => {
    if (recipients.length === 0) return "";
    if (recipients.length === 1) {
      return recipients[0].name || recipients[0].email;
    }
    return `${recipients[0].name || recipients[0].email} +${recipients.length - 1}`;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <SurfaceCard key={i} className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <PageHeader
            title="Emails"
            description={`${emails.length} messages`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {emails.length === 0 ? (
          <SurfaceCard className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No emails found</h3>
            <p className="text-sm text-muted-foreground">
              Connect an email account to see your messages here.
            </p>
          </SurfaceCard>
        ) : (
          emails.map((email) => (
            <SurfaceCard
              key={email.id}
              className={`cursor-pointer p-4 transition-colors hover:bg-muted/50 ${
                !email.is_read ? "border-l-4 border-l-primary" : ""
              }`}
              onClick={() => handleEmailClick(email)}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
                >
                  <span className="text-sm font-semibold text-primary"
                  >
                    {(email.from_name || email.from_email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className={`truncate font-semibold ${
                          !email.is_read ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {email.from_name || email.from_email}
                      </span>
                      {!email.is_read && (
                        <Badge variant="default" className="shrink-0">
                          New
                        </Badge>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {email.received_at
                        ? formatDistanceToNow(new Date(email.received_at), {
                            addSuffix: true,
                          })
                        : ""}
                    </span>
                  </div>

                  <h4
                    className={`mt-1 truncate ${
                      !email.is_read ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {email.subject || "(No subject)"}
                  </h4>

                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {email.snippet || email.body_text?.substring(0, 200) || ""}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>To: {formatRecipients(email.to_emails)}</span>
                    {email.has_attachments && (
                      <Paperclip className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))
        )}
      </div>

      <Dialog
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedEmail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left">
                  {selectedEmail.subject || "(No subject)"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-start gap-4 border-b pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"
                  >
                    <span className="text-sm font-semibold text-primary"
                    >
                      {(selectedEmail.from_name || selectedEmail.from_email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {selectedEmail.from_name || selectedEmail.from_email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedEmail.from_email}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {selectedEmail.received_at
                          ? formatDistanceToNow(new Date(selectedEmail.received_at), {
                              addSuffix: true,
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="w-12 text-muted-foreground">To:</span>
                    <span>
                      {selectedEmail.to_emails
                        .map((r) => r.name || r.email)
                        .join(", ")}
                    </span>
                  </div>

                  {selectedEmail.cc_emails.length > 0 && (
                    <div className="flex gap-2">
                      <span className="w-12 text-muted-foreground">Cc:</span>
                      <span>
                        {selectedEmail.cc_emails
                          .map((r) => r.name || r.email)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {selectedEmail.has_attachments && (
                  <div className="border-y py-4">
                    <p className="mb-2 text-sm font-medium">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((attachment, i) => (
                        <Badge key={i} variant="secondary">
                          <Paperclip className="mr-1 h-3 w-3" />
                          {attachment.filename} (
                          {Math.round(attachment.size / 1024)} KB)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedEmail.body_html ||
                      selectedEmail.body_text?.replace(/\n/g, "<br />") ||
                      "",
                  }}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

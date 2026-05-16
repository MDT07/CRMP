import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmailList } from "../email/EmailList";
import { EmailSettingsSection } from "../email/EmailSettingsSection";
import { PageHeader, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { fetchEmailAccounts, type EmailAccount } from "../../lib/crm-api";

export function EmailInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inbox");

  // Check for OAuth callback params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast.success("Email account connected successfully!");
      // Remove params from URL
      searchParams.delete("success");
      setSearchParams(searchParams);
    }

    if (error) {
      toast.error(`Connection failed: ${error}`);
      searchParams.delete("error");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetchEmailAccounts();
      setAccounts(response.accounts);
    } catch (error) {
      console.error("Error loading email accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasConnectedAccounts = accounts.length > 0;

  return (
    <div className="h-full space-y-6 p-6">
      <PageHeader
        title="Inbox"
        description="View and manage your synced email conversations"
      />

      {!hasConnectedAccounts && !loading ? (
        <SurfaceCard className="p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold">Connect Your Email</h2>
          <p className="mb-6 max-w-md mx-auto text-muted-foreground">
            Connect your email account to sync conversations with your contacts and see them in your CRM timeline.
          </p>
          <Button onClick={() => setActiveTab("settings")}>
            <Plus className="mr-2 h-4 w-4" />
            Connect Email Account
          </Button>
        </SurfaceCard>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-4">
            <EmailList />
          </TabsContent>

          <TabsContent value="sent" className="space-y-4">
            <SurfaceCard className="p-12 text-center">
              <p className="text-muted-foreground">Sent emails will appear here</p>
            </SurfaceCard>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <EmailSettingsSection />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default EmailInboxPage;

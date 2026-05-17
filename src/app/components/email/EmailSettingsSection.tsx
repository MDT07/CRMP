import { Mail, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  connectGmailAccount,
  deleteEmailAccount,
  type EmailAccount,
  fetchEmailAccounts,
  syncEmails,
  updateEmailAccount,
} from "../../lib/crm-api";
import { PageHeader, SurfaceCard } from "../crm-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Switch } from "../ui/switch";

interface EmailSettingsSectionProps {
  className?: string;
}

export function EmailSettingsSection({ className }: EmailSettingsSectionProps) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetchEmailAccounts();
      setAccounts(response.accounts);
    } catch (error) {
      toast.error("Failed to load email accounts");
      console.error("Error loading email accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setConnecting(true);
      const response = await connectGmailAccount();
      // Redirect to Google's OAuth consent screen
      window.location.href = response.auth_url;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initiate Gmail connection";
      toast.error(errorMessage);
      console.error("Error connecting Gmail:", error);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectOutlook = async () => {
    toast.info("Outlook integration coming soon!");
  };

  const handleToggleSync = async (account: EmailAccount) => {
    try {
      const updated = await updateEmailAccount(account.id, {
        sync_enabled: !account.sync_enabled,
      });
      setAccounts(accounts.map((a) => (a.id === account.id ? updated : a)));
      toast.success(
        `Sync ${updated.sync_enabled ? "enabled" : "disabled"} for ${account.email_address}`
      );
    } catch (error) {
      toast.error("Failed to update sync settings");
      console.error("Error updating sync:", error);
    }
  };

  const handleSync = async (account?: EmailAccount) => {
    try {
      setSyncing(true);
      const result = await syncEmails(account?.id);
      toast.success(`Synced ${result.synced} emails`);
      loadAccounts();
    } catch (error) {
      toast.error("Failed to sync emails");
      console.error("Error syncing:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await deleteEmailAccount(accountId);
      setAccounts(accounts.filter((a) => a.id !== accountId));
      toast.success("Email account disconnected");
    } catch (error) {
      toast.error("Failed to disconnect email account");
      console.error("Error deleting account:", error);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "gmail":
        return <Mail className="h-5 w-5 text-red-500" />;
      case "outlook":
        return <Mail className="h-5 w-5 text-blue-500" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case "gmail":
        return "Gmail";
      case "outlook":
        return "Outlook";
      default:
        return provider;
    }
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <PageHeader title="Email Accounts" description="Connect and manage your email accounts" />
        <div className="mt-6 flex items-center justify-center p-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <PageHeader
          title="Email Accounts"
          description="Connect your email accounts to sync conversations with contacts"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSync()}
            disabled={syncing || accounts.length === 0}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button disabled={connecting}>
                <Mail className="mr-2 h-4 w-4" />
                Connect Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Connect Email Account</DialogTitle>
                <DialogDescription>
                  Choose your email provider to connect your account.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <Button
                  variant="outline"
                  className="h-auto justify-start gap-4 p-4"
                  onClick={handleConnectGmail}
                  disabled={connecting}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                    <Mail className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">Gmail</span>
                    <span className="text-sm text-muted-foreground">
                      Connect your Google account
                    </span>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto justify-start gap-4 p-4"
                  onClick={handleConnectOutlook}
                  disabled={connecting}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">Outlook</span>
                    <span className="text-sm text-muted-foreground">
                      Connect your Microsoft account (Coming soon)
                    </span>
                  </div>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {accounts.length === 0 ? (
          <SurfaceCard className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No email accounts connected</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Connect your email account to automatically sync conversations with your contacts.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Connect Email Account</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Connect Email Account</DialogTitle>
                  <DialogDescription>
                    Choose your email provider to connect your account.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-4 p-4"
                    onClick={handleConnectGmail}
                    disabled={connecting}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                      <Mail className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Gmail</span>
                      <span className="text-sm text-muted-foreground">
                        Connect your Google account
                      </span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-4 p-4"
                    onClick={handleConnectOutlook}
                    disabled={true}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Outlook</span>
                      <span className="text-sm text-muted-foreground">
                        Connect your Microsoft account (Coming soon)
                      </span>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </SurfaceCard>
        ) : (
          accounts.map((account) => (
            <SurfaceCard key={account.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {getProviderIcon(account.provider)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{account.email_address}</h4>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {getProviderLabel(account.provider)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Last synced:{" "}
                        {account.last_sync_at
                          ? new Date(account.last_sync_at).toLocaleString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sync</span>
                    <Switch
                      checked={account.sync_enabled}
                      onCheckedChange={() => handleToggleSync(account)}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSync(account)}
                    disabled={syncing || !account.sync_enabled}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Email Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will disconnect {account.email_address} and stop syncing emails. This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteAccount(account.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </SurfaceCard>
          ))
        )}
      </div>
    </div>
  );
}

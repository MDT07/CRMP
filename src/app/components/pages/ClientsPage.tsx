import {
  Bot,
  Building2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import {
  type Company,
  createCompany,
  createContact,
  fetchCompanies,
  fetchContacts,
  fetchDeals,
} from "../../lib/crm-api";
import { formatCurrencyValue, getInitials, titleCase, toAmountNumber } from "../../lib/crm-format";
import { clientDrafts, fallbackClients } from "../../lib/fallback-data";
import { useCrmApp } from "../../providers/CrmProvider";
import {
  PageHeader,
  PageToolbar,
  SmartActionButton,
  StatusBadge,
  SurfaceCard,
  ToolbarGroup,
} from "../crm-ui";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";

type ClientStatusLabel = "Active" | "Lead" | "Customer" | "Inactive";

interface ClientRow {
  id: number | string;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: string;
  status: ClientStatusLabel;
  tag: string;
  starred: boolean;
  avatar: string;
}

const statusTone: Record<
  ClientStatusLabel,
  "success" | "info" | "warning" | "neutral" | "primary"
> = {
  Active: "success",
  Lead: "info",
  Customer: "primary",
  Inactive: "warning",
};

const tagTone: Record<string, "neutral" | "info" | "success" | "warning"> = {
  Enterprise: "neutral",
  SaaS: "info",
  Agency: "success",
  Consulting: "warning",
  Tech: "info",
};

function getStatusLabel(status: string): ClientStatusLabel {
  switch (status) {
    case "active":
      return "Active";
    case "customer":
      return "Customer";
    case "inactive":
      return "Inactive";
    default:
      return "Lead";
  }
}

function parseClientValue(value: string) {
  return Number(value.replace(/[$,]/g, "")) || 0;
}

function buildClientRows(
  contacts: Awaited<ReturnType<typeof fetchContacts>>,
  companies: Awaited<ReturnType<typeof fetchCompanies>>,
  deals: Awaited<ReturnType<typeof fetchDeals>>
) {
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const dealTotals = new Map<string, number>();

  for (const deal of deals) {
    dealTotals.set(
      deal.contact_id,
      (dealTotals.get(deal.contact_id) ?? 0) + toAmountNumber(deal.amount)
    );
  }

  return contacts
    .map((contact) => {
      const company = contact.company_id ? companyMap.get(contact.company_id) : null;
      const status = getStatusLabel(contact.status);
      const tag =
        company?.industry ??
        (typeof contact.extra_data.title === "string" ? contact.extra_data.title : undefined) ??
        contact.tags[0] ??
        "Relationship";

      return {
        id: contact.id,
        name: contact.name,
        company: company?.name ?? "Independent",
        email: contact.email ?? "No email",
        phone: contact.phone ?? "No phone",
        value: formatCurrencyValue(dealTotals.get(contact.id) ?? 0),
        status,
        tag,
        starred: contact.lead_score >= 80 || contact.status === "customer",
        avatar: getInitials(contact.name),
      };
    })
    .sort((left, right) => parseClientValue(right.value) - parseClientValue(left.value));
}

export function ClientsPage() {
  const { clearAssistantSelection, connection, isGuest, setAssistantSelection } = useCrmApp();
  const guestPreviewMessage =
    "Guest mode is showing demo contact data so you can explore the CRM without registration.";
  const [clients, setClients] = useState(fallbackClients);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | ClientStatusLabel>("All");
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(
    connection === "fallback"
      ? "Backend connection is unavailable, so the clients workspace is showing preview data."
      : isGuest
        ? guestPreviewMessage
        : null
  );
  const sourceTone =
    dataSource === "live" ? "success" : dataSource === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    dataSource === "live"
      ? "Live contacts"
      : dataSource === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest contacts"
          : "Preview data";
  const directorySourceLabel =
    dataSource === "live" ? "Synced with CRM" : isGuest ? "Guest data" : "Local preview";

  const loadClients = async () => {
    const [companyRecords, contactRecords, dealRecords] = await Promise.all([
      fetchCompanies(),
      fetchContacts(),
      fetchDeals(),
    ]);

    setCompanies(companyRecords);
    setClients(buildClientRows(contactRecords, companyRecords, dealRecords));
    setDataSource("live");
    setError(null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load function defined below
  useEffect(() => {
    if (connection === "loading") {
      setDataSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setDataSource("preview");
      setError(
        connection === "fallback"
          ? "Backend connection is unavailable, so the clients workspace is showing preview data."
          : guestPreviewMessage
      );
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        await loadClients();
      } catch (_loadError) {
        if (cancelled) {
          return;
        }
        toast.warning("Clients workspace fell back to preview data.");
        setDataSource("preview");
        setError(
          isGuest
            ? guestPreviewMessage
            : "Using preview client data because the live contact records could not be loaded."
        );
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [connection, isGuest]);

  useEffect(() => {
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Clients",
        route: "/clients",
        dataSource,
        selectedEntities: clients.slice(0, 5).map((client) => ({
          entity_type: "contact",
          entity_id: String(client.id),
        })),
        summary: "Client and account relationship context",
      })
    );

    return () => {
      clearAssistantSelection();
    };
  }, [clearAssistantSelection, clients, dataSource, setAssistantSelection]);

  const filtered = clients.filter(
    (client) =>
      (filter === "All" || client.status === filter) &&
      (client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.company.toLowerCase().includes(search.toLowerCase()) ||
        client.tag.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount = clients.filter((client) => client.status === "Active").length;
  const leadCount = clients.filter((client) => client.status === "Lead").length;
  const customerCount = clients.filter((client) => client.status === "Customer").length;
  const totalRelationshipValue = clients.reduce(
    (sum, client) => sum + parseClientValue(client.value),
    0
  );
  const segmentLeaders = useMemo(() => {
    const bucket = new Map<string, number>();

    for (const client of clients) {
      bucket.set(client.tag, (bucket.get(client.tag) ?? 0) + 1);
    }

    return [...bucket.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4);
  }, [clients]);
  const focusClient = filtered[0] ?? clients[0] ?? null;

  const handleAddClient = async () => {
    const template = clientDrafts[clients.length % clientDrafts.length];

    if (dataSource === "live") {
      setIsCreating(true);

      try {
        const existingCompany = companies.find(
          (company) => company.name.toLowerCase() === template.company.toLowerCase()
        );
        const company =
          existingCompany ??
          (await createCompany({
            name: template.company,
            industry: template.tag,
            domain: template.email.split("@")[1],
          }));

        await createContact({
          company_id: company.id,
          name: template.name,
          email: template.email,
          phone: template.phone,
          status: template.status,
          tags: [template.tag.toLowerCase()],
          extra_data: { title: template.tag },
        });

        await loadClients();
        toast.success("Client added", {
          description: `${template.name} from ${template.company} is now in the CRM.`,
        });
      } catch {
        toast.error("Could not add client", {
          description: "The live CRM record could not be created right now.",
        });
      } finally {
        setIsCreating(false);
      }

      return;
    }

    const nextId = Math.max(...clients.map((client) => Number(client.id))) + 1;
    const nextClient: ClientRow = {
      id: nextId,
      name: template.name,
      company: template.company,
      email: template.email,
      phone: template.phone,
      value: "$0",
      status: getStatusLabel(template.status),
      tag: template.tag,
      starred: false,
      avatar: getInitials(template.name),
    };

    setClients((previous) => [nextClient, ...previous]);
    toast.info("Client added", {
      description: `${nextClient.name} from ${nextClient.company} is now in your pipeline.`,
    });
  };

  const handleImportClients = () => {
    toast.info("Import flow ready", {
      description:
        "Next we can wire CSV import, duplicate detection, and field mapping into the live contacts module.",
    });
  };

  const handleAutofillClient = () => {
    toast("Auto-fill prepared", {
      description:
        "CRMP can prefill company, domain, phone, and owner suggestions from a single email or domain.",
    });
  };

  const handleEnrichClient = () => {
    toast.success("AgentP enrichment queued", {
      description:
        "The next contact can be enriched with segment, likely role, and qualification hints.",
    });
  };

  const handlePhoneClick = (phone: string) => {
    if (phone === "No phone") {
      toast.warning("Phone missing", {
        description: "This contact does not have a phone number yet.",
      });
      return;
    }

    toast.success("Call initiated", {
      description: `Dialing ${phone}.`,
    });
    window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
  };

  const handleEmailClick = (email: string) => {
    if (email === "No email") {
      toast.warning("Email missing", {
        description: "This contact does not have an email address yet.",
      });
      return;
    }

    toast.info("Draft opened", {
      description: `Composing a message to ${email}.`,
    });
    window.location.href = `mailto:${email}`;
  };

  const handleMoreOptions = (id: number | string) => {
    const client = clients.find((entry) => entry.id === id);
    if (!client) {
      return;
    }

    toast("Client actions ready", {
      description: `${client.name} is ${client.status.toLowerCase()} with ${client.value} in tracked value.`,
    });
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Contacts management"
        description="Keep the contact directory denser, easier to scan, and ready for enrichment, outreach, and ownership changes."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="info">{clients.length} total records</StatusBadge>
          </>
        }
        actions={
          <SmartActionButton
            label="Add Contact"
            icon={Plus}
            variant="info"
            onClick={() => {
              void handleAddClient();
            }}
            disabled={isCreating}
            items={[
              {
                label: "Import contacts",
                description: "Bring in a CSV and match fields against companies, owners, and tags.",
                onSelect: handleImportClients,
              },
              {
                label: "Auto-fill from domain",
                description:
                  "Create a contact from one email or domain and let CRMP infer the company profile.",
                onSelect: handleAutofillClient,
              },
              {
                label: "Enrich with AgentP",
                description:
                  "Suggest lead score, segment, and next-best action before the contact is saved.",
                icon: Bot,
                onSelect: handleEnrichClient,
              },
            ]}
          />
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-3">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard tone="subtle" className="gap-2.5 p-3">
          <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Relationship value
          </p>
          <p className="font-metric text-xl font-semibold text-foreground">
            {formatCurrencyValue(totalRelationshipValue)}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Revenue currently linked to the visible contact base.
          </p>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-2.5 p-3">
          <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Active relationships
          </p>
          <p className="font-metric text-xl font-semibold text-foreground">{activeCount}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Healthy accounts already moving through conversations and deals.
          </p>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-2.5 p-3">
          <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            New lead pool
          </p>
          <p className="font-metric text-xl font-semibold text-foreground">{leadCount}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Leads ready for enrichment, assignment, and follow-up.
          </p>
        </SurfaceCard>

        <SurfaceCard tone="subtle" className="gap-2.5 p-3">
          <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Customers
          </p>
          <p className="font-metric text-xl font-semibold text-foreground">{customerCount}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Accounts strong enough to support upsell, renewal, and retention motion.
          </p>
        </SurfaceCard>
      </div>

      <PageToolbar>
        <ToolbarGroup className="w-full max-w-xl">
          <div className="relative min-w-[15rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contacts, companies, or tags..."
              className="pl-10"
            />
          </div>
        </ToolbarGroup>

        <ToolbarGroup>
          {(["All", "Active", "Lead", "Customer", "Inactive"] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-[0.72rem] font-semibold transition-colors",
                filter === value
                  ? "border-primary/20 bg-primary/12 text-primary"
                  : "border-border/80 bg-card/70 text-muted-foreground hover:border-primary/12 hover:text-foreground"
              )}
            >
              {value}
            </button>
          ))}
        </ToolbarGroup>
      </PageToolbar>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/75 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Contact directory</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {filtered.length} visible records matched to the current search and filter.
              </p>
            </div>
            <StatusBadge tone={dataSource === "live" ? "success" : isGuest ? "info" : "neutral"}>
              {directorySourceLabel}
            </StatusBadge>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left">
              <thead className="bg-surface-strong/70">
                <tr className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {["Contact", "Company", "Value", "Status", "Tag", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, index) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-t border-border/80 transition-colors hover:bg-primary/12"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-[0.95rem] border border-primary/14 bg-primary/10 font-metric text-sm font-semibold text-primary">
                          {client.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {client.name}
                            </p>
                            {client.starred ? (
                              <Star className="size-3.5 fill-warning text-warning" />
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{client.company}</p>
                      <p className="text-xs text-muted-foreground">{client.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-metric text-sm font-semibold text-foreground">
                      {client.value}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={statusTone[client.status]}>{client.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={tagTone[client.tag] ?? "neutral"}>
                        {titleCase(client.tag)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="success"
                          size="icon"
                          className="rounded-[0.95rem]"
                          onClick={() => handlePhoneClick(client.phone)}
                        >
                          <Phone className="size-4" />
                        </Button>
                        <Button
                          variant="info"
                          size="icon"
                          className="rounded-[0.95rem]"
                          onClick={() => handleEmailClick(client.email)}
                        >
                          <Mail className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-[0.95rem]"
                          onClick={() => handleMoreOptions(client.id)}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 p-3 md:hidden">
            {filtered.map((client, index) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="rounded-[calc(var(--radius)+1px)] border border-border/80 bg-surface-strong/70 p-3 transition-all duration-200 hover:border-primary/15 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[0.95rem] border border-primary/14 bg-primary/10 font-metric text-sm font-semibold text-primary">
                    {client.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{client.name}</p>
                      <StatusBadge tone={statusTone[client.status]}>{client.status}</StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">{client.company}</p>
                    <p className="text-xs text-muted-foreground">{client.email}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={tagTone[client.tag] ?? "neutral"}>
                    {titleCase(client.tag)}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{client.value}</StatusBadge>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    className="rounded-[0.95rem]"
                    onClick={() => handlePhoneClick(client.phone)}
                  >
                    <Phone className="size-4" />
                    Call
                  </Button>
                  <Button
                    variant="info"
                    size="sm"
                    className="rounded-[0.95rem]"
                    onClick={() => handleEmailClick(client.email)}
                  >
                    <Mail className="size-4" />
                    Email
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto rounded-[0.95rem]"
                    onClick={() => handleMoreOptions(client.id)}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-4">
          <SurfaceCard tone="accent" className="gap-3 border-primary/16 p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-primary/12 font-metric text-sm font-semibold text-primary">
                {focusClient?.avatar ?? "CR"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.64rem] font-semibold tracking-[0.18em] text-primary/80 uppercase">
                  Relationship focus
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {focusClient?.name ?? "No visible contact"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {focusClient?.company ?? "Refine filters to surface a contact"}
                </p>
              </div>
            </div>

            {focusClient ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={statusTone[focusClient.status]}>
                    {focusClient.status}
                  </StatusBadge>
                  <StatusBadge tone={tagTone[focusClient.tag] ?? "neutral"}>
                    {titleCase(focusClient.tag)}
                  </StatusBadge>
                  <StatusBadge tone="primary">{focusClient.value}</StatusBadge>
                </div>

                <div className="grid gap-2">
                  <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Building2 className="size-4 text-muted-foreground" />
                      {focusClient.company}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{focusClient.email}</p>
                  </div>
                  <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Phone className="size-4 text-muted-foreground" />
                      {focusClient.phone}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Keep the next touch fast by replying or calling from the same contact card.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1 rounded-[0.95rem]"
                    onClick={() => handlePhoneClick(focusClient.phone)}
                  >
                    <Phone className="size-4" />
                    Call
                  </Button>
                  <Button
                    variant="info"
                    size="sm"
                    className="flex-1 rounded-[0.95rem]"
                    onClick={() => handleEmailClick(focusClient.email)}
                  >
                    <Mail className="size-4" />
                    Email
                  </Button>
                </div>
              </>
            ) : null}
          </SurfaceCard>

          <SurfaceCard tone="subtle" className="gap-3 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Segment mix</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The contact base is distributed across these visible tags right now.
              </p>
            </div>

            <div className="space-y-2">
              {segmentLeaders.map(([tag, count]) => (
                <div
                  key={tag}
                  className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 px-3 py-2.5 transition-all duration-200 hover:border-primary/15 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-[0.85rem] border border-border/80 bg-background text-muted-foreground">
                      <Users className="size-4" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{titleCase(tag)}</p>
                  </div>
                  <StatusBadge tone={tagTone[tag] ?? "neutral"}>{count}</StatusBadge>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="subtle" className="gap-3 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Smart profile actions</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep enrichment and data cleanup close to the contact list instead of hiding them in
                menus.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAutofillClient}
              className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-colors hover:border-primary/18 hover:bg-surface-strong"
            >
              <div className="flex size-9 items-center justify-center rounded-[0.9rem] border border-info/18 bg-info-soft text-info">
                <Building2 className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Auto-fill profiles</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Generate company and owner hints from email or domain.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleEnrichClient}
              className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/70 p-3 text-left transition-colors hover:border-primary/18 hover:bg-surface-strong"
            >
              <div className="flex size-9 items-center justify-center rounded-[0.9rem] border border-primary/18 bg-primary/12 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AgentP enrichment</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Suggest tags, lead score, and next-best action before outreach starts.
                </p>
              </div>
            </button>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Globe2,
  Handshake,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";

import {
  fetchCompanies,
  fetchContacts,
  fetchDeals,
  type Company,
  type Contact,
  type Deal,
} from "../../lib/crm-api";
import { buildPageAssistantSelection } from "../../lib/assistant-hooks";
import { useCrmApp } from "../../providers/CrmProvider";
import { MetricCard, PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";

interface AccountHealth {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  contacts: number;
  champions: number;
  openDeals: number;
  expansionValue: number;
  health: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(value);
}

function toAmount(value: Deal["amount"]) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const previewAccounts: AccountHealth[] = [
  {
    id: "preview-1",
    name: "Northstar Labs",
    domain: "northstarlabs.ai",
    industry: "AI Infrastructure",
    contacts: 26,
    champions: 5,
    openDeals: 4,
    expansionValue: 168000,
    health: 91,
  },
  {
    id: "preview-2",
    name: "Verto Retail Group",
    domain: "vertoretail.com",
    industry: "Retail",
    contacts: 19,
    champions: 3,
    openDeals: 2,
    expansionValue: 94000,
    health: 78,
  },
  {
    id: "preview-3",
    name: "Cloud Harbor",
    domain: "cloudharbor.io",
    industry: "SaaS",
    contacts: 14,
    champions: 2,
    openDeals: 3,
    expansionValue: 126000,
    health: 73,
  },
  {
    id: "preview-4",
    name: "Atlas Manufacturing",
    domain: "atlasmfg.co",
    industry: "Manufacturing",
    contacts: 11,
    champions: 1,
    openDeals: 1,
    expansionValue: 38000,
    health: 61,
  },
];

function buildAccountHealth(
  companies: Company[],
  contacts: Contact[],
  deals: Deal[],
): AccountHealth[] {
  if (!companies.length) {
    return previewAccounts;
  }

  const contactsByCompany = new Map<string, Contact[]>();
  const companyByContact = new Map<string, string>();

  for (const contact of contacts) {
    if (!contact.company_id) {
      continue;
    }

    companyByContact.set(contact.id, contact.company_id);
    const current = contactsByCompany.get(contact.company_id) ?? [];
    current.push(contact);
    contactsByCompany.set(contact.company_id, current);
  }

  const dealsByCompany = new Map<string, Deal[]>();
  for (const deal of deals) {
    const companyId = deal.contact_id ? companyByContact.get(deal.contact_id) : undefined;
    if (!companyId) {
      continue;
    }

    const current = dealsByCompany.get(companyId) ?? [];
    current.push(deal);
    dealsByCompany.set(companyId, current);
  }

  return companies
    .map((company) => {
      const companyContacts = contactsByCompany.get(company.id) ?? [];
      const companyDeals = dealsByCompany.get(company.id) ?? [];
      const openDeals = companyDeals.filter(
        (deal) => deal.pipeline_stage !== "closed_won" && deal.pipeline_stage !== "closed_lost",
      );
      const champions = companyContacts.filter(
        (contact) => contact.status === "active" || contact.status === "customer",
      ).length;
      const expansionValue = openDeals.reduce((sum, deal) => sum + toAmount(deal.amount), 0);
      const health = Math.max(
        46,
        Math.min(
          98,
          52 + champions * 8 + openDeals.length * 7 + Math.min(18, companyContacts.length),
        ),
      );

      return {
        id: company.id,
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        contacts: companyContacts.length,
        champions,
        openDeals: openDeals.length,
        expansionValue,
        health,
      };
    })
    .sort((left, right) => right.expansionValue - left.expansionValue);
}

export function AccountsPage() {
  const {
    clearAssistantSelection,
    connection,
    isGuest,
    setAssistantSelection,
    workspace,
  } = useCrmApp();
  const [accounts, setAccounts] = useState<AccountHealth[]>(previewAccounts);
  const [source, setSource] = useState<"loading" | "live" | "preview">(
    connection === "loading" ? "loading" : "preview",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connection === "loading") {
      setSource("loading");
      return;
    }

    if (connection === "fallback" || connection === "guest") {
      setSource("preview");
      setError(
        connection === "fallback"
          ? "Showing preview account intelligence because backend sync is unavailable."
          : "Guest mode keeps account intelligence in preview.",
      );
      setAccounts(previewAccounts);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const [companies, contacts, deals] = await Promise.all([
          fetchCompanies(),
          fetchContacts(),
          fetchDeals(),
        ]);
        if (cancelled) {
          return;
        }

        setAccounts(buildAccountHealth(companies, contacts, deals));
        setSource("live");
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.warn("Accounts page fell back to preview data.", loadError);
        setSource("preview");
        setError("Using preview account intelligence because live account records failed to load.");
        setAccounts(previewAccounts);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    setAssistantSelection(
      buildPageAssistantSelection({
        page: "Accounts",
        route: "/accounts",
        dataSource: source,
        selectedEntities: accounts.slice(0, 4).map((account) => ({
          entity_type: "company",
          entity_id: String(account.id),
        })),
        summary: "Account health and expansion context",
      }),
    );

    return () => {
      clearAssistantSelection();
    };
  }, [accounts, clearAssistantSelection, setAssistantSelection, source]);

  const sourceTone =
    source === "live" ? "success" : source === "loading" || isGuest ? "info" : "warning";
  const sourceLabel =
    source === "live"
      ? "Live accounts"
      : source === "loading"
        ? "Syncing"
        : isGuest
          ? "Guest accounts"
          : "Preview accounts";

  const trackedAccounts = accounts.length;
  const totalExpansionValue = accounts.reduce((sum, account) => sum + account.expansionValue, 0);
  const totalChampions = accounts.reduce((sum, account) => sum + account.champions, 0);
  const atRiskCount = accounts.filter((account) => account.health < 70).length;
  const highPotential = useMemo(
    () =>
      [...accounts]
        .filter((account) => account.health >= 70)
        .sort((left, right) => right.expansionValue - left.expansionValue)
        .slice(0, 5),
    [accounts],
  );

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Accounts"
        description="Track account health, stakeholder coverage, and expansion momentum from one operating view."
        meta={
          <>
            <StatusBadge tone={sourceTone}>{sourceLabel}</StatusBadge>
            <StatusBadge tone="info">{workspace.stats.companies} companies in workspace</StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline">
              <UserRoundPlus className="size-4" />
              Add stakeholder
            </Button>
            <Button>
              <Building2 className="size-4" />
              New account plan
            </Button>
          </>
        }
      />

      {error ? (
        <SurfaceCard tone="subtle" className="p-3">
          <p className="text-sm text-warning">{error}</p>
        </SurfaceCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tracked accounts"
          value={String(trackedAccounts)}
          delta={`${highPotential.length} expansion-ready`}
          icon={Building2}
          tone="info"
        />
        <MetricCard
          label="Expansion pipeline"
          value={formatCurrency(totalExpansionValue)}
          delta="Open opportunities across existing accounts"
          icon={ArrowUpRight}
          tone="primary"
        />
        <MetricCard
          label="Executive champions"
          value={String(totalChampions)}
          delta="Mapped stakeholders across active accounts"
          icon={Handshake}
          tone="success"
        />
        <MetricCard
          label="At-risk accounts"
          value={String(atRiskCount)}
          delta="Accounts needing a save plan this week"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(20rem,0.9fr)]">
        <SurfaceCard tone="accent" className="gap-0 overflow-hidden">
          <div className="border-b border-border/75 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Account health board</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Health combines relationship depth, active deal movement, and champion coverage.
            </p>
          </div>
          <div className="space-y-2.5 p-3">
            {accounts.slice(0, 8).map((account) => (
              <div
                key={account.id}
                className="rounded-[calc(var(--radius)-1px)] border border-border/80 bg-card px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
                      <StatusBadge tone={account.health >= 75 ? "success" : "warning"}>
                        Health {account.health}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.industry ?? "General"} · {account.domain ?? "No domain linked"}
                    </p>
                  </div>
                  <StatusBadge tone="primary">{formatCurrency(account.expansionValue)}</StatusBadge>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Contacts
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{account.contacts}</p>
                  </div>
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Champions
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{account.champions}</p>
                  </div>
                  <div className="rounded-[calc(var(--radius)-5px)] border border-border/70 bg-muted px-2.5 py-2">
                    <p className="text-[0.64rem] tracking-[0.16em] text-muted-foreground uppercase">
                      Open deals
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{account.openDeals}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-4">
          <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
            <div className="border-b border-border/75 px-4 py-3.5">
              <p className="text-sm font-semibold text-foreground">Expansion queue</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Highest-upside accounts by open value and relationship strength.
              </p>
            </div>
            <div className="space-y-2.5 p-3">
              {highPotential.map((account) => (
                <div
                  key={`potential-${account.id}`}
                  className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-surface-strong/65 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{account.name}</p>
                    <StatusBadge tone="primary">{formatCurrency(account.expansionValue)}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {account.openDeals} open deals · {account.champions} champions mapped
                  </p>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="subtle" className="gap-0 overflow-hidden">
            <div className="border-b border-border/75 px-4 py-3.5">
              <p className="text-sm font-semibold text-foreground">Coverage actions</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Moves that tighten account retention and reduce silent churn risk.
              </p>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card px-3 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success" />
                  <p className="text-sm font-semibold text-foreground">Renewal safety net</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Trigger multi-threading when a renewal account has fewer than two active champions.
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card px-3 py-3">
                <div className="flex items-center gap-2">
                  <Globe2 className="size-4 text-info" />
                  <p className="text-sm font-semibold text-foreground">Account map refresh</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Keep org charts and stakeholder influence maps fresh before QBR preparation.
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

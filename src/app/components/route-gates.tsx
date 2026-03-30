import { Navigate, Outlet, useLocation } from "react-router";

import { useCrmApp } from "../providers/CrmProvider";
import { BrandLockup } from "./Brand";
import { StatusBadge } from "./crm-ui";

function AppSplash({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 crm-shell-bg" />
      <div className="pointer-events-none absolute inset-0 opacity-20 crm-grid-bg" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-[calc(var(--radius)+14px)] border border-border bg-surface-strong/70 p-8 shadow-[var(--shadow-elevated)]">
          <div className="flex flex-wrap items-center gap-3">
            <BrandLockup subtitle="Revenue, relationships, and communication in one command center" />
            <StatusBadge tone="info">Preparing workspace</StatusBadge>
          </div>
          <div className="mt-10 space-y-3">
            <h1 className="max-w-lg text-balance">{title}</h1>
            <p className="max-w-xl text-base text-muted-foreground">{detail}</p>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <span className="inline-flex size-3 rounded-full bg-primary shadow-[0_0_0_10px_rgba(0,166,251,0.12)]" />
            <p className="text-sm text-muted-foreground">
              Syncing CRM context, workspace analytics, and account access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProtectedCrmRoute() {
  const location = useLocation();
  const { authState, connection, isLoading } = useCrmApp();

  if (isLoading) {
    return (
      <AppSplash
        title="Loading CRMP by EmirCo"
        detail="Pulling together your workspace, chart data, and account access."
      />
    );
  }

  if (
    connection === "fallback" ||
    connection === "guest" ||
    authState === "authenticated" ||
    authState === "guest"
  ) {
    return <Outlet />;
  }

  return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
}

export function AuthRoute() {
  const { authState, isLoading } = useCrmApp();

  if (isLoading) {
    return (
      <AppSplash
        title="Preparing the CRM entry flow"
        detail="Checking the backend and restoring your workspace session if one already exists."
      />
    );
  }

  // Keep /auth available in guest mode so demo users can upgrade into
  // a real workspace without being bounced back to the dashboard.
  if (authState === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

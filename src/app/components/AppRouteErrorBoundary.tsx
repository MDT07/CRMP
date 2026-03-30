import { AlertTriangle, ArrowLeft, Home, LogIn, LogOut, RefreshCw } from "lucide-react";
import { Link, isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { useCrmApp } from "../providers/CrmProvider";
import { BrandLockup } from "./Brand";
import { StatusBadge, SurfaceCard } from "./crm-ui";
import { Button } from "./ui/button";

function getErrorCopy(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        status: "404",
        title: "Page not found",
        detail:
          "The link or address does not match an active CRM route. You can jump back into the workspace from here.",
      };
    }

    return {
      status: String(error.status),
      title: error.statusText || "Route error",
      detail:
        typeof error.data === "string" && error.data
          ? error.data
          : "Something went wrong while loading this CRM route.",
    };
  }

  if (error instanceof Error) {
    return {
      status: "Error",
      title: "Something interrupted the workspace",
      detail: error.message || "The CRM route failed to render correctly.",
    };
  }

  return {
    status: "Error",
    title: "Something interrupted the workspace",
    detail: "The CRM route failed to render correctly.",
  };
}

export function AppRouteErrorBoundary() {
  const error = useRouteError();
  const copy = getErrorCopy(error);
  const navigate = useNavigate();
  const { authState, isGuest, signOut } = useCrmApp();

  const handleOpenAuth = async () => {
    if (authState === "authenticated") {
      await signOut();
    }

    navigate("/auth");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 crm-shell-bg" />
      <div className="pointer-events-none absolute inset-0 opacity-20 crm-grid-bg" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <SurfaceCard tone="accent" className="w-full max-w-2xl gap-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <BrandLockup subtitle="Revenue operating system" />
            <StatusBadge tone={copy.status === "404" ? "warning" : "danger"}>
              {copy.status}
            </StatusBadge>
          </div>

          <div className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] border border-warning/18 bg-warning-soft text-warning">
              <AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-foreground">{copy.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{copy.detail}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/">
                <Home className="size-4" />
                Go to dashboard
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void handleOpenAuth()}>
              {authState === "authenticated" ? (
                <LogOut className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
              {authState === "authenticated"
                ? "Switch account"
                : isGuest
                  ? "Sign in"
                  : "Open auth"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.history.back();
              }}
            >
              <ArrowLeft className="size-4" />
              Go back
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.reload();
              }}
            >
              <RefreshCw className="size-4" />
              Reload
            </Button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

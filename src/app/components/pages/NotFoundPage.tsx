import { Compass, Home, LogIn, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useCrmApp } from "../../providers/CrmProvider";
import { PageHeader, StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();
  const { authState, isGuest, signOut } = useCrmApp();

  const handleSwitchAccount = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Page not found"
        description="That address is not part of the current CRM workspace. You can jump back to a live section below."
        meta={<StatusBadge tone="warning">404 route</StatusBadge>}
        actions={
          <>
            <Button asChild>
              <Link to="/">
                <Home className="size-4" />
                Dashboard
              </Link>
            </Button>
            {authState === "authenticated" ? (
              <Button variant="outline" onClick={() => void handleSwitchAccount()}>
                <LogOut className="size-4" />
                Switch account
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/auth">
                  <LogIn className="size-4" />
                  {isGuest ? "Sign in" : "Auth"}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <SurfaceCard tone="accent" className="gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-[calc(var(--radius)-3px)] border border-warning/18 bg-warning-soft text-warning">
            <Compass className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              The route does not match an active CRM view
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              This usually happens when an old link, manual URL, or stale redirect points to a page
              that does not exist anymore.
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Button variant="outline" asChild className="justify-start">
            <Link to="/">Growth overview</Link>
          </Button>
          <Button variant="outline" asChild className="justify-start">
            <Link to="/clients">Contacts</Link>
          </Button>
          <Button variant="outline" asChild className="justify-start">
            <Link to="/pipeline">Deals</Link>
          </Button>
        </div>
      </SurfaceCard>
    </div>
  );
}

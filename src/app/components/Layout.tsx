import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AgentPPanel } from "./AgentPPanel";
import { PageTransition } from "./animations/page-transition";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useIsMobile } from "./ui/use-mobile";
import { cn } from "./ui/utils";

export function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  void useLocation();

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={cn("relative h-screen overflow-hidden bg-background text-foreground flex")}>
      <div className="pointer-events-none absolute inset-0 crm-shell-bg" />
      <div className="pointer-events-none absolute inset-0 opacity-30 crm-grid-bg [mask-image:linear-gradient(180deg,rgba(0,0,0,0.8),transparent_82%)]" />

      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onOpenNavigation={() => setMobileNavOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-3 py-2 sm:px-4 lg:px-5">
            <PageTransition mode="slideUp">
              <Outlet />
            </PageTransition>
          </div>
        </main>

        {/* Floating AgentP Button */}
        <AgentPFloatingButton />
      </div>
    </div>
  );
}

function AgentPFloatingButton() {
  const [open, setOpen] = useState(false);

  return <AgentPPanel open={open} onOpenChange={setOpen} />;
}

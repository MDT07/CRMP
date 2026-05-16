import { useEffect, useState } from "react";
import { Outlet } from "react-router";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useIsMobile } from "./ui/use-mobile";
import { cn } from "./ui/utils";

export function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-background text-foreground",
      )}
    >
      <div className="pointer-events-none absolute inset-0 crm-shell-bg" />
      <div className="pointer-events-none absolute inset-0 opacity-30 crm-grid-bg [mask-image:linear-gradient(180deg,rgba(0,0,0,0.8),transparent_82%)]" />

      <div className="relative flex min-h-screen">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
        />

        <div className="flex min-h-screen min-w-0 flex-1">
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <TopBar
              onOpenNavigation={() => setMobileNavOpen(true)}
            />

            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1560px] px-3 py-3 sm:px-4 lg:px-5 xl:px-6">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

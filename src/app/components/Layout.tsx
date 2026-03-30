import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { motion } from "motion/react";

import { AIAssistantPanel } from "./AIAssistantPanel";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "./ui/sheet";
import { useIsMobile } from "./ui/use-mobile";
import { cn } from "./ui/utils";

const AI_RAIL_STORAGE_KEY = "crmp.ai.rail.collapsed";
const AI_DOCK_WIDTH_STORAGE_KEY = "crmp.ai.dock.width";
const AI_DOCK_DEFAULT_WIDTH = 372;
const AI_DOCK_MIN_WIDTH = 320;
const AI_DOCK_MAX_WIDTH = 520;
const AI_DOCK_COLLAPSED_WIDTH = 56;
const AI_DOCK_LAYOUT_MIN_VIEWPORT = 1280;
const APP_SIDEBAR_WIDTH = 232;
const APP_MAIN_MIN_WIDTH = 1080;

function clampDockWidth(value: number) {
  return Math.min(AI_DOCK_MAX_WIDTH, Math.max(AI_DOCK_MIN_WIDTH, value));
}

function shouldUsePersistentRail(
  viewportWidth: number,
  dockWidth: number,
) {
  if (viewportWidth < AI_DOCK_LAYOUT_MIN_VIEWPORT) {
    return false;
  }

  const projectedMainWidth = viewportWidth - APP_SIDEBAR_WIDTH - dockWidth;

  return projectedMainWidth >= APP_MAIN_MIN_WIDTH;
}

export function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiRailCollapsed, setAiRailCollapsed] = useState(false);
  const [hasDesktopAIRail, setHasDesktopAIRail] = useState(false);
  const [aiDockWidth, setAiDockWidth] = useState(AI_DOCK_DEFAULT_WIDTH);
  const [isResizingDock, setIsResizingDock] = useState(false);

  const showPersistentAIRail = hasDesktopAIRail;
  const dockVisible = showPersistentAIRail ? !aiRailCollapsed : aiPanelOpen;

  useEffect(() => {
    const storedRailState = window.localStorage.getItem(AI_RAIL_STORAGE_KEY);
    if (storedRailState === "true" || storedRailState === "false") {
      setAiRailCollapsed(storedRailState === "true");
    }

    const storedDockWidth = Number(window.localStorage.getItem(AI_DOCK_WIDTH_STORAGE_KEY));
    if (Number.isFinite(storedDockWidth) && storedDockWidth > 0) {
      setAiDockWidth(clampDockWidth(storedDockWidth));
    }

  }, []);

  useEffect(() => {
    const syncRailState = () => {
      setHasDesktopAIRail(
        shouldUsePersistentRail(window.innerWidth, aiDockWidth),
      );
    };

    syncRailState();
    window.addEventListener("resize", syncRailState);

    return () => window.removeEventListener("resize", syncRailState);
  }, [aiDockWidth]);

  useEffect(() => {
    window.localStorage.setItem(AI_RAIL_STORAGE_KEY, String(aiRailCollapsed));
  }, [aiRailCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(AI_DOCK_WIDTH_STORAGE_KEY, String(aiDockWidth));
  }, [aiDockWidth]);

  useEffect(() => {
    if (!isResizingDock) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      setAiDockWidth(clampDockWidth(window.innerWidth - event.clientX));
    };

    const handleMouseUp = () => {
      setIsResizingDock(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingDock]);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (showPersistentAIRail) {
      setAiPanelOpen(false);
    } else {
      setIsResizingDock(false);
    }
  }, [showPersistentAIRail]);

  const handleToggleAI = () => {
    if (showPersistentAIRail) {
      setAiRailCollapsed((current) => !current);
      return;
    }

    setAiPanelOpen((open) => !open);
  };

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-background text-foreground",
        isResizingDock && "select-none",
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
              onToggleAI={handleToggleAI}
              aiPanelOpen={dockVisible}
              onOpenNavigation={() => setMobileNavOpen(true)}
              showAIToggle
            />

            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1560px] px-3 py-3 sm:px-4 lg:px-5 xl:px-6">
                <Outlet />
              </div>
            </main>
          </div>

          {showPersistentAIRail ? (
            <motion.aside
              initial={false}
              animate={{
                opacity: 1,
                width: aiRailCollapsed ? AI_DOCK_COLLAPSED_WIDTH : aiDockWidth,
              }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative hidden xl:flex xl:min-h-screen xl:shrink-0 xl:border-l xl:border-border/80 xl:bg-canvas-strong xl:shadow-[-18px_0_34px_var(--line-soft)]"
            >
              {!aiRailCollapsed ? (
                <div className="absolute inset-y-0 left-0 z-10 flex w-3 -translate-x-1/2 items-center justify-center">
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize AI dock"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setIsResizingDock(true);
                    }}
                    className="group relative flex h-24 w-3 cursor-col-resize items-center justify-center"
                  >
                    <span className="h-16 w-px rounded-full bg-border transition-colors group-hover:bg-primary/60" />
                    <span className="absolute inset-y-1/2 left-1/2 h-20 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/0 transition-colors group-hover:bg-primary/22" />
                  </div>
                </div>
              ) : null}

              <div className="flex min-h-screen min-w-0 flex-1 overflow-hidden">
                <AIAssistantPanel
                  mode="rail"
                  collapsed={aiRailCollapsed}
                  onToggleCollapsed={() => setAiRailCollapsed((current) => !current)}
                />
              </div>
            </motion.aside>
          ) : null}
        </div>
      </div>

      <Sheet
        open={!showPersistentAIRail && aiPanelOpen}
        onOpenChange={setAiPanelOpen}
      >
        <SheetContent
          side="right"
          className="w-[min(92vw,24rem)] border-l border-border/80 bg-canvas-strong p-0"
        >
          <SheetTitle className="sr-only">AI Assistant</SheetTitle>
          <SheetDescription className="sr-only">
            CRM copilot in a right-side dock
          </SheetDescription>
          <div className="h-full">
            <AIAssistantPanel onClose={() => setAiPanelOpen(false)} mode="rail" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { CrmProvider } from "./providers/CrmProvider";
import { ThemeProvider } from "./providers/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <CrmProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-background px-6">
              <div className="rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium text-muted-foreground shadow-[var(--shadow-panel)]">
                Loading CRMP by EmirCo...
              </div>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
        <Toaster />
      </CrmProvider>
    </ThemeProvider>
  );
}

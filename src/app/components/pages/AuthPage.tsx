import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  MessageSquareMore,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { BrandLockup } from "../Brand";
import { isKnownAppPath } from "../shell-nav";
import { StatusBadge, SurfaceCard } from "../crm-ui";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";
import { CrmApiError } from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";

type AuthMode = "signin" | "register";

const featureHighlights = [
  {
    icon: ChartNoAxesCombined,
    title: "Growth overview",
    description: "Track revenue, pipeline momentum, and risk from one chart-first home page.",
  },
  {
    icon: MessageSquareMore,
    title: "Unified communication",
    description: "Bring email, WhatsApp, Instagram, and follow-ups into one operational inbox.",
  },
  {
    icon: Bot,
    title: "AI copilot rail",
    description: "Keep next-best actions, summaries, and reply drafts pinned to the right side of the app.",
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getErrorMessage(error: unknown) {
  if (error instanceof CrmApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while reaching the CRM backend.";
}

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection, continueAsGuest, error, signIn, signUp, workspace } = useCrmApp();
  const requestedPath =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "";
  const redirectTo = isKnownAppPath(requestedPath) ? requestedPath : "/";

  const [mode, setMode] = useState<AuthMode>("register");
  const [submitting, setSubmitting] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signInValues, setSignInValues] = useState({
    email: "",
    password: "",
  });
  const [signUpValues, setSignUpValues] = useState({
    organizationName: "",
    organizationSlug: "",
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (slugEdited) {
      return;
    }

    setSignUpValues((current) => {
      const generatedSlug = slugify(current.organizationName);
      if (current.organizationSlug === generatedSlug) {
        return current;
      }

      return {
        ...current,
        organizationSlug: generatedSlug,
      };
    });
  }, [slugEdited, signUpValues.organizationName]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await signIn(signInValues);
      toast.success("Signed in", {
        description: "Your live CRM workspace is ready.",
      });
      navigate(redirectTo);
    } catch (authError) {
      setFormError(getErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const payload = {
      ...signUpValues,
      organizationSlug: slugify(signUpValues.organizationSlug || signUpValues.organizationName),
    };

    try {
      await signUp(payload);
      toast.success("Workspace created", {
        description: "Starter CRM data was prepared for your new team space.",
      });
      navigate(redirectTo);
    } catch (authError) {
      setFormError(getErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestMode = async () => {
    setSubmitting(true);
    setFormError(null);

    try {
      await continueAsGuest();
      toast.success("Guest mode enabled", {
        description: "You can explore the CRM without creating an account first.",
      });
      // Force navigation to root and replace history state
      navigate("/", { replace: true });
    } catch (guestError) {
      setFormError(getErrorMessage(guestError));
    } finally {
      setSubmitting(false);
    }
  };

  const showOfflinePreview = connection === "fallback";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 crm-shell-bg" />
      <div className="pointer-events-none absolute inset-0 opacity-20 crm-grid-bg" />

      <div className="relative mx-auto flex min-h-screen max-w-[92rem] items-start px-6 py-10 lg:px-10">
        <div className="grid w-full gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
          <section className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <BrandLockup subtitle="Next-generation CRM system for revenue, relationships, and communication" />
              <StatusBadge tone={showOfflinePreview ? "warning" : "success"}>
                {showOfflinePreview ? "Preview available" : "Backend connected"}
              </StatusBadge>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="text-balance">
                Run CRMP by EmirCo from one confident, chart-first operating system.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                Keep your growth chart visible, your inbox centralized, and your AI
                copilot close without cluttering the workflow.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {featureHighlights.map(({ icon: Icon, title, description }) => (
                <SurfaceCard
                  key={title}
                  tone="accent"
                  className="gap-4 rounded-[calc(var(--radius)+10px)] border-primary/16 p-5"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/18 bg-primary/12 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </SurfaceCard>
              ))}
            </div>

            <SurfaceCard
              tone="subtle"
              className="grid gap-5 rounded-[calc(var(--radius)+12px)] border-border/80 p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
            >
              <div className="space-y-3">
                <StatusBadge tone="primary">Launch stack</StatusBadge>
                <h2>What this step unlocks next</h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  With real sign-in and workspace creation in place, we can keep
                  pushing the CRM toward production modules like inbox sync,
                  workflow automation, and role-based access.
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-[calc(var(--radius)+4px)] border border-border/80 bg-background px-4 py-3">
                  <p className="font-semibold text-foreground">Workspace onboarding</p>
                  <p>Teams start with a branded organization, live user identity, and seeded CRM records.</p>
                </div>
                <div className="rounded-[calc(var(--radius)+4px)] border border-border/80 bg-background px-4 py-3">
                  <p className="font-semibold text-foreground">Secure session flow</p>
                  <p>No more silent dev account generation inside the frontend.</p>
                </div>
              </div>
            </SurfaceCard>
          </section>

          <section>
            <SurfaceCard
              tone="accent"
              className="relative overflow-hidden rounded-[calc(var(--radius)+14px)] border-primary/18 p-6 shadow-[var(--shadow-elevated)]"
            >
              <div className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-primary/12 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-14 -left-12 size-36 rounded-full bg-info-soft blur-2xl" />
              <div className="relative">
              {showOfflinePreview ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <StatusBadge tone="warning">Backend offline</StatusBadge>
                    <h2>Preview the CRM shell while the backend is unavailable</h2>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      Live sign-in is temporarily blocked because the backend cannot be
                      reached. The local preview still lets us keep moving on layout,
                      data flow, and UX.
                    </p>
                  </div>

                  <div className="rounded-[calc(var(--radius)+6px)] border border-border/80 bg-background px-4 py-4 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">{workspace.name}</p>
                    <p className="mt-1">
                      Open the preview workspace to continue shaping the CRM shell, or
                      restart the backend and come back here to sign in live.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="flex-1 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleGuestMode();
                      }}
                      disabled={submitting}
                    >
                      {submitting ? "Entering..." : "Continue as guest"}
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCcw className="size-4" />
                      Retry backend
                    </Button>
                  </div>

                  {error ? (
                    <p className="text-sm text-warning">{error}</p>
                  ) : null}
                  {formError ? (
                    <p className="text-sm text-danger">{formError}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <StatusBadge tone="primary">Workspace access</StatusBadge>
                    <div className="space-y-2">
                      <h2>{mode === "signin" ? "Sign in to your CRM" : "Create a new CRM workspace"}</h2>
                      <p className="text-sm text-muted-foreground sm:text-base">
                        {mode === "signin"
                          ? "Resume your live pipeline, inbox, and AI context."
                          : "Set up a branded workspace and start with seeded CRM data so the product feels alive immediately."}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex rounded-[calc(var(--radius)+4px)] border border-border/80 bg-background p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setFormError(null);
                      }}
                      className={cn(
                        "rounded-[calc(var(--radius)-4px)] px-4 py-2.5 text-sm font-semibold transition-colors",
                        mode === "register"
                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-button)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Create workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setFormError(null);
                      }}
                      className={cn(
                        "rounded-[calc(var(--radius)-4px)] px-4 py-2.5 text-sm font-semibold transition-colors",
                        mode === "signin"
                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-button)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Sign in
                    </button>
                  </div>

                  {error ? (
                    <div className="rounded-[calc(var(--radius)+2px)] border border-info/18 bg-info-soft px-4 py-3 text-sm text-info">
                      {error}
                    </div>
                  ) : null}

                  {formError ? (
                    <div className="rounded-[calc(var(--radius)+2px)] border border-danger/18 bg-danger-soft px-4 py-3 text-sm text-danger">
                      {formError}
                    </div>
                  ) : null}

                  {mode === "signin" ? (
                    <form className="space-y-4" onSubmit={handleSignIn}>
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Work email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          autoComplete="email"
                          value={signInValues.email}
                          onChange={(event) =>
                            setSignInValues((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          placeholder="team@emirco.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          autoComplete="current-password"
                          value={signInValues.password}
                          onChange={(event) =>
                            setSignInValues((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          placeholder="Enter your password"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Signing in..." : "Sign in to workspace"}
                        <ArrowRight className="size-4" />
                      </Button>
                    </form>
                  ) : (
                    <form className="space-y-4" onSubmit={handleSignUp}>
                      <div className="space-y-2">
                        <Label htmlFor="signup-organization">Workspace name</Label>
                        <Input
                          id="signup-organization"
                          type="text"
                          autoComplete="organization"
                          value={signUpValues.organizationName}
                          onChange={(event) =>
                            setSignUpValues((current) => ({
                              ...current,
                              organizationName: event.target.value,
                            }))
                          }
                          placeholder="EmirCo Revenue Ops"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-slug">Workspace slug</Label>
                        <Input
                          id="signup-slug"
                          type="text"
                          value={signUpValues.organizationSlug}
                          onChange={(event) => {
                            setSlugEdited(true);
                            setSignUpValues((current) => ({
                              ...current,
                              organizationSlug: slugify(event.target.value),
                            }));
                          }}
                          placeholder="emirco-revenue-ops"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Your name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          autoComplete="name"
                          value={signUpValues.name}
                          onChange={(event) =>
                            setSignUpValues((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Emir Semenov"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Work email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          value={signUpValues.email}
                          onChange={(event) =>
                            setSignUpValues((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          placeholder="hello@emirco.com"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          autoComplete="new-password"
                          value={signUpValues.password}
                          onChange={(event) =>
                            setSignUpValues((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          placeholder="Create a strong password"
                          required
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Creating workspace..." : "Create workspace"}
                        <ArrowRight className="size-4" />
                      </Button>
                    </form>
                  )}

                  <div className="space-y-3 rounded-[calc(var(--radius)+4px)] border border-border/80 bg-background px-4 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Try the CRM first</p>
                      <p className="text-sm text-muted-foreground">
                        Continue in guest mode without registration and explore the full
                        product shell with demo workspace data.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleGuestMode();
                      }}
                      disabled={submitting}
                    >
                      {submitting ? "Entering..." : "Continue as guest"}
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </div>

                  <div className="rounded-[calc(var(--radius)+4px)] border border-border/80 bg-background px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-success/18 bg-success-soft text-success">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">Starter workspace automation</p>
                        <p>
                          New organizations can be seeded with contacts, deals, messages,
                          and tasks so the dashboard is meaningful from day one.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </SurfaceCard>
          </section>
        </div>
      </div>
    </div>
  );
}

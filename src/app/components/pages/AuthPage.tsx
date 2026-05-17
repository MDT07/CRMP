import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  MessageSquareMore,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { CrmApiError } from "../../lib/crm-api";
import { useCrmApp } from "../../providers/CrmProvider";
import { BrandLockup } from "../Brand";
import { StatusBadge, SurfaceCard } from "../crm-ui";
import { isKnownAppPath } from "../shell-nav";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";

type AuthMode = "signin" | "register";

const featureHighlights = [
  {
    icon: ChartNoAxesCombined,
    title: "Growth Overview",
    description:
      "Track revenue, pipeline momentum, and forecast accuracy from one unified dashboard.",
    color: "primary" as const,
  },
  {
    icon: MessageSquareMore,
    title: "Unified Inbox",
    description: "Email, WhatsApp, Instagram, and live chat — all conversations in one place.",
    color: "info" as const,
  },
  {
    icon: Bot,
    title: "AgentP Assistant",
    description:
      "AgentP-powered insights, smart replies, and next-best actions at your fingertips.",
    color: "accent" as const,
  },
  {
    icon: Zap,
    title: "Smart Automations",
    description: "Workflow rules that trigger follow-ups, task creation, and deal stage updates.",
    color: "success" as const,
  },
  {
    icon: Sparkles,
    title: "Deal Intelligence",
    description: "Predictive scoring and health checks to focus on deals most likely to close.",
    color: "warning" as const,
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Security",
    description: "Role-based access, audit logs, and secure API key management for teams.",
    color: "primary" as const,
  },
];

const colorClasses = {
  primary: "bg-primary-soft text-primary border-primary/20",
  info: "bg-info-soft text-info border-info/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  accent: "bg-accent-soft text-accent border-accent/20",
};

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
    if (slugEdited) return;
    setSignUpValues((current) => {
      const generatedSlug = slugify(current.organizationName);
      if (current.organizationSlug === generatedSlug) return current;
      return { ...current, organizationSlug: generatedSlug };
    });
  }, [slugEdited]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(signInValues);
      toast.success("Signed in", { description: "Your live CRM workspace is ready." });
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
        description: "Explore the CRM without creating an account.",
      });
      navigate("/", { replace: true });
    } catch (guestError) {
      setFormError(getErrorMessage(guestError));
    } finally {
      setSubmitting(false);
    }
  };

  const showOfflinePreview = connection === "fallback";

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-foreground">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[96rem] items-start px-6 py-8 lg:px-12">
        <div className="grid w-full gap-8 xl:grid-cols-[1fr_420px]">
          {/* Left Side - Marketing */}
          <section className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <BrandLockup subtitle="Next-generation CRM for revenue teams" variant="gradient" />
              <StatusBadge tone={showOfflinePreview ? "warning" : "success"} dot>
                {showOfflinePreview ? "Preview mode" : "Backend connected"}
              </StatusBadge>
            </div>

            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
                Run your revenue operation from one intelligent platform.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                CRMP brings together pipeline management, unified communications, and AgentP-powered
                insights — so your team can focus on closing deals.
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureHighlights.map(({ icon: Icon, title, description, color }) => (
                <SurfaceCard
                  key={title}
                  tone="default"
                  padding="md"
                  radius="lg"
                  className="group hover-lift"
                >
                  <div
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl border",
                      colorClasses[color]
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                </SurfaceCard>
              ))}
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-border/40 bg-surface-muted/50 px-6 py-4">
              {[
                { value: "10K+", label: "Active users" },
                { value: "$2.4B", label: "Pipeline managed" },
                { value: "99.9%", label: "Uptime" },
                { value: "4.9", label: "User rating" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Right Side - Auth Form */}
          <section className="xl:sticky xl:top-8">
            <SurfaceCard
              tone="default"
              padding="lg"
              radius="lg"
              className="shadow-[var(--shadow-elevated)]"
            >
              {showOfflinePreview ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <StatusBadge tone="warning" dot>
                      Backend offline
                    </StatusBadge>
                    <h2 className="text-xl font-semibold">Preview the CRM</h2>
                    <p className="text-sm text-muted-foreground">
                      Live sign-in is temporarily unavailable. Explore the CRM with demo data to see
                      how it works for your team.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/40 bg-surface-muted/50 px-4 py-4">
                    <p className="font-semibold text-foreground">{workspace.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Continue with the preview workspace to explore all features.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="flex-1 rounded-xl"
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
                      className="rounded-xl"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCcw className="size-4 mr-1.5" />
                      Retry
                    </Button>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <StatusBadge tone="primary">Workspace access</StatusBadge>
                    <h2 className="text-xl font-semibold">
                      {mode === "signin" ? "Welcome back" : "Create your workspace"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {mode === "signin"
                        ? "Sign in to access your pipeline, inbox, and team data."
                        : "Set up a branded workspace with seeded demo data."}
                    </p>
                  </div>

                  {/* Mode Toggle */}
                  <div className="inline-flex rounded-xl border border-border/40 bg-surface-muted p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setFormError(null);
                      }}
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                        mode === "register"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
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
                        "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                        mode === "signin"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Sign in
                    </button>
                  </div>

                  {/* Errors */}
                  {error && (
                    <div className="rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
                      {error}
                    </div>
                  )}
                  {formError && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                      {formError}
                    </div>
                  )}

                  {/* Forms */}
                  {mode === "signin" ? (
                    <form className="space-y-4" onSubmit={handleSignIn}>
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Work email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          autoComplete="email"
                          value={signInValues.email}
                          onChange={(e) =>
                            setSignInValues((c) => ({ ...c, email: e.target.value }))
                          }
                          placeholder="you@company.com"
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          autoComplete="current-password"
                          value={signInValues.password}
                          onChange={(e) =>
                            setSignInValues((c) => ({ ...c, password: e.target.value }))
                          }
                          placeholder="Enter your password"
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <Button type="submit" className="w-full rounded-xl" disabled={submitting}>
                        {submitting ? "Signing in..." : "Sign in to workspace"}
                        <ArrowRight className="size-4 ml-1.5" />
                      </Button>
                    </form>
                  ) : (
                    <form className="space-y-4" onSubmit={handleSignUp}>
                      <div className="space-y-2">
                        <Label htmlFor="signup-organization">Workspace name</Label>
                        <Input
                          id="signup-organization"
                          type="text"
                          value={signUpValues.organizationName}
                          onChange={(e) =>
                            setSignUpValues((c) => ({ ...c, organizationName: e.target.value }))
                          }
                          placeholder="Acme Inc."
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-slug">Workspace slug</Label>
                        <Input
                          id="signup-slug"
                          type="text"
                          value={signUpValues.organizationSlug}
                          onChange={(e) => {
                            setSlugEdited(true);
                            setSignUpValues((c) => ({
                              ...c,
                              organizationSlug: slugify(e.target.value),
                            }));
                          }}
                          placeholder="acme-inc"
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Your name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          value={signUpValues.name}
                          onChange={(e) => setSignUpValues((c) => ({ ...c, name: e.target.value }))}
                          placeholder="John Doe"
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Work email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          value={signUpValues.email}
                          onChange={(e) =>
                            setSignUpValues((c) => ({ ...c, email: e.target.value }))
                          }
                          placeholder="you@company.com"
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          value={signUpValues.password}
                          onChange={(e) =>
                            setSignUpValues((c) => ({ ...c, password: e.target.value }))
                          }
                          placeholder="Create a strong password"
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <Button type="submit" className="w-full rounded-xl" disabled={submitting}>
                        {submitting ? "Creating..." : "Create workspace"}
                        <ArrowRight className="size-4 ml-1.5" />
                      </Button>
                    </form>
                  )}

                  {/* Guest Mode */}
                  <div className="rounded-xl border border-border/40 bg-surface-muted/30 px-4 py-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Try before you commit</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Explore the full CRM with demo data. No registration required.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleGuestMode();
                      }}
                      disabled={submitting}
                    >
                      {submitting ? "Entering..." : "Continue as guest"}
                      <ArrowRight className="size-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}
            </SurfaceCard>
          </section>
        </div>
      </div>
    </div>
  );
}

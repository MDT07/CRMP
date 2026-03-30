import {
  useCallback,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  CrmApiError,
  bootstrapCurrentWorkspace,
  fetchCrmHealth,
  fetchCurrentWorkspace,
  fetchDashboardOverview,
  loginToCrm,
  logoutFromCrm,
  registerToCrm,
  restoreCrmSession,
  type AuthenticatedUser,
  type CrmSession,
  type LoginPayload,
  type RegistrationPayload,
} from "../lib/crm-api";
import { guestDashboard, guestWorkspace } from "../lib/fallback-data";

export type CrmAuthState = "loading" | "authenticated" | "guest" | "anonymous";
export type CrmConnectionState =
  | "loading"
  | "live"
  | "bootstrapped"
  | "guest"
  | "fallback";
export type AssistantSelection = Record<string, unknown> | null;

interface CrmContextValue {
  authState: CrmAuthState;
  connection: CrmConnectionState;
  dashboard: DashboardOverview;
  workspace: Workspace;
  user: AuthenticatedUser | null;
  error: string | null;
  isLoading: boolean;
  isGuest: boolean;
  refresh: () => Promise<void>;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegistrationPayload) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  assistantSelection: AssistantSelection;
  setAssistantSelection: (selection: AssistantSelection) => void;
  clearAssistantSelection: () => void;
}

const AUTO_BOOTSTRAP = import.meta.env.VITE_CRMP_AUTO_BOOTSTRAP !== "false";
const GUEST_STORAGE_KEY = "crmp.guest.mode";

type CrmState = Omit<
  CrmContextValue,
  | "isLoading"
  | "isGuest"
  | "refresh"
  | "signIn"
  | "signUp"
  | "continueAsGuest"
  | "signOut"
  | "assistantSelection"
  | "setAssistantSelection"
  | "clearAssistantSelection"
>;

const initialState: CrmState = {
  authState: "loading",
  connection: "loading",
  dashboard: guestDashboard,
  workspace: guestWorkspace,
  user: null,
  error: null,
};

const CrmContext = createContext<CrmContextValue | null>(null);

function getFallbackErrorMessage(error: unknown) {
  if (error instanceof CrmApiError) {
    return `Backend responded with ${error.status}, so the app switched to a local CRM preview.`;
  }

  if (error instanceof TypeError) {
    return "Backend connection is unavailable, so the app switched to a local CRM preview.";
  }

  if (error instanceof Error) {
    return `${error.message}. The app is using a local CRM preview for now.`;
  }

  return "The app is using a local CRM preview because the backend could not be reached.";
}

async function loadLiveCrmState(session: CrmSession): Promise<CrmState> {
  let workspace = await fetchCurrentWorkspace();
  let connection: CrmConnectionState = "live";

  if (!workspace.crm_ready && AUTO_BOOTSTRAP) {
    const bootstrapResult = await bootstrapCurrentWorkspace();
    workspace = bootstrapResult.workspace;
    connection = bootstrapResult.seeded ? "bootstrapped" : "live";
  }

  const dashboard = await fetchDashboardOverview();

  return {
    authState: "authenticated",
    connection,
    user: session.user,
    workspace,
    dashboard,
    error: null,
  };
}

function hasStoredGuestSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(GUEST_STORAGE_KEY) === "true";
}

function persistGuestSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GUEST_STORAGE_KEY, "true");
}

function clearGuestSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
}

function buildGuestState(): CrmState {
  return {
    authState: "guest",
    connection: "guest",
    dashboard: guestDashboard,
    workspace: guestWorkspace,
    user: null,
    error: null,
  };
}

async function loadAnonymousState(message?: string | null): Promise<CrmState> {
  await fetchCrmHealth();

  return {
    authState: "anonymous",
    connection: "live",
    dashboard: guestDashboard,
    workspace: guestWorkspace,
    user: null,
    error: message ?? null,
  };
}

function buildFallbackState(error: unknown): CrmState {
  return {
    authState: "anonymous",
    connection: "fallback",
    dashboard: guestDashboard,
    workspace: guestWorkspace,
    user: null,
    error: getFallbackErrorMessage(error),
  };
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmState>(initialState);
  const [assistantSelection, setAssistantSelectionState] =
    useState<AssistantSelection>(null);

  const recoverAnonymousState = async (error: unknown) => {
    try {
      const anonymousState = await loadAnonymousState(
        error instanceof Error ? error.message : "Unable to authenticate right now.",
      );
      startTransition(() => {
        setState(anonymousState);
      });
    } catch {
      startTransition(() => {
        setState(buildFallbackState(error));
      });
    }
  };

  const refresh = async () => {
    try {
      if (hasStoredGuestSession()) {
        startTransition(() => {
          setState(buildGuestState());
        });
        return;
      }

      const session = await restoreCrmSession();
      if (!session) {
        const anonymousState = await loadAnonymousState();
        startTransition(() => {
          setState(anonymousState);
        });
        return;
      }

      const liveState = await loadLiveCrmState(session);
      startTransition(() => {
        setState(liveState);
      });
    } catch (error) {
      console.warn("CRMP backend sync failed, using local preview data instead.", error);
      startTransition(() => {
        setState(buildFallbackState(error));
      });
    }
  };

  const setAssistantSelection = useCallback((selection: AssistantSelection) => {
    startTransition(() => {
      setAssistantSelectionState(selection);
    });
  }, []);

  const clearAssistantSelection = useCallback(() => {
    startTransition(() => {
      setAssistantSelectionState(null);
    });
  }, []);

  const signIn = async (payload: LoginPayload) => {
    startTransition(() => {
      setState((current) => ({
        ...current,
        authState: "loading",
        connection: "loading",
        error: null,
      }));
    });

    try {
      clearGuestSession();
      const session = await loginToCrm(payload);
      const liveState = await loadLiveCrmState(session);
      startTransition(() => {
        setState(liveState);
      });
    } catch (error) {
      await recoverAnonymousState(error);
      throw error;
    }
  };

  const signUp = async (payload: RegistrationPayload) => {
    startTransition(() => {
      setState((current) => ({
        ...current,
        authState: "loading",
        connection: "loading",
        error: null,
      }));
    });

    try {
      clearGuestSession();
      const session = await registerToCrm(payload);
      const liveState = await loadLiveCrmState(session);
      startTransition(() => {
        setState(liveState);
      });
    } catch (error) {
      await recoverAnonymousState(error);
      throw error;
    }
  };

  const continueAsGuest = async () => {
    try {
      await logoutFromCrm();
    } catch {
      // Keep guest mode available even if the backend logout endpoint is offline.
    }
    clearAssistantSelection();
    persistGuestSession();
    startTransition(() => {
      setState(buildGuestState());
    });
  };

  const signOut = async () => {
    clearGuestSession();
    clearAssistantSelection();
    try {
      await logoutFromCrm();
    } catch {
      // Ignore logout failures so the local preview can still recover cleanly.
    }
    await refresh();
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <CrmContext.Provider
      value={{
        ...state,
        isLoading:
          state.authState === "loading" || state.connection === "loading",
        isGuest: state.authState === "guest" || state.connection === "guest",
        refresh,
        signIn,
        signUp,
        continueAsGuest,
        signOut,
        assistantSelection,
        setAssistantSelection,
        clearAssistantSelection,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrmApp() {
  const value = useContext(CrmContext);

  if (!value) {
    throw new Error("useCrmApp must be used inside a CrmProvider.");
  }

  return value;
}

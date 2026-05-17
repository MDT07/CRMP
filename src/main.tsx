import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { THEME_STORAGE_KEY, type ThemeMode } from "./app/providers/ThemeProvider.tsx";
import "./styles/index.css";

// Force unregister old service workers in development
if ("serviceWorker" in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log("[SW] Unregistered old service worker");
    }
  });
}

function getInitialThemeMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Safari private mode or storage disabled
  }

  return "light";
}

// Handle GitHub Pages SPA redirect
const params = new URLSearchParams(window.location.search);
const redirect = params.get("redirect");
if (redirect) {
  const cleanRedirect = redirect.startsWith("/") ? redirect : "/" + redirect;
  window.history.replaceState(null, "", cleanRedirect + window.location.hash);
}

const initialThemeMode = getInitialThemeMode();
const initialTheme =
  initialThemeMode === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : initialThemeMode;

document.documentElement.classList.toggle("dark", initialTheme === "dark");
document.documentElement.dataset.theme = initialTheme;
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById("root") ?? document.body).render(<App />);

// Service worker disabled during development to prevent caching issues
// Re-enable for production PWA
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const swPath = import.meta.env.BASE_URL + "sw.js";
    navigator.serviceWorker
      .register(swPath)
      .then((registration) => {
        console.log("[SW] Registered:", registration.scope);
      })
      .catch((error) => {
        console.log("[SW] Registration failed:", error);
      });
  });
}


import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { THEME_STORAGE_KEY, type ThemeMode } from "./app/providers/ThemeProvider.tsx";
import "./styles/index.css";

function getInitialThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "dark";
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

createRoot(document.getElementById("root")!).render(<App />);
  

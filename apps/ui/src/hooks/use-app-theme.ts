import { useEffect } from "react";
import { useAppStore } from "../store/app";
import { useSessionStore } from "../store/session";
import { resolveAppTheme } from "../utils/app-theme";

export function useAppTheme() {
  const appTheme = useAppStore((state) => state.theme);
  const theme = useSessionStore((state) => state.theme);
  const setTheme = useSessionStore((state) => state.setTheme);

  useEffect(() => {
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      setTheme(resolveAppTheme(appTheme, systemTheme.matches));
    };
    applyTheme();
    systemTheme.addEventListener("change", applyTheme);
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [appTheme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return theme;
}

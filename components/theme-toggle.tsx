"use client";

import { useSyncExternalStore } from "react";
import type { TranslationDictionary } from "@/lib/i18n";
import { Icon } from "./icon";

const storageKey = "tender-package-theme";
type Theme = "light" | "dark";

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : null;
  } catch { return null; }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function subscribe(onChange: () => void) {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const synchronize = () => {
    applyTheme(savedTheme() ?? (system.matches ? "dark" : "light"));
    onChange();
  };
  const storageChange = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) synchronize(); };
  const systemChange = () => { if (!savedTheme()) synchronize(); };
  window.addEventListener("tender-theme-change", onChange);
  window.addEventListener("storage", storageChange);
  system.addEventListener("change", systemChange);
  return () => {
    window.removeEventListener("tender-theme-change", onChange);
    window.removeEventListener("storage", storageChange);
    system.removeEventListener("change", systemChange);
  };
}

const getSnapshot = (): Theme => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerSnapshot = (): Theme => "light";

export function ThemeToggle({ t }: { t: TranslationDictionary }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = theme === "dark" ? t.switchToLight : t.switchToDark;
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Theme still works when storage is unavailable. */ }
    window.dispatchEvent(new Event("tender-theme-change"));
  }
  return <button id="theme-toggle" type="button" onClick={toggle} className="quiet-button" aria-label={label} title={label} aria-pressed={theme === "dark"}><Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" /><span className="hidden xl:inline">{theme === "dark" ? t.darkTheme : t.lightTheme}</span></button>;
}

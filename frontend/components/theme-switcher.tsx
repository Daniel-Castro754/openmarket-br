"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark" | "terminal" | "ocean";
type ResolvedTheme = Exclude<ThemePreference, "system">;

const STORAGE_KEY = "openmarket-theme";

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
}

export function ThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const next = stored && ["system", "light", "dark", "terminal", "ocean"].includes(stored)
      ? stored
      : "system";
    setPreference(next);
    applyTheme(next);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemTheme = () => {
      if ((window.localStorage.getItem(STORAGE_KEY) ?? "system") === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", handleSystemTheme);
    return () => media.removeEventListener("change", handleSystemTheme);
  }, []);

  function onChange(value: ThemePreference) {
    setPreference(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    applyTheme(value);
  }

  return (
    <label className="theme-switcher" title="Aparência">
      <span aria-hidden="true">◐</span>
      <select
        aria-label="Tema do OpenMarket"
        value={preference}
        onChange={(event) => onChange(event.target.value as ThemePreference)}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
        <option value="terminal">Terminal</option>
        <option value="ocean">Ocean</option>
      </select>
    </label>
  );
}

"use client";

import { useEffect, useState } from "react";

type ModePreference = "light" | "dark";
type ColorThemePreference = "openmarket" | "ocean" | "terminal";
type NavigationPreference = "sidebar" | "rail" | "topbar";

const MODE_KEY = "openmarket-mode";
const COLOR_THEME_KEY = "openmarket-color-theme";
const NAVIGATION_KEY = "openmarket-nav-position";

const colorThemes: Array<{ value: ColorThemePreference; label: string }> = [
  { value: "openmarket", label: "Dourado" },
  { value: "ocean", label: "Ocean" },
  { value: "terminal", label: "Terminal" },
];

const navigationOptions: Array<{ value: NavigationPreference; label: string }> = [
  { value: "sidebar", label: "Lateral" },
  { value: "rail", label: "Compacta" },
  { value: "topbar", label: "Superior" },
];

function applyAppearance(
  mode: ModePreference,
  colorTheme: ColorThemePreference,
  navigation: NavigationPreference,
) {
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.dataset.theme = mode;
  root.dataset.themePreference = mode;
  root.dataset.colorTheme = colorTheme;
  root.dataset.navigation = navigation;
}

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ModePreference>("light");
  const [colorTheme, setColorTheme] = useState<ColorThemePreference>("openmarket");
  const [navigation, setNavigation] = useState<NavigationPreference>("topbar");

  useEffect(() => {
    const syncFromDocument = () => {
      const root = document.documentElement;
      const nextMode = root.dataset.mode;
      const nextColorTheme = root.dataset.colorTheme;
      const nextNavigation = root.dataset.navigation;

      if (nextMode === "light" || nextMode === "dark") {
        setMode(nextMode);
      }
      if (
        nextColorTheme === "openmarket"
        || nextColorTheme === "ocean"
        || nextColorTheme === "terminal"
      ) {
        setColorTheme(nextColorTheme);
      }
      if (
        nextNavigation === "sidebar"
        || nextNavigation === "rail"
        || nextNavigation === "topbar"
      ) {
        setNavigation(nextNavigation);
      }
    };

    const frame = window.requestAnimationFrame(syncFromDocument);
    window.addEventListener("openmarket-appearance-change", syncFromDocument);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("openmarket-appearance-change", syncFromDocument);
    };
  }, []);

  function chooseMode(nextMode: ModePreference) {
    setMode(nextMode);
    window.localStorage.setItem(MODE_KEY, nextMode);
    applyAppearance(nextMode, colorTheme, navigation);
  }

  function chooseColorTheme(nextTheme: ColorThemePreference) {
    setColorTheme(nextTheme);
    window.localStorage.setItem(COLOR_THEME_KEY, nextTheme);
    applyAppearance(mode, nextTheme, navigation);
  }

  function chooseNavigation(nextNavigation: NavigationPreference) {
    setNavigation(nextNavigation);
    window.localStorage.setItem(NAVIGATION_KEY, nextNavigation);
    applyAppearance(mode, colorTheme, nextNavigation);
  }

  return (
    <div className="appearance-shell">
      <div className="mode-quick-actions" aria-label="Modo de aparência">
        <button
          type="button"
          className={mode === "light" ? "appearance-icon-button active" : "appearance-icon-button"}
          onClick={() => chooseMode("light")}
          aria-label="Usar modo claro"
          title="Claro"
        >
          <span aria-hidden="true">☀</span>
        </button>
        <button
          type="button"
          className={mode === "dark" ? "appearance-icon-button active" : "appearance-icon-button"}
          onClick={() => chooseMode("dark")}
          aria-label="Usar modo escuro"
          title="Escuro"
        >
          <span aria-hidden="true">☾</span>
        </button>
      </div>

      <details className="appearance-details">
        <summary className="appearance-summary" aria-label="Configurações de aparência" title="Aparência">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.37.34.7.64.96.3.26.67.4 1.06.4H21v4h-.09a1.7 1.7 0 0 0-1.51.64Z" />
          </svg>
        </summary>

        <div className="appearance-panel">
          <span className="appearance-panel-kicker">Aparência</span>

          <div className="appearance-field">
            <span className="appearance-label">Modo</span>
            <div className="appearance-segment" role="group" aria-label="Modo claro ou escuro">
              <button type="button" className={mode === "light" ? "active" : undefined} onClick={() => chooseMode("light")}>Claro</button>
              <button type="button" className={mode === "dark" ? "active" : undefined} onClick={() => chooseMode("dark")}>Escuro</button>
            </div>
          </div>

          <div className="appearance-field">
            <span className="appearance-label">Tema de cor</span>
            <div className="color-theme-options">
              {colorThemes.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  className={colorTheme === theme.value ? "color-theme-option active" : "color-theme-option"}
                  onClick={() => chooseColorTheme(theme.value)}
                  aria-pressed={colorTheme === theme.value}
                >
                  <span className={`color-theme-swatch swatch-${theme.value}`} aria-hidden="true" />
                  <small>{theme.label}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-field">
            <span className="appearance-label">Navegação</span>
            <div className="appearance-segment navigation-segment" role="group" aria-label="Posição da navegação">
              {navigationOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={navigation === option.value ? "active" : undefined}
                  onClick={() => chooseNavigation(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <small className="appearance-note">Preferências salvas neste navegador.</small>
        </div>
      </details>
    </div>
  );
}

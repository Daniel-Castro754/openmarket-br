import type { Metadata } from "next";

import { MacroTickerBar } from "../components/macro-ticker-bar";
import { SiteHeader } from "../components/site-header";
import { SiteSideNavigation } from "../components/site-navigation";
import "./styles.css";
import "./derived.css";
import "./design-system.css";
import "./theme-bridge.css";
import "./visual-overrides.css";
import "./shell-navigation.css";
import "./home-dashboard.css";
import "./asset-terminal.css";
import "./final-polish.css";
import "./redesign-shell.css";
import "./sidebar-layout-fix.css";
import "./page-proportions.css";
import "./asset-company-refinement.css";
import "./asset-indicator-refinement.css";
import "./asset-financial-refinement.css";
import "./market-discovery.css";
import "./discovery-pages.css";
import "./design-governance.css";

export const metadata: Metadata = {
  title: "OpenMarket BR",
  description: "Mercado financeiro brasileiro com dados rastreáveis e código aberto.",
};

const appearanceInitScript = `
(() => {
  try {
    const storedMode = localStorage.getItem("openmarket-mode");
    const mode = storedMode === "light" || storedMode === "dark"
      ? storedMode
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

    const storedColorTheme = localStorage.getItem("openmarket-color-theme");
    const colorTheme = ["openmarket", "ocean", "terminal"].includes(storedColorTheme)
      ? storedColorTheme
      : "openmarket";

    const storedNavigation = localStorage.getItem("openmarket-nav-position");
    const navigation = ["sidebar", "rail", "topbar"].includes(storedNavigation)
      ? storedNavigation
      : "topbar";

    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.themePreference = mode;
    document.documentElement.dataset.colorTheme = colorTheme;
    document.documentElement.dataset.navigation = navigation;
  } catch {
    document.documentElement.dataset.mode = "light";
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "light";
    document.documentElement.dataset.colorTheme = "openmarket";
    document.documentElement.dataset.navigation = "topbar";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript }} />
      </head>
      <body>
        <SiteSideNavigation />
        <SiteHeader />
        <MacroTickerBar />
        {children}
      </body>
    </html>
  );
}

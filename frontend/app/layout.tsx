import type { Metadata } from "next";

import { MacroTickerBar } from "../components/macro-ticker-bar";
import { SiteFooter } from "../components/site-footer";
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
import "./asset-financial-workspace-v2.css";
import "./market-discovery.css";
import "./discovery-pages.css";
import "./design-governance.css";
import "./header-navigation-refinement.css";
import "./company-workstation-d5.css";
import "./home-research-hub.css";
import "./discovery-workspace-d7.css";
import "./visual-qa-d9.css";
import "./asset-overview-v2.css";
import "./asset-overview-v3.css";
import "./home-v2-h1.css";
import "./home-v2-h2.css";
import "./home-v2-h3.css";
import "./home-v2-title-tuning.css";
import "./home-v2-macro-interactive.css";
import "./site-footer.css";
import "./asset-analysis-final-qa.css";
import "./asset-documents-workspace.css";

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
        <SiteFooter />
      </body>
    </html>
  );
}

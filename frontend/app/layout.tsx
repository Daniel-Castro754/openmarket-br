import type { Metadata } from "next";

import { MacroTickerBar } from "../components/macro-ticker-bar";
import { SiteHeader } from "../components/site-header";
import "./styles.css";
import "./derived.css";
import "./design-system.css";
import "./theme-bridge.css";
import "./visual-overrides.css";

export const metadata: Metadata = {
  title: "OpenMarket BR",
  description: "Mercado financeiro brasileiro com dados rastreáveis e código aberto.",
};

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("openmarket-theme") || "system";
    const allowed = ["system", "light", "dark", "terminal", "ocean"];
    const preference = allowed.includes(stored) ? stored : "system";
    const resolved = preference === "system"
      ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.themePreference = "system";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteHeader />
        <MacroTickerBar />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";

import { MacroTickerBar } from "../components/macro-ticker-bar";
import { SiteHeader } from "../components/site-header";
import "./styles.css";
import "./derived.css";

export const metadata: Metadata = {
  title: "OpenMarket BR",
  description: "Mercado financeiro brasileiro com dados rastreáveis e código aberto.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <SiteHeader />
        <MacroTickerBar />
        {children}
      </body>
    </html>
  );
}

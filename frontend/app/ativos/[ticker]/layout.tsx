import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAsset } from "../../../lib/api";
import { AssetOverviewHeader } from "./asset-overview-header";
import { AssetTabs } from "./asset-tabs";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function AssetLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.trim().toUpperCase();
  const asset = await getAsset(ticker);

  if (!asset) notFound();

  const { instrument, company } = asset;
  const title = company?.trading_name || company?.legal_name || instrument.issuer_name || ticker;
  const legalName = company?.legal_name ?? instrument.issuer_name ?? "Emissor ainda não identificado.";

  return (
    <main className="asset-page">
      <div className="asset-breadcrumb">
        <Link href="/">Mercado</Link>
        <span>/</span>
        <span>Ações</span>
        <span>/</span>
        <strong>{ticker}</strong>
      </div>

      <AssetOverviewHeader
        ticker={ticker}
        title={title}
        legalName={legalName}
        exchange={instrument.exchange}
        securityCategory={instrument.security_category}
        governanceLevel={instrument.governance_level}
        latestPeriodLabel={formatDate(asset.latest_period)}
        financialItemCount={asset.financial_item_count}
        availablePeriods={asset.available_periods.length}
      />

      <AssetTabs ticker={ticker} />
      {children}
    </main>
  );
}

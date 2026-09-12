export type SourceMetadata = {
  provider: string;
  source_name: string;
  source_url?: string | null;
  reference_date?: string | null;
  retrieved_at: string;
  quality: "official" | "licensed" | "secondary" | "user_provided";
  license: {
    license_id: string;
    redistribution: string;
    commercial_use_allowed?: boolean | null;
    attribution_required: boolean;
    terms_url?: string | null;
    notes?: string | null;
  };
};

export type Company = {
  id: string;
  legal_name: string;
  trading_name?: string | null;
  cnpj?: string | null;
  cvm_code?: string | null;
  website?: string | null;
  investor_relations_url?: string | null;
  source?: SourceMetadata | null;
};

export type Instrument = {
  id: string;
  company_id?: string | null;
  ticker: string;
  exchange: string;
  isin?: string | null;
  issuer_name?: string | null;
  security_category?: string | null;
  specification?: string | null;
  governance_level?: string | null;
  instrument_type: string;
  currency: string;
  source?: SourceMetadata | null;
};

export type AssetSnapshot = {
  instrument: Instrument;
  company?: Company | null;
  financial_item_count: number;
  latest_period?: string | null;
  available_periods: string[];
};

export type FinancialMetric =
  | "revenue"
  | "gross_profit"
  | "operating_result"
  | "net_income"
  | "total_assets"
  | "equity";

export type FinancialSeriesPoint = {
  period_end: string;
  value: string;
  currency: string;
  filing_reference_date?: string | null;
  filing_version?: number | null;
  source: SourceMetadata;
};

export type FinancialSeries = {
  metric: FinancialMetric;
  label: string;
  frequency: "annual";
  statement: string;
  account_code: string;
  consolidated: boolean;
  points: FinancialSeriesPoint[];
};

const apiBase = (process.env.OPENMARKET_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function getAsset(ticker: string): Promise<AssetSnapshot | null> {
  const response = await fetch(`${apiBase}/api/v1/assets/${encodeURIComponent(ticker)}`, {
    next: { revalidate: 60 },
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status}`);
  }
  return (await response.json()) as AssetSnapshot;
}

export async function getFinancialSeries(
  ticker: string,
  metric: FinancialMetric,
): Promise<FinancialSeries> {
  const response = await fetch(
    `${apiBase}/api/v1/assets/${encodeURIComponent(ticker)}/series/${metric}`,
    { next: { revalidate: 60 } },
  );

  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for ${metric}`);
  }
  return (await response.json()) as FinancialSeries;
}

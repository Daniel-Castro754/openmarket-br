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
  | "current_assets"
  | "equity"
  | "current_liabilities"
  | "cash"
  | "short_term_debt"
  | "long_term_debt"
  | "gross_debt"
  | "net_debt"
  | "current_ratio"
  | "operating_cash_flow"
  | "investing_cash_flow"
  | "financing_cash_flow"
  | "net_change_in_cash"
  | "gross_margin"
  | "operating_margin"
  | "net_margin"
  | "revenue_growth_yoy"
  | "roe";

export type ScreenerMetric =
  | FinancialMetric
  | "roa"
  | "net-debt-to-equity"
  | "gross-debt-to-equity"
  | "equity-to-assets"
  | "net-income-growth-yoy";

export type SeriesFrequency = "annual" | "quarterly";
export type SeriesUnit = "currency" | "percent" | "multiple";

export type FinancialSeriesPoint = {
  period_start?: string | null;
  period_end: string;
  value: string;
  currency?: string | null;
  filing_reference_date?: string | null;
  filing_version?: number | null;
  source: SourceMetadata;
  derived: boolean;
  derivation?: string | null;
  input_sources: SourceMetadata[];
};

export type FinancialSeries = {
  metric: FinancialMetric;
  label: string;
  frequency: SeriesFrequency;
  unit: SeriesUnit;
  statement?: string | null;
  account_code?: string | null;
  consolidated: boolean;
  formula?: string | null;
  points: FinancialSeriesPoint[];
};

export type IndicatorGroup = "efficiency" | "profitability" | "leverage" | "liquidity" | "growth";

export type IndicatorDefinition = {
  slug: string;
  metric?: FinancialMetric | null;
  label: string;
  short_label?: string | null;
  group: IndicatorGroup;
  group_label?: string | null;
  description: string;
  unit: SeriesUnit;
  format: string;
  formula?: string | null;
  dependencies: FinancialMetric[];
  available_frequencies: SeriesFrequency[];
  supports_history: boolean;
  supports_sector_benchmark: boolean;
  requires_market_data: boolean;
  methodology_version: string;
  methodology_notes?: string | null;
};

export type IndicatorValue = IndicatorDefinition & {
  value?: string | null;
  period_end?: string | null;
  source?: SourceMetadata | null;
  derived: boolean;
  history_points: number;
};

export type IndicatorGroupSummary = {
  group: IndicatorGroup;
  label: string;
  indicators: IndicatorValue[];
};

export type IndicatorSummary = {
  ticker: string;
  frequency: SeriesFrequency;
  groups: IndicatorGroupSummary[];
};

export type IndicatorHistory = {
  ticker: string;
  definition: IndicatorDefinition;
  frequency: SeriesFrequency;
  years: number;
  current_value?: string | null;
  current_period?: string | null;
  historical_average?: string | null;
  points: FinancialSeriesPoint[];
};

export type DocumentType =
  | "dfp"
  | "itr"
  | "fre"
  | "material_fact"
  | "earnings_release"
  | "presentation"
  | "annual_report"
  | "other";

export type DocumentProcessingStatus = "pending" | "ready" | "failed";

export type DocumentSection = {
  id: string;
  document_id: string;
  sequence: number;
  page_start?: number | null;
  page_end?: number | null;
  heading?: string | null;
  text: string;
};

export type DocumentSummary = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  tickers: string[];
  title: string;
  document_type: DocumentType;
  source_url?: string | null;
  published_at?: string | null;
  reference_period?: string | null;
  source_category?: string | null;
  source_document_type?: string | null;
  source_species?: string | null;
  source_subject?: string | null;
  source_presentation_type?: string | null;
  content_type: string;
  page_count?: number | null;
  processing_status: DocumentProcessingStatus;
  source: SourceMetadata;
};

export type DocumentDetail = DocumentSummary & {
  sections: DocumentSection[];
};

export type ScreenerRow = {
  ticker: string;
  company_name: string;
  legal_name?: string | null;
  exchange: string;
  instrument_type: string;
  security_category?: string | null;
  governance_level?: string | null;
  currency: string;
  cvm_code?: string | null;
  isin?: string | null;
  latest_period?: string | null;
  financial_item_count: number;
  document_count: number;
  metrics: Partial<Record<ScreenerMetric, string | null>>;
  metric_periods: Partial<Record<ScreenerMetric, string | null>>;
};

export type ScreenerResponse = {
  rows: ScreenerRow[];
  total: number;
  universe_total: number;
  limit: number;
  offset: number;
  sort: string;
  direction: "asc" | "desc";
  applied_filters: number;
};

export type ScreenerQuery = {
  q?: string;
  filters?: string[];
  sort?: string;
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
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
  frequency: SeriesFrequency = "annual",
): Promise<FinancialSeries> {
  const response = await fetch(
    `${apiBase}/api/v1/assets/${encodeURIComponent(ticker)}/series/${metric}?frequency=${frequency}`,
    { next: { revalidate: 60 } },
  );

  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for ${metric}`);
  }
  return (await response.json()) as FinancialSeries;
}

export async function getIndicatorCatalog(): Promise<IndicatorDefinition[]> {
  const response = await fetch(`${apiBase}/api/v1/indicators/catalog`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for indicator catalog`);
  }
  return (await response.json()) as IndicatorDefinition[];
}

export async function getIndicatorSummary(ticker: string): Promise<IndicatorSummary> {
  const response = await fetch(
    `${apiBase}/api/v1/assets/${encodeURIComponent(ticker)}/indicator-summary?frequency=annual`,
    { next: { revalidate: 60 } },
  );
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for indicator summary`);
  }
  return (await response.json()) as IndicatorSummary;
}

export async function getIndicatorHistory(
  ticker: string,
  slug: string,
  years = 5,
): Promise<IndicatorHistory | null> {
  const response = await fetch(
    `${apiBase}/api/v1/assets/${encodeURIComponent(ticker)}/indicators/${encodeURIComponent(slug)}/history?years=${years}&frequency=annual`,
    { next: { revalidate: 60 } },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for indicator ${slug}`);
  }
  return (await response.json()) as IndicatorHistory;
}

export async function getScreener(filters?: ScreenerQuery): Promise<ScreenerResponse> {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  for (const filter of filters?.filters ?? []) params.append("filter", filter);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.direction) params.set("direction", filters.direction);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  if (filters?.offset != null) params.set("offset", String(filters.offset));
  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`${apiBase}/api/v1/screener${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for screener`);
  }
  return (await response.json()) as ScreenerResponse;
}

export async function getDocuments(filters?: {
  ticker?: string;
  documentType?: DocumentType;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<DocumentSummary[]> {
  const params = new URLSearchParams();
  if (filters?.ticker) params.set("ticker", filters.ticker);
  if (filters?.documentType) params.set("document_type", filters.documentType);
  if (filters?.q) params.set("q", filters.q);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  if (filters?.offset != null) params.set("offset", String(filters.offset));

  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`${apiBase}/api/v1/documents${suffix}`, {
    next: { revalidate: 60 },
  });
  if (response.status === 404 && filters?.ticker) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for documents`);
  }
  return (await response.json()) as DocumentSummary[];
}

export async function getDocument(documentId: string): Promise<DocumentDetail | null> {
  const response = await fetch(`${apiBase}/api/v1/documents/${encodeURIComponent(documentId)}`, {
    next: { revalidate: 60 },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for document ${documentId}`);
  }
  return (await response.json()) as DocumentDetail;
}
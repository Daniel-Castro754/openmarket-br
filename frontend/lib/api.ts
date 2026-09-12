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
  | "equity"
  | "cash"
  | "short_term_debt"
  | "long_term_debt"
  | "gross_debt"
  | "net_debt"
  | "operating_cash_flow"
  | "investing_cash_flow"
  | "financing_cash_flow"
  | "net_change_in_cash"
  | "gross_margin"
  | "operating_margin"
  | "net_margin"
  | "revenue_growth_yoy"
  | "roe";

export type SeriesFrequency = "annual" | "quarterly";
export type SeriesUnit = "currency" | "percent";

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
  content_type: string;
  page_count?: number | null;
  processing_status: DocumentProcessingStatus;
  source: SourceMetadata;
};

export type DocumentDetail = DocumentSummary & {
  sections: DocumentSection[];
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

export async function getDocuments(filters?: {
  ticker?: string;
  documentType?: DocumentType;
  q?: string;
}): Promise<DocumentSummary[]> {
  const params = new URLSearchParams();
  if (filters?.ticker) params.set("ticker", filters.ticker);
  if (filters?.documentType) params.set("document_type", filters.documentType);
  if (filters?.q) params.set("q", filters.q);

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

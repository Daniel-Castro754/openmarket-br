import type { SourceMetadata } from "./api";

export type MacroSeriesPoint = {
  reference_date: string;
  value: string;
};

export type MacroIndicator = {
  key: string;
  label: string;
  description: string;
  unit: string;
  frequency: string;
  latest_value: string;
  previous_value?: string | null;
  reference_date: string;
  change?: string | null;
  points: MacroSeriesPoint[];
  source: SourceMetadata;
};

export type MacroExpectation = {
  key: string;
  label: string;
  reference_year: number;
  median: string;
  minimum?: string | null;
  maximum?: string | null;
  respondents?: number | null;
  observation_date: string;
  unit: string;
  source: SourceMetadata;
};

export type MacroSnapshot = {
  indicators: MacroIndicator[];
  expectations: MacroExpectation[];
};

const apiBase = (process.env.OPENMARKET_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const response = await fetch(`${apiBase}/api/v1/macro`, {
    next: { revalidate: 900 },
  });
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for macro snapshot`);
  }
  return (await response.json()) as MacroSnapshot;
}

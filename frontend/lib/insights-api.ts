import type { SourceMetadata } from "./api";

export type InsightPoint = {
  period: string;
  value: string;
};

export type EconomicTrend = {
  key: string;
  label: string;
  description: string;
  unit: string;
  latest_value?: string | null;
  latest_period?: string | null;
  points: InsightPoint[];
  source: SourceMetadata;
};

export type ConsumptionItem = {
  key: string;
  label: string;
  share_percent: string;
  monthly_value?: string | null;
};

export type ConsumptionProfile = {
  key: string;
  label: string;
  description: string;
  average_monthly_consumption?: string | null;
  items: ConsumptionItem[];
  source: SourceMetadata;
};

export type ConsumerInsightSnapshot = {
  consumption_profiles: ConsumptionProfile[];
  trends: EconomicTrend[];
  notes: string[];
};

const apiBase = (process.env.OPENMARKET_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function getConsumerInsights(): Promise<ConsumerInsightSnapshot> {
  const response = await fetch(`${apiBase}/api/v1/insights/consumer`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenMarket API returned ${response.status} for consumer insights`);
  }
  return (await response.json()) as ConsumerInsightSnapshot;
}

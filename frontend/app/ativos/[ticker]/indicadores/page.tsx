import {
  getIndicatorHistory,
  getIndicatorSummary,
} from "../../../../lib/api";
import { IndicatorDashboard } from "../indicator-dashboard";

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssetIndicatorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{
    indicator?: string | string[];
    years?: string | string[];
    chart?: string | string[];
  }>;
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams]);
  const ticker = rawTicker.trim().toUpperCase();
  const requestedIndicator = firstValue(query.indicator)?.trim().toLowerCase() || null;
  const indicatorYears = firstValue(query.years) === "10" ? 10 : 5;
  const indicatorChart = firstValue(query.chart) === "line" ? "line" : "bar";

  const [summary, history] = await Promise.all([
    getIndicatorSummary(ticker),
    requestedIndicator
      ? getIndicatorHistory(ticker, requestedIndicator, indicatorYears)
      : Promise.resolve(null),
  ]);

  return (
    <IndicatorDashboard
      ticker={ticker}
      summary={summary}
      history={history}
      selectedSlug={history ? requestedIndicator : null}
      years={indicatorYears}
      chartMode={indicatorChart}
      pageFrequency="annual"
    />
  );
}

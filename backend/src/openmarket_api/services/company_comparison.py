from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import FinancialMetric, FinancialSeriesPoint, SeriesFrequency
from openmarket_api.domain.comparison import (
    CompanyComparisonResponse,
    ComparisonAsset,
    ComparisonMetricResult,
    ComparisonValue,
)
from openmarket_api.domain.indicators import IndicatorDefinition
from openmarket_api.services.asset_read import AssetReadService
from openmarket_api.services.cash_flow_series import CASH_FLOW_METRICS, CashFlowSeriesService
from openmarket_api.services.indicator_engine import IndicatorEngine
from openmarket_api.services.indicator_registry import indicator_registry
from openmarket_api.services.liquidity_series import LiquidityFinancialSeriesService


REGISTERED_METRIC_SLUGS: dict[FinancialMetric, str] = {
    definition.metric: definition.slug
    for definition in indicator_registry.get_catalog()
    if definition.metric is not None
}


class CompanyComparisonService:
    def __init__(self, session: Session) -> None:
        self.assets = AssetReadService(session)
        self.financial_series = LiquidityFinancialSeriesService(session)
        self.cash_series = CashFlowSeriesService(session)
        self.indicators = IndicatorEngine(session)

    def compare(
        self,
        tickers: list[str],
        metric_keys: list[str],
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> CompanyComparisonResponse:
        normalized_tickers = self._normalize_tickers(tickers)
        normalized_metrics = self._normalize_metric_keys(metric_keys)
        metric_results = {
            key: ComparisonMetricResult(key=key)
            for key in normalized_metrics
        }
        assets: list[ComparisonAsset] = []

        for ticker in normalized_tickers:
            try:
                snapshot = self.assets.get_asset(ticker)
            except LookupError:
                assets.append(
                    ComparisonAsset(
                        ticker=ticker,
                        synchronized=False,
                    )
                )
                for result in metric_results.values():
                    result.values[ticker] = ComparisonValue()
                continue

            company_name = (
                snapshot.company.trading_name
                if snapshot.company and snapshot.company.trading_name
                else snapshot.company.legal_name
                if snapshot.company
                else snapshot.instrument.issuer_name
            )
            assets.append(
                ComparisonAsset(
                    ticker=ticker,
                    company_name=company_name,
                    synchronized=True,
                    financial_item_count=snapshot.financial_item_count,
                    latest_period=snapshot.latest_period,
                )
            )

            for key in normalized_metrics:
                point = self._latest_point(
                    ticker,
                    key,
                    frequency=frequency,
                )
                metric_results[key].values[ticker] = self._comparison_value(point)

        return CompanyComparisonResponse(
            tickers=normalized_tickers,
            frequency=frequency,
            assets=assets,
            metrics=list(metric_results.values()),
        )

    def _latest_point(
        self,
        ticker: str,
        key: str,
        *,
        frequency: SeriesFrequency,
    ) -> FinancialSeriesPoint | None:
        definition = self._indicator_definition(key)
        if definition is not None:
            series = self.indicators.resolve_definition_series(
                ticker,
                definition,
                frequency=frequency,
            )
            return series.points[-1] if series.points else None

        metric = self._financial_metric(key)
        if metric in CASH_FLOW_METRICS:
            series = self.cash_series.get_series(
                ticker,
                metric,
                frequency=frequency,
            )
        else:
            series = self.financial_series.get_series(
                ticker,
                metric,
                frequency=frequency,
            )
        return series.points[-1] if series.points else None

    @staticmethod
    def _comparison_value(point: FinancialSeriesPoint | None) -> ComparisonValue:
        if point is None:
            return ComparisonValue()
        return ComparisonValue(
            value=point.value,
            period_end=point.period_end,
            currency=point.currency,
            derived=point.derived,
            source=point.source,
        )

    @staticmethod
    def _indicator_definition(key: str) -> IndicatorDefinition | None:
        try:
            return indicator_registry.get_definition(key)
        except LookupError:
            return None

    @staticmethod
    def _financial_metric(key: str) -> FinancialMetric:
        try:
            metric = FinancialMetric(key)
        except ValueError as exc:
            raise ValueError(f"comparison metric not found: {key}") from exc

        canonical_slug = REGISTERED_METRIC_SLUGS.get(metric)
        if canonical_slug is not None:
            raise ValueError(
                f"comparison metric {key} is a registered indicator; use slug {canonical_slug}"
            )
        return metric

    @staticmethod
    def _normalize_tickers(tickers: list[str]) -> list[str]:
        normalized = [
            ticker.strip().upper()
            for ticker in tickers
            if ticker.strip()
        ]
        unique = list(dict.fromkeys(normalized))
        if not unique:
            raise ValueError("at least one ticker is required")
        if len(unique) > 4:
            raise ValueError("comparison supports at most 4 tickers")
        return unique

    @staticmethod
    def _normalize_metric_keys(metric_keys: list[str]) -> list[str]:
        normalized = [
            key.strip().lower()
            for key in metric_keys
            if key.strip()
        ]
        unique = list(dict.fromkeys(normalized))
        if not unique:
            raise ValueError("at least one comparison metric is required")
        if len(unique) > 40:
            raise ValueError("comparison supports at most 40 metrics")
        return unique

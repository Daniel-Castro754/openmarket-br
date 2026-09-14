from datetime import date
from unicodedata import normalize

from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import (
    FinancialMetric,
    FinancialSeries,
    FinancialSeriesPoint,
    SeriesFrequency,
    SeriesUnit,
)
from openmarket_api.domain.common import DataQuality, SourceMetadata
from openmarket_api.persistence.models import FinancialStatementRecord
from openmarket_api.persistence.repositories import (
    FinancialStatementRepository,
    InstrumentRepository,
)
from openmarket_api.services.financial_series import FinancialSeriesService


class LiquidityFinancialSeriesService(FinancialSeriesService):
    """Extends the core financial-series service with classification-sensitive liquidity data.

    CVM account codes 1.01 and 2.01 are the standard current-assets/current-liabilities
    totals for industrial/commercial issuers, but the same codes can represent different
    concepts in alternative statement plans (notably financial institutions). We therefore
    require both the code and the normalized CVM account label before publishing liquidity.
    """

    CURRENT_ASSETS_CODE = "1.01"
    CURRENT_LIABILITIES_CODE = "2.01"
    CURRENT_ASSETS_NAME = "Ativo Circulante"
    CURRENT_LIABILITIES_NAME = "Passivo Circulante"
    CURRENT_RATIO_FORMULA = "current_assets / current_liabilities"

    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self._liquidity_instruments = InstrumentRepository(session)
        self._liquidity_financials = FinancialStatementRepository(session)

    def get_series(
        self,
        ticker: str,
        metric: FinancialMetric,
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> FinancialSeries:
        if metric == FinancialMetric.CURRENT_ASSETS:
            return self._get_balance_total_series(
                ticker,
                metric=metric,
                label=self.CURRENT_ASSETS_NAME,
                statement="BPA",
                account_code=self.CURRENT_ASSETS_CODE,
                expected_name=self.CURRENT_ASSETS_NAME,
                frequency=frequency,
            )
        if metric == FinancialMetric.CURRENT_LIABILITIES:
            return self._get_balance_total_series(
                ticker,
                metric=metric,
                label=self.CURRENT_LIABILITIES_NAME,
                statement="BPP",
                account_code=self.CURRENT_LIABILITIES_CODE,
                expected_name=self.CURRENT_LIABILITIES_NAME,
                frequency=frequency,
            )
        if metric == FinancialMetric.CURRENT_RATIO:
            return self._get_current_ratio_series(ticker, frequency=frequency)
        return super().get_series(ticker, metric, frequency=frequency)

    def _get_balance_total_series(
        self,
        ticker: str,
        *,
        metric: FinancialMetric,
        label: str,
        statement: str,
        account_code: str,
        expected_name: str,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        instrument = self._liquidity_instruments.get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker}")
        if instrument.company_id is None:
            return FinancialSeries(
                metric=metric,
                label=label,
                frequency=frequency,
                unit=SeriesUnit.CURRENCY,
                statement=statement,
                account_code=account_code,
                points=[],
            )

        records = self._liquidity_financials.list_for_company(
            instrument.company_id,
            statement=statement,
            consolidated=True,
        )
        candidates = [
            record
            for record in records
            if self._is_balance_candidate(
                record,
                account_code=account_code,
                expected_name=expected_name,
                frequency=frequency,
            )
        ]

        selected: dict[date, FinancialStatementRecord] = {}
        for record in candidates:
            current = selected.get(record.period_end)
            if current is None or self._filing_rank(record) > self._filing_rank(current):
                selected[record.period_end] = record

        return FinancialSeries(
            metric=metric,
            label=label,
            frequency=frequency,
            unit=SeriesUnit.CURRENCY,
            statement=statement,
            account_code=account_code,
            points=sorted(
                (self._point_from_liquidity_record(record) for record in selected.values()),
                key=lambda item: item.period_end,
            ),
        )

    def _get_current_ratio_series(
        self,
        ticker: str,
        *,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        current_assets = self._get_balance_total_series(
            ticker,
            metric=FinancialMetric.CURRENT_ASSETS,
            label=self.CURRENT_ASSETS_NAME,
            statement="BPA",
            account_code=self.CURRENT_ASSETS_CODE,
            expected_name=self.CURRENT_ASSETS_NAME,
            frequency=frequency,
        )
        current_liabilities = self._get_balance_total_series(
            ticker,
            metric=FinancialMetric.CURRENT_LIABILITIES,
            label=self.CURRENT_LIABILITIES_NAME,
            statement="BPP",
            account_code=self.CURRENT_LIABILITIES_CODE,
            expected_name=self.CURRENT_LIABILITIES_NAME,
            frequency=frequency,
        )
        liabilities_by_period = {
            point.period_end: point for point in current_liabilities.points
        }

        points: list[FinancialSeriesPoint] = []
        for asset_point in current_assets.points:
            liability_point = liabilities_by_period.get(asset_point.period_end)
            if liability_point is None or liability_point.value == 0:
                continue
            if asset_point.currency != liability_point.currency:
                continue
            if not self._same_filing(asset_point, liability_point):
                continue

            inputs = self._merge_input_sources(asset_point, liability_point)
            points.append(
                FinancialSeriesPoint(
                    period_end=asset_point.period_end,
                    value=asset_point.value / liability_point.value,
                    currency=None,
                    filing_reference_date=asset_point.filing_reference_date,
                    source=self._calculation_source(
                        "Liquidez Corrente",
                        inputs,
                        asset_point.filing_reference_date,
                    ),
                    derived=True,
                    derivation=self.CURRENT_RATIO_FORMULA,
                    input_sources=inputs,
                )
            )

        return FinancialSeries(
            metric=FinancialMetric.CURRENT_RATIO,
            label="Liquidez Corrente",
            frequency=frequency,
            unit=SeriesUnit.MULTIPLE,
            formula=self.CURRENT_RATIO_FORMULA,
            points=points,
        )

    @classmethod
    def _is_balance_candidate(
        cls,
        record: FinancialStatementRecord,
        *,
        account_code: str,
        expected_name: str,
        frequency: SeriesFrequency,
    ) -> bool:
        if record.account_code != account_code:
            return False
        if cls._normalize_account_name(record.account_name) != cls._normalize_account_name(
            expected_name
        ):
            return False
        if record.exercise_order not in {None, "ÚLTIMO"}:
            return False
        if record.fixed_account is False:
            return False
        if frequency == SeriesFrequency.ANNUAL:
            return record.filing_type == "DFP"
        return record.filing_type in {"ITR", "DFP"}

    @staticmethod
    def _normalize_account_name(value: str) -> str:
        decomposed = normalize("NFKD", value)
        ascii_value = "".join(char for char in decomposed if not char.iscombining())
        return " ".join(ascii_value.casefold().split())

    @staticmethod
    def _point_from_liquidity_record(
        record: FinancialStatementRecord,
    ) -> FinancialSeriesPoint:
        return FinancialSeriesPoint(
            period_start=record.period_start,
            period_end=record.period_end,
            value=record.value,
            currency=record.currency,
            filing_reference_date=record.filing_reference_date,
            filing_version=record.filing_version,
            source=SourceMetadata.model_validate(record.source),
        )

    @staticmethod
    def _calculation_source(
        label: str,
        inputs: list[SourceMetadata],
        reference_date: date | None,
    ) -> SourceMetadata:
        primary = inputs[-1]
        return SourceMetadata(
            provider="openmarket-derived",
            source_name=f"OpenMarket BR — {label}",
            source_url=primary.source_url,
            reference_date=reference_date,
            quality=DataQuality.SECONDARY,
            license=primary.license,
        )

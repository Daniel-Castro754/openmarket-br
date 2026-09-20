from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import CalculationInput, SeriesFrequency
from openmarket_api.domain.common import RedistributionScope
from openmarket_api.domain.indicators import (
    IndicatorDataPassport,
    IndicatorPassportInput,
    IndicatorPassportStatus,
)
from openmarket_api.services.indicator_engine import IndicatorEngine


PUBLIC_REDISTRIBUTION_SCOPES = {
    RedistributionScope.ALLOWED,
    RedistributionScope.ATTRIBUTION_REQUIRED,
}


class IndicatorPassportService:
    def __init__(self, session: Session) -> None:
        self.engine = IndicatorEngine(session)

    def get_passport(
        self,
        ticker: str,
        slug: str,
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> IndicatorDataPassport:
        normalized_ticker, definition, series = self.engine.get_resolved_series(
            ticker,
            slug,
            frequency=frequency,
        )
        point = series.points[-1] if series.points else None

        if point is None:
            return IndicatorDataPassport(
                ticker=normalized_ticker,
                definition=definition,
                frequency=frequency,
                status=IndicatorPassportStatus.UNAVAILABLE,
                formula=series.formula or definition.formula,
                warnings=[
                    "Não há dado comparável suficiente para calcular este indicador no período solicitado."
                ],
            )

        inputs = [self._public_input(item) for item in point.calculation_inputs]
        warnings: list[str] = []
        restricted_count = sum(item.restricted for item in inputs)
        if restricted_count:
            warnings.append(
                f"{restricted_count} input(s) tiveram o valor ocultado por restrição de redistribuição."
            )
        if point.derived and not inputs:
            warnings.append(
                "O cálculo preserva as fontes de origem, mas este ponto não possui inputs "
                "estruturados com valor individual."
            )

        return IndicatorDataPassport(
            ticker=normalized_ticker,
            definition=definition,
            frequency=frequency,
            status=IndicatorPassportStatus.AVAILABLE,
            value=point.value,
            period_start=point.period_start,
            period_end=point.period_end,
            filing_reference_date=point.filing_reference_date,
            filing_version=point.filing_version,
            formula=series.formula or point.derivation or definition.formula,
            derived=point.derived,
            source=point.source,
            inputs=inputs,
            input_sources=point.input_sources or [point.source],
            redistribution_scope=point.source.license.redistribution,
            warnings=warnings,
        )

    @staticmethod
    def _public_input(item: CalculationInput) -> IndicatorPassportInput:
        can_redistribute = item.source.license.redistribution in PUBLIC_REDISTRIBUTION_SCOPES
        return IndicatorPassportInput(
            metric=item.metric,
            label=item.label,
            unit=item.unit,
            value=item.value if can_redistribute else None,
            period_start=item.period_start,
            period_end=item.period_end,
            currency=item.currency,
            filing_reference_date=item.filing_reference_date,
            filing_version=item.filing_version,
            source=item.source,
            restricted=not can_redistribute,
        )

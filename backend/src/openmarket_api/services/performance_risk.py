from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from math import sqrt
from statistics import fmean, stdev

from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.performance import (
    BenchmarkPerformance,
    PerformancePoint,
    PerformanceRiskSnapshot,
    PerformanceStatus,
    PerformanceWindow,
)
from openmarket_api.persistence.models import QuoteRecord
from openmarket_api.persistence.repositories import InstrumentRepository, QuoteRepository
from openmarket_api.providers.b3_cotahist import B3CotahistParser

TRADING_DAYS_PER_YEAR = 252
PRICE_WARNING = (
    "COTAHIST/B3 usa preços de fechamento não ajustados por inflação ou proventos; "
    "os retornos desta tela são retornos de preço, não retorno total ao acionista."
)


class PerformanceRiskService:
    def __init__(self, session: Session) -> None:
        self.instruments = InstrumentRepository(session)
        self.quotes = QuoteRepository(session)

    def get_snapshot(
        self,
        ticker: str,
        *,
        window: PerformanceWindow = PerformanceWindow.ONE_YEAR,
        risk_free_rate_annual_percent: Decimal = Decimal("0"),
        benchmark_ticker: str | None = None,
        provider: str = B3CotahistParser.provider,
    ) -> PerformanceRiskSnapshot:
        normalized = ticker.strip().upper()
        records = self._records(normalized, provider=provider)
        selected = self._select_window(records, window)

        snapshot = self._calculate(
            normalized,
            selected,
            window=window,
            risk_free_rate_annual_percent=risk_free_rate_annual_percent,
        )

        if benchmark_ticker:
            benchmark_normalized = benchmark_ticker.strip().upper()
            benchmark_records = self._records(benchmark_normalized, provider=provider)
            if snapshot.start is not None and snapshot.end is not None:
                benchmark_selected = [
                    record
                    for record in benchmark_records
                    if snapshot.start <= record.as_of <= snapshot.end
                ]
            else:
                benchmark_selected = self._select_window(benchmark_records, window)
            benchmark_snapshot = self._calculate(
                benchmark_normalized,
                benchmark_selected,
                window=window,
                risk_free_rate_annual_percent=risk_free_rate_annual_percent,
            )
            snapshot.benchmark = BenchmarkPerformance(
                ticker=benchmark_normalized,
                status=benchmark_snapshot.status,
                observations=benchmark_snapshot.observations,
                start=benchmark_snapshot.start,
                end=benchmark_snapshot.end,
                total_return_percent=benchmark_snapshot.total_return_percent,
                cagr_percent=benchmark_snapshot.cagr_percent,
                annualized_volatility_percent=benchmark_snapshot.annualized_volatility_percent,
                max_drawdown_percent=benchmark_snapshot.max_drawdown_percent,
            )

        return snapshot

    def _records(self, ticker: str, *, provider: str) -> list[QuoteRecord]:
        instrument = self.instruments.get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found: {ticker}")
        return self.quotes.list_history(instrument.id, provider=provider)

    @staticmethod
    def _select_window(
        records: list[QuoteRecord],
        window: PerformanceWindow,
    ) -> list[QuoteRecord]:
        if not records or window == PerformanceWindow.MAX:
            return records

        years = {
            PerformanceWindow.ONE_YEAR: 1,
            PerformanceWindow.THREE_YEARS: 3,
            PerformanceWindow.FIVE_YEARS: 5,
        }[window]
        threshold = records[-1].as_of - timedelta(days=365 * years)
        return [record for record in records if record.as_of >= threshold]

    @classmethod
    def _calculate(
        cls,
        ticker: str,
        records: list[QuoteRecord],
        *,
        window: PerformanceWindow,
        risk_free_rate_annual_percent: Decimal,
    ) -> PerformanceRiskSnapshot:
        positive = [record for record in records if record.price > 0]
        source = (
            SourceMetadata.model_validate(positive[-1].source)
            if positive
            else None
        )
        base = PerformanceRiskSnapshot(
            ticker=ticker,
            window=window,
            status=PerformanceStatus.INSUFFICIENT_DATA,
            observations=len(positive),
            start=positive[0].as_of if positive else None,
            end=positive[-1].as_of if positive else None,
            risk_free_rate_annual_percent=risk_free_rate_annual_percent,
            source=source,
            warnings=[PRICE_WARNING],
        )
        if len(positive) < 2:
            base.warnings.append(
                "São necessárias pelo menos duas observações de preço para calcular desempenho."
            )
            return base

        prices = [float(record.price) for record in positive]
        daily_returns = [
            prices[index] / prices[index - 1] - 1
            for index in range(1, len(prices))
        ]

        running_max = prices[0]
        drawdowns: list[float] = []
        points: list[PerformancePoint] = []
        first_price = prices[0]

        for record, price in zip(positive, prices, strict=True):
            running_max = max(running_max, price)
            drawdown = price / running_max - 1
            drawdowns.append(drawdown)
            points.append(
                PerformancePoint(
                    as_of=record.as_of,
                    price=record.price,
                    normalized_value=cls._decimal(price / first_price * 100),
                    drawdown_percent=cls._decimal(drawdown * 100),
                )
            )

        total_return = prices[-1] / prices[0] - 1
        elapsed_days = max((positive[-1].as_of - positive[0].as_of).days, 1)
        cagr = (
            (prices[-1] / prices[0]) ** (365.25 / elapsed_days) - 1
            if elapsed_days >= 30
            else None
        )
        if cagr is None:
            base.warnings.append(
                "CAGR e Calmar exigem pelo menos 30 dias corridos de histórico para evitar "
                "anualização distorcida."
            )

        volatility = (
            stdev(daily_returns) * sqrt(TRADING_DAYS_PER_YEAR)
            if len(daily_returns) >= 2
            else 0.0
        )
        annual_rf = float(risk_free_rate_annual_percent) / 100
        daily_rf = (1 + annual_rf) ** (1 / TRADING_DAYS_PER_YEAR) - 1
        excess = [item - daily_rf for item in daily_returns]

        sharpe = None
        if len(excess) >= 2:
            daily_std = stdev(excess)
            if daily_std > 0:
                sharpe = fmean(excess) / daily_std * sqrt(TRADING_DAYS_PER_YEAR)

        downside = [min(item, 0.0) for item in excess]
        downside_daily = sqrt(fmean([item * item for item in downside]))
        sortino = None
        if downside_daily > 0:
            sortino = (
                fmean(excess) * TRADING_DAYS_PER_YEAR
                / (downside_daily * sqrt(TRADING_DAYS_PER_YEAR))
            )

        max_drawdown = min(drawdowns)
        calmar = (
            cagr / abs(max_drawdown)
            if cagr is not None and max_drawdown < 0
            else None
        )

        return base.model_copy(
            update={
                "status": PerformanceStatus.AVAILABLE,
                "total_return_percent": cls._decimal(total_return * 100),
                "cagr_percent": cls._decimal(cagr * 100) if cagr is not None else None,
                "annualized_volatility_percent": cls._decimal(volatility * 100),
                "max_drawdown_percent": cls._decimal(max_drawdown * 100),
                "sharpe_ratio": cls._decimal(sharpe) if sharpe is not None else None,
                "sortino_ratio": cls._decimal(sortino) if sortino is not None else None,
                "calmar_ratio": cls._decimal(calmar) if calmar is not None else None,
                "best_day_percent": cls._decimal(max(daily_returns) * 100),
                "worst_day_percent": cls._decimal(min(daily_returns) * 100),
                "points": points,
            }
        )

    @staticmethod
    def _decimal(value: float) -> Decimal:
        return Decimal(str(value)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

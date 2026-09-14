from enum import StrEnum

from openmarket_api.domain.analytics import FinancialMetric


class DerivedScreenerMetric(StrEnum):
    ROA = "roa"
    NET_DEBT_TO_EQUITY = "net-debt-to-equity"
    GROSS_DEBT_TO_EQUITY = "gross-debt-to-equity"
    EQUITY_TO_ASSETS = "equity-to-assets"
    NET_INCOME_GROWTH_YOY = "net-income-growth-yoy"


ScreenerMetric = FinancialMetric | DerivedScreenerMetric

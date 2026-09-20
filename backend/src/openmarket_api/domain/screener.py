from openmarket_api.domain.analytics import FinancialMetric


ScreenerMetric = FinancialMetric | str


def screener_metric_value(metric: ScreenerMetric) -> str:
    if isinstance(metric, FinancialMetric):
        return metric.value
    return str(metric)

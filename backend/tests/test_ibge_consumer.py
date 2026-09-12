import json
from datetime import date

import httpx
import pytest

from openmarket_api.providers.ibge_consumer import IBGEConsumerProvider


def _payload(values: list[tuple[str, str]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = [{"V": "Valor", "D2C": "Período"}]
    rows.extend({"V": value, "D2C": period} for period, value in values)
    return rows


@pytest.mark.anyio
async def test_snapshot_combines_pof_profiles_and_sidra_trends() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "/t/8888/" in url:
            values = [(f"2025{month:02d}", str(100 + month)) for month in range(1, 13)]
            values += [(f"2026{month:02d}", str(110 + month)) for month in range(1, 13)]
            payload = _payload(values)
        else:
            payload = _payload([("202605", "1.2"), ("202606", "2.4")])
        return httpx.Response(200, content=json.dumps(payload).encode(), request=request)

    provider = IBGEConsumerProvider(transport=httpx.MockTransport(handler))
    snapshot = await provider.snapshot()

    assert len(snapshot.consumption_profiles) == 8
    brazil = snapshot.consumption_profiles[0]
    assert brazil.key == "brasil"
    assert brazil.average_monthly_consumption is not None
    assert brazil.items[1].label == "Habitação"
    assert brazil.items[1].share_percent == 36.6
    assert brazil.source.reference_date == date(2018, 7, 10)

    keys = {trend.key for trend in snapshot.trends}
    assert {"retail_yoy", "services_yoy", "industry_yoy", "ipca_monthly"} <= keys
    industry = next(trend for trend in snapshot.trends if trend.key == "industry_yoy")
    assert industry.points
    assert industry.latest_period == "202612"


def test_sidra_parser_skips_missing_values() -> None:
    payload = _payload([("202601", "..."), ("202602", "-"), ("202603", "1,25")])
    points = IBGEConsumerProvider._parse_sidra(payload)

    assert len(points) == 1
    assert points[0].period == "202603"
    assert points[0].value == 1.25

from datetime import UTC, datetime

import httpx
import pytest

from openmarket_api.providers.bcb_macro import BCBMacroProvider


@pytest.mark.asyncio
async def test_macro_snapshot_parses_sgs_and_focus_data() -> None:
    year = datetime.now(UTC).year

    def handler(request: httpx.Request) -> httpx.Response:
        path = str(request.url)
        if "bcdata.sgs." in path:
            return httpx.Response(
                200,
                json=[
                    {"data": "01/07/2026", "valor": "4.10"},
                    {"data": "01/08/2026", "valor": "4.22"},
                ],
            )

        if "ExpectativasMercadoAnuais" in path:
            filter_query = request.url.params.get("$filter", "")
            if "PIB Total" in filter_query:
                medians = ("2.1", "2.0", "2.2")
            elif "IPCA" in filter_query:
                medians = ("4.2", "3.8", "3.5")
            elif "over-selic" in filter_query:
                medians = ("14.0", "11.5", "10.0")
            else:
                medians = ("5.1", "5.0", "4.9")
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "Indicador": "fixture",
                            "IndicadorDetalhe": None,
                            "Data": "2026-09-11",
                            "DataReferencia": str(year),
                            "Mediana": medians[0],
                            "Minimo": "1.0",
                            "Maximo": "20.0",
                            "numeroRespondentes": 100,
                        },
                        {
                            "Indicador": "fixture",
                            "IndicadorDetalhe": None,
                            "Data": "2026-09-11",
                            "DataReferencia": str(year + 1),
                            "Mediana": medians[1],
                            "Minimo": "1.0",
                            "Maximo": "20.0",
                            "numeroRespondentes": 95,
                        },
                        {
                            "Indicador": "fixture",
                            "IndicadorDetalhe": None,
                            "Data": "2026-09-11",
                            "DataReferencia": str(year + 2),
                            "Mediana": medians[2],
                            "Minimo": "1.0",
                            "Maximo": "20.0",
                            "numeroRespondentes": 90,
                        },
                        {
                            "Indicador": "fixture",
                            "IndicadorDetalhe": None,
                            "Data": "2026-09-10",
                            "DataReferencia": str(year),
                            "Mediana": "99.9",
                            "Minimo": "1.0",
                            "Maximo": "100.0",
                            "numeroRespondentes": 1,
                        },
                    ]
                },
            )
        return httpx.Response(404)

    provider = BCBMacroProvider(transport=httpx.MockTransport(handler))
    snapshot = await provider.snapshot()

    assert len(snapshot.indicators) == 5
    assert snapshot.indicators[0].latest_value == 4.22
    assert snapshot.indicators[0].change == 0.12
    assert snapshot.indicators[0].source.quality.value == "official"
    assert len(snapshot.expectations) == 12
    assert {item.reference_year for item in snapshot.expectations} == {year, year + 1, year + 2}
    assert any(item.key == "ipca" and item.median == 4.2 for item in snapshot.expectations)


def test_sgs_parser_ignores_invalid_rows_and_orders_points() -> None:
    points = BCBMacroProvider._parse_sgs(
        [
            {"data": "01/02/2026", "valor": "2,50"},
            {"data": "invalid", "valor": "3"},
            {"data": "01/01/2026", "valor": "1.25"},
            {"data": "01/03/2026", "valor": "not-a-number"},
        ]
    )

    assert [point.value for point in points] == [1.25, 2.50]
    assert [point.reference_date.isoformat() for point in points] == ["2026-01-01", "2026-02-01"]

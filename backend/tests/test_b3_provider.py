from datetime import date

from openmarket_api.domain.common import DataQuality, RedistributionScope
from openmarket_api.domain.entities import InstrumentType
from openmarket_api.providers.b3 import B3InstrumentProvider


PAYLOAD = {
    "table": {
        "columns": [
            {"name": "RptDt"},
            {"name": "TckrSymb"},
            {"name": "SgmtNm"},
            {"name": "SctyCtgyNm"},
            {"name": "CrpnNm"},
            {"name": "ISIN"},
            {"name": "SpcfctnCd"},
            {"name": "CorpGovnLvlNm"},
            {"name": "TradgCcy"},
        ],
        "values": [
            [
                "2026-09-11",
                "PETR4",
                "CASH",
                "EQUITY",
                "PETROLEO BRASILEIRO S.A. PETROBRAS",
                "BRPETRACNPR6",
                "PN N2",
                "NIVEL 2",
                "BRL",
            ],
            [
                "2026-09-11",
                "PETR4F",
                "CASH",
                "EQUITY",
                "PETROLEO BRASILEIRO S.A. PETROBRAS",
                None,
                "PN N2",
                "NIVEL 2",
                "BRL",
            ],
        ],
    }
}


def test_parse_b3_payload_resolves_exact_cash_ticker() -> None:
    instruments = B3InstrumentProvider.parse_payload(
        PAYLOAD,
        ticker="petr4",
        fallback_date=date(2026, 9, 10),
    )

    assert len(instruments) == 1
    instrument = instruments[0]
    assert instrument.ticker == "PETR4"
    assert instrument.isin == "BRPETRACNPR6"
    assert instrument.issuer_name == "PETROLEO BRASILEIRO S.A. PETROBRAS"
    assert instrument.instrument_type == InstrumentType.STOCK
    assert instrument.governance_level == "NIVEL 2"
    assert instrument.source is not None
    assert instrument.source.reference_date == date(2026, 9, 11)
    assert instrument.source.quality == DataQuality.OFFICIAL
    assert instrument.source.license.redistribution == RedistributionScope.CONDITIONAL


def test_parse_b3_payload_rejects_non_matching_ticker() -> None:
    instruments = B3InstrumentProvider.parse_payload(
        PAYLOAD,
        ticker="VALE3",
        fallback_date=date(2026, 9, 10),
    )
    assert instruments == []

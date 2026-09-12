import asyncio
from time import monotonic

from openmarket_api.domain.common import (
    DataQuality,
    RedistributionScope,
)
from openmarket_api.providers.cvm import CVMCompanyProvider

FIXTURE = """CNPJ_CIA;DENOM_SOCIAL;DENOM_COMERC;CD_CVM;SIT\n00.000.000/0001-00;EMPRESA TESTE S.A.;TESTE;1234;ATIVO\n11.111.111/0001-11;EMPRESA EXEMPLO S.A.;EXEMPLO;9999;ATIVO\n"""

PETROBRAS_FIXTURE = """CNPJ_CIA;DENOM_SOCIAL;DENOM_COMERC;CD_CVM;SIT\n33.000.167/0001-01;PETRÓLEO BRASILEIRO S.A. - PETROBRAS;PETROBRAS;9512;ATIVO\n"""


def test_parse_cvm_company_csv() -> None:
    companies = CVMCompanyProvider.parse_csv(FIXTURE)
    assert len(companies) == 2
    company = companies[0]
    assert company.trading_name == "TESTE"
    assert company.cnpj == "00.000.000/0001-00"
    assert company.cvm_code == "1234"
    assert company.source is not None
    assert company.source.quality == DataQuality.OFFICIAL
    assert company.source.license.redistribution == RedistributionScope.ATTRIBUTION_REQUIRED


def test_search_cvm_company_ignores_accents_and_punctuation() -> None:
    provider = CVMCompanyProvider()
    provider._cache = provider.parse_csv(PETROBRAS_FIXTURE)
    provider._cache_loaded_at = monotonic()

    matches = asyncio.run(
        provider.search_companies("PETROLEO BRASILEIRO S.A. PETROBRAS")
    )

    assert len(matches) == 1
    assert matches[0].legal_name == "PETRÓLEO BRASILEIRO S.A. - PETROBRAS"
    assert matches[0].cvm_code == "9512"

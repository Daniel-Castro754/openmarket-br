from openmarket_api.domain.common import (
    DataQuality,
    RedistributionScope,
)
from openmarket_api.providers.cvm import CVMCompanyProvider

FIXTURE = """CNPJ_CIA;DENOM_SOCIAL;DENOM_COMERC;CD_CVM;SIT\n00.000.000/0001-00;EMPRESA TESTE S.A.;TESTE;1234;ATIVO\n11.111.111/0001-11;EMPRESA EXEMPLO S.A.;EXEMPLO;9999;ATIVO\n"""


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

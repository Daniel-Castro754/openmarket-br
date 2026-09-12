from openmarket_api.domain.common import (
    DataQuality,
    RedistributionScope,
)
from openmarket_api.providers.cvm import CVMCompanyProvider


FIXTURE = """CNPJ_CIA;DENOM_SOCIAL;DENOM_COMERC;CD_CVM;SIT\n33.000.167/0001-01;PETROLEO BRASILEIRO S.A. PETROBRAS;PETROBRAS;9512;ATIVO\n12.345.678/0001-90;EMPRESA EXEMPLO S.A.;EXEMPLO;9999;ATIVO\n"""


def test_parse_cvm_company_csv() -> None:
    companies = CVMCompanyProvider.parse_csv(FIXTURE)
    assert len(companies) == 2
    petrobras = companies[0]
    assert petrobras.trading_name == "PETROBRAS"
    assert petrobras.cnpj == "33.000.167/0001-01"
    assert petrobras.cvm_code == "9512"
    assert petrobras.source is not None
    assert petrobras.source.quality == DataQuality.OFFICIAL
    assert petrobras.source.license.redistribution == RedistributionScope.ATTRIBUTION_REQUIRED

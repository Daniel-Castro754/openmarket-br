from openmarket_api.domain.common import DataLicense, DataQuality, RedistributionScope, SourceMetadata
from openmarket_api.domain.entities import Company, Instrument


def test_company_and_instrument_have_independent_ids() -> None:
    company = Company(legal_name="Empresa Exemplo S.A.")
    instrument = Instrument(company_id=company.id, ticker="EXMP3")
    assert company.id != instrument.id
    assert instrument.company_id == company.id


def test_source_metadata_keeps_license_policy() -> None:
    source = SourceMetadata(
        provider="example",
        source_name="Example Source",
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="example-open",
            redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
            attribution_required=True,
        ),
    )
    assert source.license.attribution_required is True

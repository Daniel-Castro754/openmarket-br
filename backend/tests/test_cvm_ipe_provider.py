import io
import zipfile
from datetime import date

from openmarket_api.domain.common import DataQuality, RedistributionScope
from openmarket_api.domain.documents import DocumentProcessingStatus, DocumentType
from openmarket_api.domain.entities import Company
from openmarket_api.providers.cvm_ipe import CVMIpeDocumentProvider

FIXTURE = """CNPJ_Companhia;Data_Referência;Código_CVM;Categoria;Tipo;Espécie;Assunto;Data_Entrega;Tipo_Apresentação;Protocolo_Entrega;Versão;Link_Download
33.000.167/0001-01;2026-09-01;9512;Fato Relevante;;;Plano estratégico 2027;2026-08-20;Única;123456;1;https://example.test/doc-v1.pdf
33.000.167/0001-01;2026-09-01;9512;Fato Relevante;;;Plano estratégico 2027;2026-08-21;Reapresentação;123457;2;https://example.test/doc-v2.pdf
33.000.167/0001-01;2026-06-30;9512;Dados Econômico-Financeiros;Release;Resultados;Release de Resultados 2T26;2026-08-07;Única;123458;1;https://example.test/release.pdf
12.345.678/0001-90;2026-08-01;9999;Fato Relevante;;;Outra companhia;2026-08-02;Única;900001;1;https://example.test/other.pdf
"""


def _company() -> Company:
    return Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cnpj="33.000.167/0001-01",
        cvm_code="9512",
    )


def _archive(text: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("ipe_cia_aberta_2026.csv", text.encode("cp1252"))
    return buffer.getvalue()


def test_parse_csv_filters_company_and_preserves_versions() -> None:
    documents = CVMIpeDocumentProvider.parse_csv(
        FIXTURE,
        company=_company(),
        start=date(2026, 8, 1),
        end=date(2026, 8, 31),
    )

    assert len(documents) == 3
    assert documents[0].document_type == DocumentType.MATERIAL_FACT
    assert documents[1].document_type == DocumentType.MATERIAL_FACT
    assert documents[0].source_url != documents[1].source_url
    assert "versao=1" in (documents[0].source.license.notes or "")
    assert "versao=2" in (documents[1].source.license.notes or "")
    assert documents[2].document_type == DocumentType.EARNINGS_RELEASE


def test_reference_date_can_be_after_delivery_window() -> None:
    documents = CVMIpeDocumentProvider.parse_csv(
        FIXTURE,
        company=_company(),
        start=date(2026, 8, 20),
        end=date(2026, 8, 20),
    )

    assert len(documents) == 1
    document = documents[0]
    assert document.published_at == date(2026, 8, 20)
    assert document.reference_period == "2026-09-01"
    assert document.source.reference_date == date(2026, 9, 1)


def test_archive_decodes_windows_encoding_and_keeps_provenance() -> None:
    documents = CVMIpeDocumentProvider.parse_archive(
        _archive(FIXTURE),
        company=_company(),
        start=date(2026, 8, 1),
        end=date(2026, 8, 31),
    )

    assert len(documents) == 3
    assert all(item.processing_status == DocumentProcessingStatus.PENDING for item in documents)
    assert all(item.source.quality == DataQuality.OFFICIAL for item in documents)
    assert all(
        item.source.license.redistribution == RedistributionScope.ATTRIBUTION_REQUIRED
        for item in documents
    )
    assert all(item.source.license.attribution_required for item in documents)


def test_document_type_mapping_is_conservative() -> None:
    provider = CVMIpeDocumentProvider

    assert provider._document_type("Fato Relevante") == DocumentType.MATERIAL_FACT
    assert provider._document_type("Informações Trimestrais - ITR") == DocumentType.ITR
    assert provider._document_type("DFP") == DocumentType.DFP
    assert provider._document_type("Formulário de Referência") == DocumentType.FRE
    assert provider._document_type("Apresentação institucional") == DocumentType.PRESENTATION
    assert provider._document_type("Relato Integrado 2025") == DocumentType.ANNUAL_REPORT
    assert provider._document_type("Aviso aos Acionistas") == DocumentType.OTHER

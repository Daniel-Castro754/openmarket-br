import io
import zipfile
from datetime import date
from decimal import Decimal

from openmarket_api.domain.entities import Company
from openmarket_api.providers.cvm_financials import (
    CVMFinancialProvider,
    CVMReportKind,
)

CSV = """CD_CVM;DT_REFER;VERSAO;ORDEM_EXERC;ST_CONTA_FIXA;GRUPO_DFP;DT_INI_EXERC;DT_FIM_EXERC;MOEDA;ESCALA_MOEDA;CD_CONTA;DS_CONTA;VL_CONTA
9512;2026-06-30;2;ÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2026-01-01;2026-06-30;REAL;MIL;3.01;Receita de Venda de Bens e/ou Serviços;1234,5
9512;2026-06-30;2;ÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2026-04-01;2026-06-30;REAL;MIL;3.01;Receita de Venda de Bens e/ou Serviços;700,5
9512;2026-06-30;2;ÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2026-01-01;2026-06-30;REAL;MIL;3.11;Lucro/Prejuízo Consolidado do Período;100,25
9999;2026-06-30;1;ÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2026-01-01;2026-06-30;REAL;MIL;3.01;Outra Empresa;999
"""

RESTATEMENT_CSV = """CD_CVM;DT_REFER;VERSAO;ORDEM_EXERC;ST_CONTA_FIXA;GRUPO_DFP;DT_INI_EXERC;DT_FIM_EXERC;MOEDA;ESCALA_MOEDA;CD_CONTA;DS_CONTA;VL_CONTA
9512;2026-06-30;1;ÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2026-01-01;2026-06-30;REAL;UNIDADE;3.01;Receita;100
9512;2026-06-30;2;ÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2026-01-01;2026-06-30;REAL;UNIDADE;3.01;Receita;120
9512;2026-06-30;2;PENÚLTIMO;S;DF Consolidado - Demonstração do Resultado;2025-01-01;2025-06-30;REAL;UNIDADE;3.01;Receita;90
"""


def _zip_fixture() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("itr_cia_aberta_DRE_con_2026.csv", CSV)
    return buffer.getvalue()


def test_parse_financial_csv_filters_company_and_normalizes_scale() -> None:
    company = Company(legal_name="PETROLEO BRASILEIRO S.A.", cvm_code="9512")

    items = CVMFinancialProvider.parse_csv(
        CSV,
        company=company,
        report_kind=CVMReportKind.ITR,
        statement="DRE",
        consolidated=True,
        start=date(2026, 1, 1),
        end=date(2026, 12, 31),
    )

    assert len(items) == 3
    assert items[0].currency == "BRL"
    assert items[0].value == Decimal("1234500.0")
    assert items[0].period_start == date(2026, 1, 1)
    assert items[0].filing_type == "ITR"
    assert items[0].filing_reference_date == date(2026, 6, 30)
    assert items[0].filing_version == 2
    assert items[0].exercise_order == "ÚLTIMO"
    assert items[0].fixed_account is True
    assert items[0].statement_group == "DF Consolidado - Demonstração do Resultado"
    assert items[0].source.reference_date == date(2026, 6, 30)
    assert items[0].source.provider == "cvm-financial-statements"


def test_parse_archive_detects_statement_and_consolidation() -> None:
    company = Company(legal_name="PETROLEO BRASILEIRO S.A.", cvm_code="9512")

    items = CVMFinancialProvider.parse_archive(
        _zip_fixture(),
        company=company,
        report_kind=CVMReportKind.ITR,
        start=date(2026, 1, 1),
        end=date(2026, 12, 31),
    )

    assert len(items) == 3
    assert all(item.statement == "DRE" for item in items)
    assert all(item.consolidated for item in items)


def test_deduplication_preserves_periods_with_same_end_date() -> None:
    company = Company(legal_name="PETROLEO BRASILEIRO S.A.", cvm_code="9512")
    items = CVMFinancialProvider.parse_csv(
        CSV,
        company=company,
        report_kind=CVMReportKind.ITR,
        statement="DRE",
        consolidated=True,
        start=date(2026, 1, 1),
        end=date(2026, 12, 31),
    )

    deduped = CVMFinancialProvider._deduplicate(items)
    revenue_periods = {item.period_start for item in deduped if item.account_code == "3.01"}

    assert revenue_periods == {date(2026, 1, 1), date(2026, 4, 1)}


def test_deduplication_preserves_restatements_and_exercise_order() -> None:
    company = Company(legal_name="PETROLEO BRASILEIRO S.A.", cvm_code="9512")
    items = CVMFinancialProvider.parse_csv(
        RESTATEMENT_CSV,
        company=company,
        report_kind=CVMReportKind.ITR,
        statement="DRE",
        consolidated=True,
        start=date(2025, 1, 1),
        end=date(2026, 12, 31),
    )

    deduped = CVMFinancialProvider._deduplicate(items)

    assert len(deduped) == 3
    assert {item.filing_version for item in deduped if item.exercise_order == "ÚLTIMO"} == {1, 2}
    assert {item.exercise_order for item in deduped} == {"ÚLTIMO", "PENÚLTIMO"}


def test_statement_detection_includes_dra() -> None:
    member = "dfp_cia_aberta_DRA_con_2025.csv"
    assert CVMFinancialProvider._statement_from_filename(member, CVMReportKind.DFP) == "DRA"


def test_archive_url_uses_official_cvm_pattern() -> None:
    assert CVMFinancialProvider.archive_url(CVMReportKind.DFP, 2025).endswith(
        "/dfp_cia_aberta_2025.zip"
    )
    assert CVMFinancialProvider.archive_url(CVMReportKind.ITR, 2026).endswith(
        "/itr_cia_aberta_2026.zip"
    )

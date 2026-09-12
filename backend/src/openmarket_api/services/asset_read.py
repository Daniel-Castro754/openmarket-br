from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.entities import (
    Company,
    FinancialStatementItem,
    Instrument,
    InstrumentType,
)
from openmarket_api.persistence.models import (
    CompanyRecord,
    FinancialStatementRecord,
    InstrumentRecord,
)
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
    InstrumentRepository,
)


@dataclass(frozen=True)
class AssetSnapshot:
    instrument: Instrument
    company: Company | None
    financial_item_count: int
    latest_period: date | None
    available_periods: list[date]


class AssetReadService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.companies = CompanyRepository(session)
        self.instruments = InstrumentRepository(session)
        self.financials = FinancialStatementRepository(session)

    def get_asset(self, ticker: str) -> AssetSnapshot:
        instrument_record = self.instruments.get_by_ticker(ticker)
        if instrument_record is None:
            raise LookupError(f"asset not found for ticker {ticker}")

        company_record = (
            self.companies.get_by_id(instrument_record.company_id)
            if instrument_record.company_id is not None
            else None
        )
        company = self._company(company_record) if company_record is not None else None
        instrument = self._instrument(instrument_record)

        if company_record is None:
            return AssetSnapshot(
                instrument=instrument,
                company=None,
                financial_item_count=0,
                latest_period=None,
                available_periods=[],
            )

        count, latest_period, periods = self.financials.summary_for_company(company_record.id)
        return AssetSnapshot(
            instrument=instrument,
            company=company,
            financial_item_count=count,
            latest_period=latest_period,
            available_periods=periods,
        )

    def get_financials(
        self,
        ticker: str,
        *,
        start: date | None = None,
        end: date | None = None,
        statement: str | None = None,
        consolidated: bool | None = None,
    ) -> list[FinancialStatementItem]:
        instrument = self.instruments.get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker}")
        if instrument.company_id is None:
            return []

        records = self.financials.list_for_company(
            instrument.company_id,
            start=start,
            end=end,
            statement=statement,
            consolidated=consolidated,
        )
        return [self._financial(item) for item in records]

    @staticmethod
    def _source(value: dict[str, object] | None) -> SourceMetadata | None:
        return SourceMetadata.model_validate(value) if value is not None else None

    @classmethod
    def _company(cls, record: CompanyRecord) -> Company:
        return Company(
            id=record.id,
            legal_name=record.legal_name,
            trading_name=record.trading_name,
            cnpj=record.cnpj,
            cvm_code=record.cvm_code,
            website=record.website,
            investor_relations_url=record.investor_relations_url,
            source=cls._source(record.source),
        )

    @classmethod
    def _instrument(cls, record: InstrumentRecord) -> Instrument:
        return Instrument(
            id=record.id,
            company_id=record.company_id,
            ticker=record.ticker,
            exchange=record.exchange,
            isin=record.isin,
            issuer_name=record.issuer_name,
            security_category=record.security_category,
            specification=record.specification,
            governance_level=record.governance_level,
            instrument_type=InstrumentType(record.instrument_type),
            currency=record.currency,
            source=cls._source(record.source),
        )

    @staticmethod
    def _financial(record: FinancialStatementRecord) -> FinancialStatementItem:
        return FinancialStatementItem(
            company_id=record.company_id,
            period_start=record.period_start,
            period_end=record.period_end,
            statement=record.statement,
            account_code=record.account_code,
            account_name=record.account_name,
            value=record.value,
            currency=record.currency,
            consolidated=record.consolidated,
            source=SourceMetadata.model_validate(record.source),
        )

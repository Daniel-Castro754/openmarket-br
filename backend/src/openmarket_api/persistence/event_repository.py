from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.events import (
    CompanyEvent,
    CompanyEventCategory,
    CompanyEventType,
)
from openmarket_api.persistence.models import CompanyEventRecord


class CompanyEventRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(self, event: CompanyEvent, *, natural_key: str) -> CompanyEventRecord:
        record = self.session.scalar(
            select(CompanyEventRecord).where(
                CompanyEventRecord.natural_key == natural_key
            )
        )
        values = {
            "company_id": event.company_id,
            "event_date": event.event_date,
            "event_type": event.event_type.value,
            "category": event.category.value,
            "origin": event.origin.value,
            "title": event.title,
            "description": event.description,
            "reference_period": event.reference_period,
            "source_document_id": event.source_document_id,
            "source_url": event.source_url,
            "source_classification": event.source_classification,
            "source": event.source.model_dump(mode="json"),
            "projected_at": event.projected_at,
        }
        if record is None:
            record = CompanyEventRecord(
                id=event.id,
                natural_key=natural_key,
                **values,
            )
            self.session.add(record)
        else:
            for field, value in values.items():
                setattr(record, field, value)
        self.session.flush()
        return record

    def list_for_company(
        self,
        company_id: UUID,
        *,
        category: CompanyEventCategory | None = None,
        event_type: CompanyEventType | None = None,
        start: date | None = None,
        end: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CompanyEvent]:
        query = select(CompanyEventRecord).where(
            CompanyEventRecord.company_id == company_id
        )
        if category is not None:
            query = query.where(CompanyEventRecord.category == category.value)
        if event_type is not None:
            query = query.where(CompanyEventRecord.event_type == event_type.value)
        if start is not None:
            query = query.where(CompanyEventRecord.event_date >= start)
        if end is not None:
            query = query.where(CompanyEventRecord.event_date <= end)

        query = (
            query.order_by(
                CompanyEventRecord.event_date.desc(),
                CompanyEventRecord.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        return [self._domain(record) for record in self.session.scalars(query)]

    def count_for_company(self, company_id: UUID) -> int:
        return int(
            self.session.scalar(
                select(func.count())
                .select_from(CompanyEventRecord)
                .where(CompanyEventRecord.company_id == company_id)
            )
            or 0
        )

    @staticmethod
    def _domain(record: CompanyEventRecord) -> CompanyEvent:
        return CompanyEvent(
            id=record.id,
            company_id=record.company_id,
            event_date=record.event_date,
            event_type=record.event_type,
            category=record.category,
            origin=record.origin,
            title=record.title,
            description=record.description,
            reference_period=record.reference_period,
            source_document_id=record.source_document_id,
            source_url=record.source_url,
            source_classification=record.source_classification,
            source=SourceMetadata.model_validate(record.source),
            projected_at=record.projected_at,
        )

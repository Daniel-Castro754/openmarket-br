from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from openmarket_api.domain.platform import ProviderSyncStatus
from openmarket_api.persistence.models import ProviderSnapshotRecord, ProviderSyncRunRecord


class ProviderSnapshotRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, dataset: str, provider: str) -> ProviderSnapshotRecord | None:
        return self.session.scalar(
            select(ProviderSnapshotRecord).where(
                ProviderSnapshotRecord.dataset == dataset,
                ProviderSnapshotRecord.provider == provider,
            )
        )

    def upsert(
        self,
        *,
        dataset: str,
        provider: str,
        payload: dict[str, object],
        collected_at: datetime,
    ) -> ProviderSnapshotRecord:
        record = self.get(dataset, provider)
        if record is None:
            record = ProviderSnapshotRecord(
                dataset=dataset,
                provider=provider,
                payload=payload,
                collected_at=collected_at,
            )
            self.session.add(record)
        else:
            record.payload = payload
            record.collected_at = collected_at
        self.session.flush()
        return record


class ProviderSyncRunRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(
        self,
        *,
        provider: str,
        dataset: str,
        status: ProviderSyncStatus,
        started_at: datetime,
        finished_at: datetime,
        item_count: int | None = None,
        error: str | None = None,
    ) -> ProviderSyncRunRecord:
        record = ProviderSyncRunRecord(
            provider=provider,
            dataset=dataset,
            status=status.value,
            started_at=started_at,
            finished_at=finished_at,
            item_count=item_count,
            error=error,
        )
        self.session.add(record)
        self.session.flush()
        return record

    def latest_for_provider(self, provider: str) -> list[ProviderSyncRunRecord]:
        records = list(
            self.session.scalars(
                select(ProviderSyncRunRecord)
                .where(ProviderSyncRunRecord.provider == provider)
                .order_by(ProviderSyncRunRecord.finished_at.desc())
            )
        )
        latest: dict[str, ProviderSyncRunRecord] = {}
        for record in records:
            latest.setdefault(record.dataset, record)
        return list(latest.values())

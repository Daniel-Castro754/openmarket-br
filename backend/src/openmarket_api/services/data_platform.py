from datetime import UTC, datetime

from sqlalchemy.orm import Session

from openmarket_api.domain.insights import ConsumerInsightSnapshot
from openmarket_api.domain.macro import MacroSnapshot
from openmarket_api.domain.platform import (
    DataSyncResult,
    ProviderDescriptor,
    ProviderOperationalStatus,
    ProviderPlatformStatus,
    ProviderSyncState,
    ProviderSyncStatus,
)
from openmarket_api.persistence.platform_repositories import (
    ProviderSnapshotRepository,
    ProviderSyncRunRepository,
)
from openmarket_api.providers.contracts import ConsumerInsightProvider, MacroProvider

MACRO_DATASET = "macro"
CONSUMER_INSIGHTS_DATASET = "consumer_insights"


class DataPlatformSyncService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.snapshots = ProviderSnapshotRepository(session)
        self.runs = ProviderSyncRunRepository(session)

    async def sync_macro(self, provider: MacroProvider) -> DataSyncResult:
        started_at = datetime.now(UTC)
        try:
            snapshot = await provider.snapshot()
        except Exception as exc:
            self._record_failure(
                provider=provider.name,
                dataset=MACRO_DATASET,
                started_at=started_at,
                error=exc,
            )
            raise

        collected_at = datetime.now(UTC)
        item_count = len(snapshot.indicators) + len(snapshot.expectations)
        self.snapshots.upsert(
            dataset=MACRO_DATASET,
            provider=provider.name,
            payload=snapshot.model_dump(mode="json"),
            collected_at=collected_at,
        )
        self.runs.add(
            provider=provider.name,
            dataset=MACRO_DATASET,
            status=ProviderSyncStatus.SUCCESS,
            started_at=started_at,
            finished_at=collected_at,
            item_count=item_count,
        )
        self.session.commit()
        return DataSyncResult(
            provider=provider.name,
            dataset=MACRO_DATASET,
            status=ProviderSyncStatus.SUCCESS,
            item_count=item_count,
            collected_at=collected_at,
        )

    async def sync_consumer_insights(
        self,
        provider: ConsumerInsightProvider,
    ) -> DataSyncResult:
        started_at = datetime.now(UTC)
        try:
            snapshot = await provider.snapshot()
        except Exception as exc:
            self._record_failure(
                provider=provider.name,
                dataset=CONSUMER_INSIGHTS_DATASET,
                started_at=started_at,
                error=exc,
            )
            raise

        collected_at = datetime.now(UTC)
        item_count = len(snapshot.consumption_profiles) + len(snapshot.trends)
        self.snapshots.upsert(
            dataset=CONSUMER_INSIGHTS_DATASET,
            provider=provider.name,
            payload=snapshot.model_dump(mode="json"),
            collected_at=collected_at,
        )
        self.runs.add(
            provider=provider.name,
            dataset=CONSUMER_INSIGHTS_DATASET,
            status=ProviderSyncStatus.SUCCESS,
            started_at=started_at,
            finished_at=collected_at,
            item_count=item_count,
        )
        self.session.commit()
        return DataSyncResult(
            provider=provider.name,
            dataset=CONSUMER_INSIGHTS_DATASET,
            status=ProviderSyncStatus.SUCCESS,
            item_count=item_count,
            collected_at=collected_at,
        )

    def _record_failure(
        self,
        *,
        provider: str,
        dataset: str,
        started_at: datetime,
        error: Exception,
    ) -> None:
        finished_at = datetime.now(UTC)
        self.runs.add(
            provider=provider,
            dataset=dataset,
            status=ProviderSyncStatus.FAILED,
            started_at=started_at,
            finished_at=finished_at,
            error=f"{type(error).__name__}: {error}"[:4000],
        )
        self.session.commit()


class PersistedDataPlatformService:
    def __init__(self, session: Session) -> None:
        self.snapshots = ProviderSnapshotRepository(session)

    def macro(self, provider: str = "bcb-macro") -> MacroSnapshot | None:
        record = self.snapshots.get(MACRO_DATASET, provider)
        if record is None:
            return None
        return MacroSnapshot.model_validate(record.payload)

    def consumer_insights(
        self,
        provider: str = "ibge-consumer",
    ) -> ConsumerInsightSnapshot | None:
        record = self.snapshots.get(CONSUMER_INSIGHTS_DATASET, provider)
        if record is None:
            return None
        return ConsumerInsightSnapshot.model_validate(record.payload)


class ProviderObservabilityService:
    def __init__(self, session: Session) -> None:
        self.runs = ProviderSyncRunRepository(session)

    def status(self, descriptors: list[ProviderDescriptor]) -> ProviderPlatformStatus:
        providers: list[ProviderOperationalStatus] = []
        for descriptor in descriptors:
            latest = self.runs.latest_for_provider(descriptor.name)
            providers.append(
                ProviderOperationalStatus(
                    descriptor=descriptor,
                    latest_syncs=[
                        ProviderSyncState(
                            provider=record.provider,
                            dataset=record.dataset,
                            status=ProviderSyncStatus(record.status),
                            started_at=record.started_at,
                            finished_at=record.finished_at,
                            item_count=record.item_count,
                            error=record.error,
                        )
                        for record in latest
                    ],
                )
            )
        return ProviderPlatformStatus(providers=providers)

import asyncio
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from openmarket_api.api.routes.insights import get_consumer_insights
from openmarket_api.api.routes.macro import get_macro_snapshot
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.insights import (
    ConsumerInsightSnapshot,
    ConsumptionItem,
    ConsumptionProfile,
    EconomicTrend,
    InsightPoint,
)
from openmarket_api.domain.macro import MacroIndicator, MacroSeriesPoint, MacroSnapshot
from openmarket_api.domain.platform import ProviderCapability, ProviderSyncStatus
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.models import ProviderSnapshotRecord, ProviderSyncRunRecord
from openmarket_api.providers.contracts import ConsumerInsightProvider, MacroProvider
from openmarket_api.providers.registry import ProviderRegistry
from openmarket_api.services.data_platform import (
    DataPlatformSyncService,
    PersistedDataPlatformService,
    ProviderObservabilityService,
)


def _source(provider: str, reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider=provider,
        source_name=f"{provider} fixture",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


class FakeMacroProvider(MacroProvider):
    name = "fake-macro"

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls = 0

    async def healthcheck(self) -> bool:
        return not self.fail

    async def snapshot(self) -> MacroSnapshot:
        self.calls += 1
        if self.fail:
            raise RuntimeError("macro source unavailable")
        source = _source(self.name, date(2026, 9, 20))
        return MacroSnapshot(
            indicators=[
                MacroIndicator(
                    key="selic",
                    label="Selic",
                    description="fixture",
                    unit="% a.a.",
                    frequency="daily",
                    latest_value=Decimal("15.0"),
                    reference_date=date(2026, 9, 20),
                    points=[
                        MacroSeriesPoint(
                            reference_date=date(2026, 9, 20),
                            value=Decimal("15.0"),
                        )
                    ],
                    source=source,
                )
            ],
            expectations=[],
        )


class FakeConsumerProvider(ConsumerInsightProvider):
    name = "fake-consumer"

    async def healthcheck(self) -> bool:
        return True

    async def snapshot(self) -> ConsumerInsightSnapshot:
        source = _source(self.name, date(2026, 9, 20))
        return ConsumerInsightSnapshot(
            consumption_profiles=[
                ConsumptionProfile(
                    key="brasil",
                    label="Brasil",
                    description="fixture",
                    average_monthly_consumption=Decimal("1000"),
                    items=[
                        ConsumptionItem(
                            key="housing",
                            label="Habitação",
                            share_percent=Decimal("30"),
                            monthly_value=Decimal("300"),
                        )
                    ],
                    source=source,
                )
            ],
            trends=[
                EconomicTrend(
                    key="ipca_monthly",
                    label="IPCA",
                    description="fixture",
                    unit="% no mês",
                    latest_value=Decimal("0.4"),
                    latest_period="202609",
                    points=[InsightPoint(period="202609", value=Decimal("0.4"))],
                    source=source,
                )
            ],
            notes=["fixture"],
        )


def _session() -> tuple[Session, object]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine), engine


def test_registry_describes_macro_and_consumer_capabilities() -> None:
    registry = ProviderRegistry()
    registry.register(FakeMacroProvider())
    registry.register(FakeConsumerProvider())

    descriptors = {item.name: item for item in registry.descriptors()}

    assert descriptors["fake-macro"].capabilities == [ProviderCapability.MACRO_SNAPSHOT]
    assert descriptors["fake-consumer"].capabilities == [
        ProviderCapability.CONSUMER_INSIGHTS
    ]


def test_macro_sync_upserts_one_snapshot_and_records_runs() -> None:
    session, engine = _session()
    try:
        provider = FakeMacroProvider()
        service = DataPlatformSyncService(session)

        first = asyncio.run(service.sync_macro(provider))
        second = asyncio.run(service.sync_macro(provider))

        snapshot_count = session.scalar(select(func.count()).select_from(ProviderSnapshotRecord))
        run_count = session.scalar(select(func.count()).select_from(ProviderSyncRunRecord))
        persisted = PersistedDataPlatformService(session).macro(provider.name)

        assert first.status == ProviderSyncStatus.SUCCESS
        assert second.status == ProviderSyncStatus.SUCCESS
        assert snapshot_count == 1
        assert run_count == 2
        assert persisted is not None
        assert persisted.indicators[0].latest_value == Decimal("15.0")
    finally:
        session.close()
        engine.dispose()


def test_failed_sync_preserves_previous_snapshot_and_records_failure() -> None:
    session, engine = _session()
    try:
        service = DataPlatformSyncService(session)
        asyncio.run(service.sync_macro(FakeMacroProvider()))

        with pytest.raises(RuntimeError, match="macro source unavailable"):
            asyncio.run(service.sync_macro(FakeMacroProvider(fail=True)))

        persisted = PersistedDataPlatformService(session).macro("fake-macro")
        latest = ProviderObservabilityService(session).status(
            ProviderRegistryDescriptorFixture.macro()
        ).providers[0].latest_syncs

        assert persisted is not None
        assert persisted.indicators[0].latest_value == Decimal("15.0")
        assert latest[0].status == ProviderSyncStatus.FAILED
        assert "macro source unavailable" in (latest[0].error or "")
    finally:
        session.close()
        engine.dispose()


class ProviderRegistryDescriptorFixture:
    @staticmethod
    def macro():
        registry = ProviderRegistry()
        registry.register(FakeMacroProvider())
        return registry.descriptors()


def test_consumer_sync_is_persisted_and_route_reads_database_only() -> None:
    session, engine = _session()
    try:
        provider = FakeConsumerProvider()
        asyncio.run(DataPlatformSyncService(session).sync_consumer_insights(provider))

        persisted = PersistedDataPlatformService(session).consumer_insights(provider.name)
        assert persisted is not None
        assert persisted.trends[0].latest_value == Decimal("0.4")
    finally:
        session.close()
        engine.dispose()


def test_public_read_models_do_not_call_external_providers() -> None:
    session, engine = _session()
    try:
        macro = FakeMacroProvider()
        consumer = FakeConsumerProvider()
        service = DataPlatformSyncService(session)
        asyncio.run(service.sync_macro(macro))
        asyncio.run(service.sync_consumer_insights(consumer))

        macro_record = session.scalar(
            select(ProviderSnapshotRecord).where(
                ProviderSnapshotRecord.provider == macro.name
            )
        )
        consumer_record = session.scalar(
            select(ProviderSnapshotRecord).where(
                ProviderSnapshotRecord.provider == consumer.name
            )
        )
        assert macro_record is not None
        assert consumer_record is not None

        # Routes use canonical provider names. Re-key fixture rows without invoking providers.
        macro_record.provider = "bcb-macro"
        consumer_record.provider = "ibge-consumer"
        session.commit()

        macro_calls_before = macro.calls
        macro_response = get_macro_snapshot(session=session)
        consumer_response = get_consumer_insights(session=session)

        assert macro_response.indicators[0].latest_value == Decimal("15.0")
        assert consumer_response.trends[0].latest_value == Decimal("0.4")
        assert macro.calls == macro_calls_before
    finally:
        session.close()
        engine.dispose()

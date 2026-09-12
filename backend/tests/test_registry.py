import pytest

from openmarket_api.providers.contracts import Provider
from openmarket_api.providers.registry import ProviderRegistry


class FakeProvider(Provider):
    name = "fake"

    async def healthcheck(self) -> bool:
        return True


def test_provider_registry_rejects_duplicates() -> None:
    registry = ProviderRegistry()
    registry.register(FakeProvider())
    with pytest.raises(ValueError):
        registry.register(FakeProvider())

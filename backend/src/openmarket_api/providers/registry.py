from dataclasses import dataclass, field

from .contracts import Provider


@dataclass
class ProviderRegistry:
    _providers: dict[str, Provider] = field(default_factory=dict)

    def register(self, provider: Provider) -> None:
        if provider.name in self._providers:
            raise ValueError(f"Provider already registered: {provider.name}")
        self._providers[provider.name] = provider

    def get(self, name: str) -> Provider:
        try:
            return self._providers[name]
        except KeyError as exc:
            raise KeyError(f"Unknown provider: {name}") from exc

    def names(self) -> list[str]:
        return sorted(self._providers)


registry = ProviderRegistry()

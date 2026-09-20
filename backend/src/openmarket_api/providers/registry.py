from dataclasses import dataclass, field

from openmarket_api.domain.platform import ProviderCapability, ProviderDescriptor

from .contracts import (
    CompanyProvider,
    ConsumerInsightProvider,
    DocumentProvider,
    FinancialProvider,
    InstrumentProvider,
    MacroProvider,
    Provider,
    QuoteProvider,
)


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

    def descriptors(self) -> list[ProviderDescriptor]:
        return [
            ProviderDescriptor(
                name=name,
                capabilities=self._capabilities(provider),
            )
            for name, provider in sorted(self._providers.items())
        ]

    @staticmethod
    def _capabilities(provider: Provider) -> list[ProviderCapability]:
        capabilities: list[ProviderCapability] = []
        if isinstance(provider, CompanyProvider):
            capabilities.append(ProviderCapability.COMPANY_SEARCH)
        if isinstance(provider, InstrumentProvider):
            capabilities.append(ProviderCapability.INSTRUMENT_SEARCH)
        if isinstance(provider, QuoteProvider):
            capabilities.append(ProviderCapability.QUOTES)
        if isinstance(provider, FinancialProvider):
            capabilities.append(ProviderCapability.FINANCIAL_STATEMENTS)
        if isinstance(provider, DocumentProvider):
            capabilities.append(ProviderCapability.DOCUMENTS)
        if isinstance(provider, MacroProvider):
            capabilities.append(ProviderCapability.MACRO_SNAPSHOT)
        if isinstance(provider, ConsumerInsightProvider):
            capabilities.append(ProviderCapability.CONSUMER_INSIGHTS)
        return capabilities


registry = ProviderRegistry()

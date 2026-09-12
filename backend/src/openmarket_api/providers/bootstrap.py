from openmarket_api.providers.cvm import CVMCompanyProvider
from openmarket_api.providers.registry import registry


def register_builtin_providers() -> None:
    if "cvm-company-registry" not in registry.names():
        registry.register(CVMCompanyProvider())

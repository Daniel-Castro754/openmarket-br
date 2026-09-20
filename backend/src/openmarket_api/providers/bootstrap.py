from openmarket_api.providers.b3 import B3InstrumentProvider
from openmarket_api.providers.bcb_macro import BCBMacroProvider
from openmarket_api.providers.cvm import CVMCompanyProvider
from openmarket_api.providers.cvm_financials import CVMFinancialProvider
from openmarket_api.providers.cvm_ipe import CVMIpeDocumentProvider
from openmarket_api.providers.ibge_consumer import IBGEConsumerProvider
from openmarket_api.providers.registry import registry


def register_builtin_providers() -> None:
    if "b3-instruments" not in registry.names():
        registry.register(B3InstrumentProvider())
    if "cvm-company-registry" not in registry.names():
        registry.register(CVMCompanyProvider())
    if "cvm-financial-statements" not in registry.names():
        registry.register(CVMFinancialProvider())
    if "cvm-ipe-documents" not in registry.names():
        registry.register(CVMIpeDocumentProvider())

    if "bcb-macro" not in registry.names():
        registry.register(BCBMacroProvider())
    if "ibge-consumer" not in registry.names():
        registry.register(IBGEConsumerProvider())

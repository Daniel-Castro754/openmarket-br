from collections.abc import Iterable

from openmarket_api.domain.analytics import (
    FinancialMetric,
    SeriesFrequency,
    SeriesUnit,
)
from openmarket_api.domain.indicators import IndicatorDefinition, IndicatorGroup

GROUP_LABELS: dict[IndicatorGroup, str] = {
    IndicatorGroup.EFFICIENCY: "Eficiência",
    IndicatorGroup.PROFITABILITY: "Rentabilidade",
    IndicatorGroup.LEVERAGE: "Endividamento",
    IndicatorGroup.LIQUIDITY: "Liquidez",
    IndicatorGroup.GROWTH: "Crescimento",
}


INDICATOR_CATALOG: tuple[IndicatorDefinition, ...] = (
    IndicatorDefinition(
        slug="gross-margin",
        metric=FinancialMetric.GROSS_MARGIN,
        label="Margem Bruta",
        group=IndicatorGroup.EFFICIENCY,
        description="Lucro bruto como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="gross_profit / revenue * 100",
        dependencies=[FinancialMetric.GROSS_PROFIT, FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="operating-margin",
        metric=FinancialMetric.OPERATING_MARGIN,
        label="Margem Operacional",
        short_label="Margem op.",
        group=IndicatorGroup.EFFICIENCY,
        description="Resultado operacional como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="operating_result / revenue * 100",
        dependencies=[FinancialMetric.OPERATING_RESULT, FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="net-margin",
        metric=FinancialMetric.NET_MARGIN,
        label="Margem Líquida",
        group=IndicatorGroup.EFFICIENCY,
        description="Lucro líquido como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="net_income / revenue * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="roe",
        metric=FinancialMetric.ROE,
        label="ROE",
        group=IndicatorGroup.PROFITABILITY,
        description="Retorno sobre o patrimônio líquido médio do período.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="annual_net_income / average_equity * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.EQUITY],
        available_frequencies=[SeriesFrequency.ANNUAL],
    ),
    IndicatorDefinition(
        slug="roa",
        label="ROA",
        group=IndicatorGroup.PROFITABILITY,
        description="Retorno anual sobre a média dos ativos totais do período.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="annual_net_income / average_total_assets * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.TOTAL_ASSETS],
        available_frequencies=[SeriesFrequency.ANNUAL],
    ),
    IndicatorDefinition(
        slug="gross-debt",
        metric=FinancialMetric.GROSS_DEBT,
        label="Dívida Bruta",
        group=IndicatorGroup.LEVERAGE,
        description="Soma das dívidas financeiras de curto e longo prazo mapeadas.",
        unit=SeriesUnit.CURRENCY,
        format="currency_compact",
        formula="short_term_debt + long_term_debt",
        dependencies=[FinancialMetric.SHORT_TERM_DEBT, FinancialMetric.LONG_TERM_DEBT],
    ),
    IndicatorDefinition(
        slug="net-debt",
        metric=FinancialMetric.NET_DEBT,
        label="Dívida Líquida",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida bruta menos caixa e equivalentes.",
        unit=SeriesUnit.CURRENCY,
        format="currency_compact",
        formula="gross_debt - cash",
        dependencies=[
            FinancialMetric.SHORT_TERM_DEBT,
            FinancialMetric.LONG_TERM_DEBT,
            FinancialMetric.CASH,
        ],
    ),
    IndicatorDefinition(
        slug="net-debt-to-equity",
        label="Dívida Líquida / PL",
        short_label="Dív. líquida / PL",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida líquida como percentual do patrimônio líquido.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="net_debt / equity * 100",
        dependencies=[FinancialMetric.NET_DEBT, FinancialMetric.EQUITY],
    ),
    IndicatorDefinition(
        slug="gross-debt-to-equity",
        label="Dívida Bruta / PL",
        short_label="Dív. bruta / PL",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida bruta como percentual do patrimônio líquido.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="gross_debt / equity * 100",
        dependencies=[FinancialMetric.GROSS_DEBT, FinancialMetric.EQUITY],
    ),
    IndicatorDefinition(
        slug="equity-to-assets",
        label="Patrimônio / Ativos",
        short_label="PL / Ativos",
        group=IndicatorGroup.LEVERAGE,
        description="Participação do patrimônio líquido nos ativos totais.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="equity / total_assets * 100",
        dependencies=[FinancialMetric.EQUITY, FinancialMetric.TOTAL_ASSETS],
    ),
    IndicatorDefinition(
        slug="current-ratio",
        metric=FinancialMetric.CURRENT_RATIO,
        label="Liquidez Corrente",
        group=IndicatorGroup.LIQUIDITY,
        description=(
            "Ativo circulante dividido pelo passivo circulante no fechamento do período; "
            "só é publicado quando as contas CVM 1.01 e 2.01 também têm os rótulos "
            "Ativo Circulante e Passivo Circulante."
        ),
        unit=SeriesUnit.MULTIPLE,
        format="multiple_2",
        formula="current_assets / current_liabilities",
        dependencies=[FinancialMetric.CURRENT_ASSETS, FinancialMetric.CURRENT_LIABILITIES],
    ),
    IndicatorDefinition(
        slug="revenue-growth-yoy",
        metric=FinancialMetric.REVENUE_GROWTH_YOY,
        label="Crescimento da Receita",
        short_label="Receita YoY",
        group=IndicatorGroup.GROWTH,
        description="Variação da receita contra o mesmo período do ano anterior.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="(current / same_period_previous_year - 1) * 100",
        dependencies=[FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="net-income-growth-yoy",
        label="Crescimento do Lucro",
        short_label="Lucro YoY",
        group=IndicatorGroup.GROWTH,
        description=(
            "Variação do lucro líquido contra o mesmo período do ano anterior; "
            "não é calculada quando a base anterior é nula ou negativa."
        ),
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="(current_net_income / same_period_previous_year - 1) * 100",
        dependencies=[FinancialMetric.NET_INCOME],
    ),
)


class IndicatorRegistry:
    def __init__(
        self,
        definitions: Iterable[IndicatorDefinition],
        group_labels: dict[IndicatorGroup, str],
    ) -> None:
        self._group_labels = dict(group_labels)
        self._definitions: list[IndicatorDefinition] = []
        self._by_slug: dict[str, IndicatorDefinition] = {}

        for definition in definitions:
            slug = definition.slug.strip().lower()
            if slug in self._by_slug:
                raise ValueError(f"duplicate indicator slug: {slug}")
            if definition.group not in self._group_labels:
                raise ValueError(f"missing group label for indicator group: {definition.group}")

            stored = definition.model_copy(deep=True, update={"slug": slug})
            self._definitions.append(stored)
            self._by_slug[slug] = stored

    @property
    def groups(self) -> tuple[IndicatorGroup, ...]:
        used = {definition.group for definition in self._definitions}
        return tuple(group for group in self._group_labels if group in used)

    def get_group_label(self, group: IndicatorGroup) -> str:
        try:
            return self._group_labels[group]
        except KeyError as exc:
            raise LookupError(f"indicator group not found: {group}") from exc

    def get_catalog(self) -> list[IndicatorDefinition]:
        return [self._public_copy(definition) for definition in self._definitions]

    def get_definition(self, slug: str) -> IndicatorDefinition:
        normalized_slug = slug.strip().lower()
        definition = self._by_slug.get(normalized_slug)
        if definition is None:
            raise LookupError(f"indicator not found for slug {slug}")
        return self._public_copy(definition)

    def _public_copy(self, definition: IndicatorDefinition) -> IndicatorDefinition:
        return definition.model_copy(
            deep=True,
            update={"group_label": self.get_group_label(definition.group)},
        )


indicator_registry = IndicatorRegistry(INDICATOR_CATALOG, GROUP_LABELS)

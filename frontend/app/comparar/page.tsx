import Link from "next/link";

import {
  getCompanyComparison,
  getIndicatorCatalog,
  type ComparisonAsset,
  type ComparisonMetricResult,
  type ComparisonValue,
  type FinancialMetric,
  type IndicatorDefinition,
  type SeriesFrequency,
  type SeriesUnit,
} from "../../lib/api";
import { DATA_EMPTY, formatFinancialValue, formatYear } from "../../lib/format";
import styles from "./compare.module.css";

type CompareView = "essential" | "results" | "profitability" | "balance" | "cash" | "all";

type ComparisonMetric = {
  key: string;
  label: string;
  shortLabel?: string | null;
  group: string;
  unit: SeriesUnit;
  views: CompareView[];
  indicatorSlug?: string;
  methodologyVersion?: string;
  availableFrequencies: SeriesFrequency[];
};

type RawComparisonMetric = {
  key: FinancialMetric;
  label: string;
  group: string;
  unit: SeriesUnit;
  views: CompareView[];
};

const rawComparisonMetrics: RawComparisonMetric[] = [
  { key: "revenue", label: "Receita", group: "Resultados", unit: "currency", views: ["essential", "results", "all"] },
  { key: "gross_profit", label: "Lucro bruto", group: "Resultados", unit: "currency", views: ["results", "all"] },
  { key: "operating_result", label: "Resultado operacional", group: "Resultados", unit: "currency", views: ["results", "all"] },
  { key: "net_income", label: "Lucro líquido", group: "Resultados", unit: "currency", views: ["essential", "results", "all"] },
  { key: "total_assets", label: "Ativos totais", group: "Balanço", unit: "currency", views: ["balance", "all"] },
  { key: "equity", label: "Patrimônio líquido", group: "Balanço", unit: "currency", views: ["balance", "all"] },
  { key: "cash", label: "Caixa", group: "Balanço", unit: "currency", views: ["balance", "all"] },
  { key: "operating_cash_flow", label: "Caixa operacional", group: "Fluxo de caixa", unit: "currency", views: ["essential", "cash", "all"] },
  { key: "investing_cash_flow", label: "Caixa de investimento", group: "Fluxo de caixa", unit: "currency", views: ["cash", "all"] },
  { key: "financing_cash_flow", label: "Caixa de financiamento", group: "Fluxo de caixa", unit: "currency", views: ["cash", "all"] },
  { key: "net_change_in_cash", label: "Variação líquida de caixa", group: "Fluxo de caixa", unit: "currency", views: ["cash", "all"] },
];

const essentialIndicatorSlugs = new Set([
  "revenue-growth-yoy",
  "net-margin",
  "roe",
  "net-debt",
  "current-ratio",
]);

const viewOptions: Array<{ value: CompareView; label: string }> = [
  { value: "essential", label: "Essencial" },
  { value: "results", label: "Resultados" },
  { value: "profitability", label: "Rentabilidade" },
  { value: "balance", label: "Balanço e dívida" },
  { value: "cash", label: "Caixa" },
  { value: "all", label: "Todos" },
];

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value?: string | string[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeTickers(value?: string) {
  const parsed = (value ?? "PETR4")
    .toUpperCase()
    .split(/[,+;\s]+/)
    .map((ticker) => ticker.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  return [...new Set(parsed)].slice(0, 4);
}

function normalizeView(value?: string): CompareView {
  return viewOptions.some((item) => item.value === value) ? (value as CompareView) : "essential";
}

function normalizeFrequency(value?: string): SeriesFrequency {
  return value === "quarterly" ? "quarterly" : "annual";
}

function registryViews(definition: IndicatorDefinition): CompareView[] {
  const primary: CompareView | null =
    definition.group === "growth"
      ? "results"
      : definition.group === "efficiency" || definition.group === "profitability"
        ? "profitability"
        : definition.group === "leverage" || definition.group === "liquidity"
          ? "balance"
          : null;

  const views: CompareView[] = ["all"];
  if (primary) views.unshift(primary);
  if (essentialIndicatorSlugs.has(definition.slug)) views.unshift("essential");
  return [...new Set(views)];
}

function buildMetricCatalog(indicators: IndicatorDefinition[]): ComparisonMetric[] {
  const raw: ComparisonMetric[] = rawComparisonMetrics.map((metric) => ({
    ...metric,
    availableFrequencies: ["annual", "quarterly"],
  }));
  const registered: ComparisonMetric[] = indicators.map((definition) => ({
    key: definition.slug,
    label: definition.label,
    shortLabel: definition.short_label,
    group: definition.group_label ?? definition.group,
    unit: definition.unit,
    views: registryViews(definition),
    indicatorSlug: definition.slug,
    methodologyVersion: definition.methodology_version,
    availableFrequencies: definition.available_frequencies,
  }));
  return [...raw, ...registered];
}

function metricsForView(catalog: ComparisonMetric[], view: CompareView) {
  return catalog.filter((metric) => metric.views.includes(view));
}

function normalizeMetricSelection(
  values: string[],
  catalog: ComparisonMetric[],
  defaults: ComparisonMetric[],
) {
  const allowed = new Set(catalog.map((metric) => metric.key));
  const requested = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => allowed.has(value));
  const unique = [...new Set(requested)];
  return unique.length ? unique : defaults.map((metric) => metric.key);
}

function compareViewHref(tickers: string[], view: CompareView, frequency: SeriesFrequency) {
  const params = new URLSearchParams({
    tickers: tickers.join(","),
    view,
    frequency,
  });
  return `/comparar?${params.toString()}`;
}

function metricValueLabel(value: ComparisonValue | undefined, metric: ComparisonMetric) {
  if (!value || value.value == null) return DATA_EMPTY;
  return formatFinancialValue(value.value, metric.unit, {
    currency: value.currency,
    percentDigits: 1,
    multipleDigits: 2,
    fallback: DATA_EMPTY,
  });
}

function metricPeriodLabel(
  value: ComparisonValue | undefined,
  frequency: SeriesFrequency,
) {
  if (!value?.period_end) return DATA_EMPTY;
  if (frequency === "annual") return formatYear(value.period_end, DATA_EMPTY);

  const parsed = new Date(`${value.period_end.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value.period_end;
  const quarter = Math.ceil((parsed.getUTCMonth() + 1) / 3);
  return `${quarter}T ${parsed.getUTCFullYear()}`;
}

function frequencyLabel(frequency: SeriesFrequency) {
  return frequency === "quarterly" ? "Trimestral" : "Anual";
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    tickers?: string | string[];
    view?: string | string[];
    frequency?: string | string[];
    metrics?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const tickers = normalizeTickers(firstValue(query.tickers));
  const view = normalizeView(firstValue(query.view));
  const frequency = normalizeFrequency(firstValue(query.frequency));

  const indicatorCatalog = await getIndicatorCatalog();
  const metricCatalog = buildMetricCatalog(indicatorCatalog);
  const viewMetrics = metricsForView(metricCatalog, view);
  const selectedMetricKeys = normalizeMetricSelection(
    allValues(query.metrics),
    metricCatalog,
    viewMetrics,
  );
  const selectedMetrics = selectedMetricKeys
    .map((key) => metricCatalog.find((metric) => metric.key === key))
    .filter((metric): metric is ComparisonMetric => Boolean(metric));

  const comparison = await getCompanyComparison(
    tickers,
    selectedMetricKeys,
    frequency,
  );
  const metricResults = new Map(comparison.metrics.map((metric) => [metric.key, metric]));
  const assetByTicker = new Map(comparison.assets.map((asset) => [asset.ticker, asset]));
  const metricGroups = [...new Set(selectedMetrics.map((metric) => metric.group))];
  const synchronizedCount = comparison.assets.filter((asset) => asset.synchronized).length;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <span className="eyebrow">COMPARADOR FUNDAMENTALISTA · CVM</span>
          <h1>Comparar empresas</h1>
          <p>Compare fundamentos com semântica canônica, frequência e período identificados.</p>
        </div>

        <div className={styles.statusStrip} aria-label="Contexto da comparação">
          <span><strong>{synchronizedCount}</strong> sincronizadas</span>
          <span><strong>{comparison.assets.length}</strong> na comparação</span>
          <span><strong>{selectedMetrics.length}</strong> métricas</span>
          <span><strong>{frequencyLabel(frequency)}</strong> frequência</span>
          <span><strong>CVM</strong> base financeira</span>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="Selecionar empresas para comparação">
        <form className={styles.form} method="get">
          <label htmlFor="tickers">Empresas</label>
          <div className={styles.formControls}>
            <input
              id="tickers"
              name="tickers"
              defaultValue={tickers.join(", ")}
              placeholder="PETR4, VALE3, BBAS3"
              autoComplete="off"
            />
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="frequency" value={frequency} />
            {selectedMetricKeys.map((metric) => (
              <input type="hidden" name="metrics" value={metric} key={metric} />
            ))}
            <button type="submit">Atualizar</button>
          </div>
          <small>Até 4 tickers, separados por vírgula.</small>
        </form>

        <div className={styles.selectionSummary}>
          {comparison.tickers.map((ticker) => {
            const asset = assetByTicker.get(ticker);
            return (
              <Link
                href={`/ativos/${ticker}`}
                key={ticker}
                className={asset?.synchronized ? styles.assetChip : `${styles.assetChip} ${styles.assetChipMissing}`}
              >
                <strong>{ticker}</strong>
                <span>{asset?.company_name ?? "não sincronizado"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className={styles.compareControls}>
        <nav className={styles.viewTabs} aria-label="Grupo de indicadores">
          {viewOptions.map((option) => (
            <Link
              key={option.value}
              href={compareViewHref(tickers, option.value, frequency)}
              className={view === option.value ? styles.viewTabActive : styles.viewTab}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <form className={styles.frequencyForm} method="get">
          <input type="hidden" name="tickers" value={tickers.join(",")} />
          <input type="hidden" name="view" value={view} />
          {selectedMetricKeys.map((metric) => (
            <input type="hidden" name="metrics" value={metric} key={metric} />
          ))}
          <label htmlFor="frequency">Frequência</label>
          <select id="frequency" name="frequency" defaultValue={frequency}>
            <option value="annual">Anual</option>
            <option value="quarterly">Trimestral</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </div>

      <details className={styles.metricPicker}>
        <summary>Métricas exibidas · {selectedMetrics.length}</summary>
        <form method="get">
          <input type="hidden" name="tickers" value={tickers.join(",")} />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="frequency" value={frequency} />
          <div className={styles.metricPickerGroups}>
            {[...new Set(viewMetrics.map((metric) => metric.group))].map((group) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {viewMetrics.filter((metric) => metric.group === group).map((metric) => (
                  <label key={metric.key}>
                    <input
                      type="checkbox"
                      name="metrics"
                      value={metric.key}
                      defaultChecked={selectedMetricKeys.includes(metric.key)}
                    />
                    <span>{metric.shortLabel ?? metric.label}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <div className={styles.metricPickerActions}>
            <small>Se nenhuma métrica for marcada, o padrão da visão será restaurado.</small>
            <button type="submit">Aplicar métricas</button>
          </div>
        </form>
      </details>

      <section className={styles.tableWrap} aria-label="Tabela comparativa de fundamentos">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Métrica</th>
              {comparison.tickers.map((ticker) => {
                const asset = assetByTicker.get(ticker);
                return (
                  <th key={ticker}>
                    <Link href={`/ativos/${ticker}`}>{ticker}</Link>
                    <small>{asset?.company_name ?? "Não sincronizado"}</small>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.contextRow}>
              <th>Cobertura</th>
              {comparison.tickers.map((ticker) => {
                const asset = assetByTicker.get(ticker);
                return (
                  <td key={ticker}>
                    {asset?.synchronized ? (
                      <>
                        <strong>{asset.financial_item_count.toLocaleString("pt-BR")} fatos</strong>
                        <small>{asset.latest_period ? formatYear(asset.latest_period) : "Sem período"}</small>
                      </>
                    ) : (
                      <span className={styles.missing}>Sincronização necessária</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {metricGroups.map((group) => (
              <FragmentGroup
                key={group}
                group={group}
                metrics={selectedMetrics}
                comparisonTickers={comparison.tickers}
                assetByTicker={assetByTicker}
                metricResults={metricResults}
                frequency={frequency}
              />
            ))}
          </tbody>
        </table>
      </section>

      <footer className={styles.methodologyNote}>
        <span><strong>Registry</strong> · labels, grupos, unidades e versões metodológicas canônicas</span>
        <span><strong>Passport</strong> · indicadores registrados levam à proveniência auditável</span>
        <span>Ausência de dado e frequência não suportada permanecem explícitas.</span>
      </footer>
    </main>
  );
}

function FragmentGroup({
  group,
  metrics,
  comparisonTickers,
  assetByTicker,
  metricResults,
  frequency,
}: {
  group: string;
  metrics: ComparisonMetric[];
  comparisonTickers: string[];
  assetByTicker: Map<string, ComparisonAsset>;
  metricResults: Map<string, ComparisonMetricResult>;
  frequency: SeriesFrequency;
}) {
  const groupMetrics = metrics.filter((metric) => metric.group === group);

  return (
    <>
      <tr className={styles.groupRow}>
        <th colSpan={comparisonTickers.length + 1}>{group}</th>
      </tr>
      {groupMetrics.map((metric) => {
        const result = metricResults.get(metric.key);
        const frequencySupported = metric.availableFrequencies.includes(frequency);

        return (
          <tr key={metric.key}>
            <th>
              {metric.label}
              {metric.methodologyVersion ? <small>metodologia v{metric.methodologyVersion}</small> : null}
            </th>
            {comparisonTickers.map((ticker) => {
              const asset = assetByTicker.get(ticker);
              const value = result?.values[ticker];
              const unavailableReason = !asset?.synchronized
                ? "Sincronização necessária"
                : !frequencySupported
                  ? `Não suportado em ${frequencyLabel(frequency).toLowerCase()}`
                  : value?.value == null
                    ? "Sem dado comparável"
                    : null;

              return (
                <td key={ticker}>
                  {unavailableReason ? (
                    <>
                      <span className={styles.missing}>{DATA_EMPTY}</span>
                      <small>{unavailableReason}</small>
                    </>
                  ) : metric.indicatorSlug ? (
                    <Link
                      className={styles.passportValue}
                      href={`/ativos/${ticker}/indicadores?passport=${encodeURIComponent(metric.indicatorSlug)}#data-passport`}
                      title={`Ver proveniência de ${metric.label} para ${ticker}`}
                    >
                      <strong>{metricValueLabel(value, metric)}</strong>
                      <small>{metricPeriodLabel(value, frequency)}</small>
                    </Link>
                  ) : (
                    <>
                      <strong>{metricValueLabel(value, metric)}</strong>
                      <small>{metricPeriodLabel(value)}</small>
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

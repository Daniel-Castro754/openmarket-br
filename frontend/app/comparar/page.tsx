import Link from "next/link";

import {
  getAsset,
  getFinancialSeries,
  type AssetSnapshot,
  type FinancialMetric,
  type FinancialSeries,
} from "../../lib/api";
import { DATA_EMPTY, formatFinancialValue, formatYear } from "../../lib/format";
import styles from "./compare.module.css";

type CompareView = "essential" | "results" | "profitability" | "balance" | "cash" | "all";

type ComparisonMetric = {
  metric: FinancialMetric;
  label: string;
  group: string;
  views: CompareView[];
};

const comparisonMetrics: ComparisonMetric[] = [
  { metric: "revenue", label: "Receita", group: "Resultados", views: ["essential", "results", "all"] },
  { metric: "revenue_growth_yoy", label: "Crescimento da receita", group: "Resultados", views: ["essential", "results", "all"] },
  { metric: "gross_profit", label: "Lucro bruto", group: "Resultados", views: ["results", "all"] },
  { metric: "operating_result", label: "Resultado operacional", group: "Resultados", views: ["results", "all"] },
  { metric: "net_income", label: "Lucro líquido", group: "Resultados", views: ["essential", "results", "all"] },

  { metric: "gross_margin", label: "Margem bruta", group: "Margens", views: ["profitability", "all"] },
  { metric: "operating_margin", label: "Margem operacional", group: "Margens", views: ["profitability", "all"] },
  { metric: "net_margin", label: "Margem líquida", group: "Margens", views: ["essential", "profitability", "all"] },
  { metric: "roe", label: "ROE", group: "Rentabilidade", views: ["essential", "profitability", "all"] },

  { metric: "total_assets", label: "Ativos totais", group: "Balanço", views: ["balance", "all"] },
  { metric: "equity", label: "Patrimônio líquido", group: "Balanço", views: ["balance", "all"] },
  { metric: "cash", label: "Caixa", group: "Balanço", views: ["balance", "all"] },
  { metric: "gross_debt", label: "Dívida bruta", group: "Endividamento", views: ["balance", "all"] },
  { metric: "net_debt", label: "Dívida líquida", group: "Endividamento", views: ["essential", "balance", "all"] },
  { metric: "current_ratio", label: "Liquidez corrente", group: "Liquidez", views: ["essential", "balance", "all"] },

  { metric: "operating_cash_flow", label: "Caixa operacional", group: "Fluxo de caixa", views: ["essential", "cash", "all"] },
  { metric: "investing_cash_flow", label: "Caixa de investimento", group: "Fluxo de caixa", views: ["cash", "all"] },
  { metric: "financing_cash_flow", label: "Caixa de financiamento", group: "Fluxo de caixa", views: ["cash", "all"] },
  { metric: "net_change_in_cash", label: "Variação líquida de caixa", group: "Fluxo de caixa", views: ["cash", "all"] },
];

const viewOptions: Array<{ value: CompareView; label: string }> = [
  { value: "essential", label: "Essencial" },
  { value: "results", label: "Resultados" },
  { value: "profitability", label: "Rentabilidade" },
  { value: "balance", label: "Balanço e dívida" },
  { value: "cash", label: "Caixa" },
  { value: "all", label: "Todos" },
];

type ComparedAsset = {
  ticker: string;
  asset: AssetSnapshot | null;
  series: Map<FinancialMetric, FinancialSeries>;
};

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

function latestValue(series?: FinancialSeries) {
  return series?.points.at(-1) ?? null;
}

function valueLabel(series?: FinancialSeries) {
  const point = latestValue(series);
  if (!series || !point) return DATA_EMPTY;
  return formatFinancialValue(point.value, series.unit, {
    currency: point.currency,
    percentDigits: 1,
    multipleDigits: 2,
    fallback: DATA_EMPTY,
  });
}

function periodLabel(series?: FinancialSeries) {
  return formatYear(latestValue(series)?.period_end, DATA_EMPTY);
}

function compareHref(tickers: string[], view: CompareView) {
  const params = new URLSearchParams();
  params.set("tickers", tickers.join(","));
  if (view !== "essential") params.set("view", view);
  return `/comparar?${params.toString()}`;
}

async function loadAsset(ticker: string, metrics: ComparisonMetric[]): Promise<ComparedAsset> {
  const asset = await getAsset(ticker).catch(() => null);
  if (!asset) return { ticker, asset: null, series: new Map() };

  const loaded = await Promise.all(
    metrics.map(async ({ metric }) => {
      const series = await getFinancialSeries(ticker, metric, "annual").catch(() => null);
      return [metric, series] as const;
    }),
  );

  return {
    ticker,
    asset,
    series: new Map(
      loaded.filter((entry): entry is [FinancialMetric, FinancialSeries] => entry[1] != null),
    ),
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ tickers?: string | string[]; view?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawTickers = Array.isArray(query.tickers) ? query.tickers[0] : query.tickers;
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view;
  const tickers = normalizeTickers(rawTickers);
  const view = normalizeView(rawView);
  const visibleMetrics = comparisonMetrics.filter((item) => item.views.includes(view));
  const metricGroups = [...new Set(visibleMetrics.map((item) => item.group))];
  const assets = await Promise.all(tickers.map((ticker) => loadAsset(ticker, visibleMetrics)));
  const synchronizedCount = assets.filter((item) => item.asset != null).length;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <span className="eyebrow">COMPARADOR FUNDAMENTALISTA · CVM</span>
          <h1>Comparar empresas</h1>
          <p>Compare fundamentos com o mesmo conceito, frequência e período identificados.</p>
        </div>

        <div className={styles.statusStrip} aria-label="Contexto da comparação">
          <span><strong>{synchronizedCount}</strong> sincronizadas</span>
          <span><strong>{assets.length}</strong> na comparação</span>
          <span><strong>{visibleMetrics.length}</strong> métricas</span>
          <span><strong>Anual</strong> frequência</span>
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
            <button type="submit">Atualizar</button>
          </div>
          <small>Até 4 tickers, separados por vírgula.</small>
        </form>

        <div className={styles.selectionSummary}>
          {assets.map(({ ticker, asset }) => (
            <Link
              href={`/ativos/${ticker}`}
              key={ticker}
              className={asset ? styles.assetChip : `${styles.assetChip} ${styles.assetChipMissing}`}
            >
              <strong>{ticker}</strong>
              <span>{asset?.company?.trading_name ?? asset?.company?.legal_name ?? "não sincronizado"}</span>
            </Link>
          ))}
        </div>
      </section>

      <nav className={styles.viewTabs} aria-label="Grupo de indicadores">
        {viewOptions.map((option) => (
          <Link
            key={option.value}
            href={compareHref(tickers, option.value)}
            className={view === option.value ? styles.viewTabActive : styles.viewTab}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <section className={styles.tableWrap} aria-label="Tabela comparativa de fundamentos">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Métrica</th>
              {assets.map(({ ticker, asset }) => (
                <th key={ticker}>
                  <Link href={`/ativos/${ticker}`}>{ticker}</Link>
                  <small>{asset?.company?.trading_name ?? asset?.company?.legal_name ?? "Não sincronizado"}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.contextRow}>
              <th>Cobertura</th>
              {assets.map(({ ticker, asset }) => (
                <td key={ticker}>
                  {asset ? (
                    <>
                      <strong>{asset.financial_item_count.toLocaleString("pt-BR")} fatos</strong>
                      <small>{asset.available_periods.length} períodos disponíveis</small>
                    </>
                  ) : (
                    <span className={styles.missing}>Sincronização necessária</span>
                  )}
                </td>
              ))}
            </tr>

            {metricGroups.map((group) => (
              <FragmentGroup
                key={group}
                group={group}
                metrics={visibleMetrics}
                assets={assets}
              />
            ))}
          </tbody>
        </table>
      </section>

      <footer className={styles.methodologyNote}>
        <span><strong>Oficial</strong> · demonstrações financeiras CVM</span>
        <span><strong>Calculado</strong> · métricas derivadas mantêm metodologia reproduzível</span>
        <span>Período exibido ao lado de cada valor; ausência de dado permanece como “—”.</span>
      </footer>
    </main>
  );
}

function FragmentGroup({
  group,
  metrics,
  assets,
}: {
  group: string;
  metrics: ComparisonMetric[];
  assets: ComparedAsset[];
}) {
  const groupMetrics = metrics.filter((item) => item.group === group);

  return (
    <>
      <tr className={styles.groupRow}>
        <th colSpan={assets.length + 1}>{group}</th>
      </tr>
      {groupMetrics.map(({ metric, label }) => (
        <tr key={metric}>
          <th>{label}</th>
          {assets.map(({ ticker, asset, series }) => {
            const item = series.get(metric);
            return (
              <td key={ticker}>
                {asset ? (
                  <>
                    <strong>{valueLabel(item)}</strong>
                    <small>{periodLabel(item)}</small>
                  </>
                ) : (
                  DATA_EMPTY
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

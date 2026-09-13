import Link from "next/link";

import {
  getAsset,
  getFinancialSeries,
  type AssetSnapshot,
  type FinancialMetric,
  type FinancialSeries,
} from "../../lib/api";
import styles from "./compare.module.css";

const comparisonMetrics: Array<{ metric: FinancialMetric; label: string; group: string }> = [
  { metric: "revenue", label: "Receita", group: "Resultados" },
  { metric: "net_income", label: "Lucro líquido", group: "Resultados" },
  { metric: "net_margin", label: "Margem líquida", group: "Rentabilidade" },
  { metric: "roe", label: "ROE", group: "Rentabilidade" },
  { metric: "net_debt", label: "Dívida líquida", group: "Balanço" },
  { metric: "operating_cash_flow", label: "Caixa operacional", group: "Caixa" },
];

const metricGroups = [...new Set(comparisonMetrics.map((item) => item.group))];

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

function latestValue(series?: FinancialSeries) {
  return series?.points.at(-1) ?? null;
}

function valueLabel(series?: FinancialSeries) {
  const point = latestValue(series);
  if (!series || !point) return "—";
  const numeric = Number(point.value);
  if (!Number.isFinite(numeric)) return point.value;
  if (series.unit === "percent") {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(numeric)}%`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: point.currency ?? "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

function periodLabel(series?: FinancialSeries) {
  const point = latestValue(series);
  return point?.period_end ? point.period_end.slice(0, 4) : "—";
}

async function loadAsset(ticker: string): Promise<ComparedAsset> {
  const asset = await getAsset(ticker).catch(() => null);
  if (!asset) return { ticker, asset: null, series: new Map() };

  const loaded = await Promise.all(
    comparisonMetrics.map(async ({ metric }) => {
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
  searchParams: Promise<{ tickers?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawTickers = Array.isArray(query.tickers) ? query.tickers[0] : query.tickers;
  const tickers = normalizeTickers(rawTickers);
  const assets = await Promise.all(tickers.map(loadAsset));
  const synchronizedCount = assets.filter((item) => item.asset != null).length;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <span className="eyebrow">COMPARADOR FUNDAMENTALISTA · CVM</span>
          <h1>Comparar empresas</h1>
          <p>Mesmos conceitos, mesma frequência e período visível em cada métrica.</p>
        </div>

        <div className={styles.statusStrip} aria-label="Contexto da comparação">
          <span><strong>{synchronizedCount}</strong> sincronizadas</span>
          <span><strong>{assets.length}</strong> na comparação</span>
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
              <FragmentGroup key={group} group={group} assets={assets} />
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

function FragmentGroup({ group, assets }: { group: string; assets: ComparedAsset[] }) {
  const metrics = comparisonMetrics.filter((item) => item.group === group);

  return (
    <>
      <tr className={styles.groupRow}>
        <th colSpan={assets.length + 1}>{group}</th>
      </tr>
      {metrics.map(({ metric, label }) => (
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
                  "—"
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

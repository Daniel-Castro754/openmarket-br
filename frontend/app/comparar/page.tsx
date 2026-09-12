import Link from "next/link";

import {
  getAsset,
  getFinancialSeries,
  type AssetSnapshot,
  type FinancialMetric,
  type FinancialSeries,
} from "../../lib/api";
import styles from "./compare.module.css";

const comparisonMetrics: Array<{ metric: FinancialMetric; label: string }> = [
  { metric: "revenue", label: "Receita" },
  { metric: "net_income", label: "Lucro líquido" },
  { metric: "net_margin", label: "Margem líquida" },
  { metric: "roe", label: "ROE" },
  { metric: "net_debt", label: "Dívida líquida" },
  { metric: "operating_cash_flow", label: "Caixa operacional" },
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

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/">Mercado</Link>
        <span>/</span>
        <strong>Comparador</strong>
      </div>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>COMPARADOR FUNDAMENTALISTA</span>
          <h1>Compare empresas na mesma régua</h1>
          <p>
            Até quatro ativos lado a lado, usando os mesmos conceitos contábeis e o fechamento anual mais
            recente disponível no OpenMarket. Nada de pontuação opaca: cada métrica continua rastreável à CVM.
          </p>
        </div>
        <form className={styles.form} method="get">
          <label htmlFor="tickers">Tickers</label>
          <div>
            <input
              id="tickers"
              name="tickers"
              defaultValue={tickers.join(", ")}
              placeholder="PETR4, VALE3, BBAS3"
            />
            <button type="submit">Comparar</button>
          </div>
          <small>Separe por vírgula. Máximo de 4 ativos já sincronizados.</small>
        </form>
      </section>

      <section className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Métrica</th>
              {assets.map(({ ticker, asset }) => (
                <th key={ticker}>
                  <Link href={`/ativos/${ticker}`}>{ticker}</Link>
                  <small>
                    {asset?.company?.trading_name ?? asset?.company?.legal_name ?? "Não sincronizado"}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.contextRow}>
              <th>Cobertura CVM</th>
              {assets.map(({ ticker, asset }) => (
                <td key={ticker}>
                  {asset ? (
                    <>
                      <strong>{asset.financial_item_count.toLocaleString("pt-BR")} fatos</strong>
                      <small>{asset.available_periods.length} períodos</small>
                    </>
                  ) : (
                    <span className={styles.missing}>Sincronização necessária</span>
                  )}
                </td>
              ))}
            </tr>
            {comparisonMetrics.map(({ metric, label }) => (
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
          </tbody>
        </table>
      </section>

      <section className={styles.notes}>
        <div>
          <strong>Metodologia transparente</strong>
          <p>
            A comparação usa séries anuais consolidadas e, quando aplicável, métricas derivadas pelo OpenMarket
            com proveniência explícita. Não há score proprietário escondendo os critérios.
          </p>
        </div>
        <div>
          <strong>Próxima evolução</strong>
          <p>
            Quando tivermos preço de mercado com licença adequada, este comparador poderá acrescentar múltiplos,
            retorno, preço versus lucro e leitura em BRL/USD sem alterar a base contábil.
          </p>
        </div>
      </section>
    </main>
  );
}

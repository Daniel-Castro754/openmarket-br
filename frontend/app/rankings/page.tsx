import Link from "next/link";

import { getScreener, type FinancialMetric } from "../../lib/api";

export const dynamic = "force-dynamic";

type RankingDefinition = {
  slug: string;
  metric: FinancialMetric;
  label: string;
  description: string;
  methodology: string;
};

const rankings: RankingDefinition[] = [
  {
    slug: "revenue-growth",
    metric: "revenue_growth_yoy",
    label: "Crescimento da receita",
    description: "Variação anual da receita no período mais recente disponível.",
    methodology: "(Receita atual / receita comparável anterior − 1) × 100",
  },
  {
    slug: "roe",
    metric: "roe",
    label: "ROE",
    description: "Retorno anual sobre o patrimônio líquido médio.",
    methodology: "Lucro líquido anual / patrimônio líquido médio × 100",
  },
  {
    slug: "net-margin",
    metric: "net_margin",
    label: "Margem líquida",
    description: "Participação do lucro líquido na receita líquida.",
    methodology: "Lucro líquido / receita × 100",
  },
  {
    slug: "operating-margin",
    metric: "operating_margin",
    label: "Margem operacional",
    description: "Resultado operacional em relação à receita líquida.",
    methodology: "Resultado operacional / receita × 100",
  },
  {
    slug: "gross-margin",
    metric: "gross_margin",
    label: "Margem bruta",
    description: "Lucro bruto em relação à receita líquida.",
    methodology: "Lucro bruto / receita × 100",
  },
];

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPercent(value: string | null | undefined) {
  if (value == null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numeric)}%`;
}

function formatPeriod(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 4);
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedMetric = firstValue(query.metric);
  const selected = rankings.find((ranking) => ranking.slug === requestedMetric) ?? rankings[0];
  const screener = await getScreener({
    sort: selected.metric,
    direction: "desc",
    limit: 100,
  });
  const rows = screener.rows.filter((row) => {
    const value = row.metrics[selected.metric];
    return value != null && Number.isFinite(Number(value));
  });

  return (
    <main className="discovery-page d7-workspace rankings-page">
      <header className="discovery-header">
        <div>
          <span className="eyebrow">RANKINGS · FUNDAMENTOS</span>
          <h1>Rankings</h1>
          <p>
            Ordene empresas por métricas calculadas a partir da base CVM, mantendo período e fórmula visíveis.
            Empresas sem dado comparável para a métrica selecionada não entram na lista exibida.
          </p>
        </div>
      </header>

      <section className="d7-meta-strip" aria-label="Resumo do ranking">
        <div>
          <strong>{screener.universe_total.toLocaleString("pt-BR")}</strong>
          <span>ativos no universo sincronizado</span>
        </div>
        <div>
          <strong>{rows.length.toLocaleString("pt-BR")}</strong>
          <span>linhas exibidas com dado válido</span>
        </div>
        <div>
          <strong>{selected.label}</strong>
          <span>métrica atual</span>
        </div>
        <div>
          <strong>CVM</strong>
          <span>fonte financeira</span>
        </div>
      </section>

      <section className="discovery-toolbar" aria-label="Selecionar ranking">
        <div className="ranking-selector">
          {rankings.map((ranking) => (
            <Link
              href={`/rankings?metric=${ranking.slug}`}
              className={selected.slug === ranking.slug ? "active" : undefined}
              key={ranking.slug}
            >
              {ranking.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="ranking-context-bar" aria-label="Metodologia do ranking">
        <div>
          <strong>{selected.label}</strong>
          <span>{selected.description}</span>
        </div>
        <div className="ranking-formula-inline">
          <small>Fórmula · {selected.methodology}</small>
        </div>
        <small className="ranking-source-inline">Calculado · CVM</small>
      </section>

      <section className="discovery-table-panel">
        <div className="discovery-table-heading">
          <div>
            <span className="eyebrow">CLASSIFICAÇÃO</span>
            <h2>{selected.label}</h2>
          </div>
          <span className="source-pill">Calculado · CVM</span>
        </div>

        <div className="discovery-table-wrap">
          <table className="discovery-table ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Empresa</th>
                <th>Indicador</th>
                <th>Período</th>
                <th>Governança</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.ticker}>
                  <td className="rank-position">{index + 1}</td>
                  <td>
                    <Link className="company-cell" href={`/ativos/${row.ticker}`}>
                      <strong>{row.ticker}</strong>
                      <span>{row.company_name}</span>
                    </Link>
                  </td>
                  <td className="numeric-cell"><strong>{formatPercent(row.metrics[selected.metric])}</strong></td>
                  <td>{formatPeriod(row.metric_periods[selected.metric])}</td>
                  <td>{row.governance_level || "—"}</td>
                  <td><span className="table-source-badge">CVM · calculado</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className="discovery-empty-state">
              Nenhuma empresa possui dado comparável para este indicador na base sincronizada.
            </div>
          ) : null}
        </div>
      </section>

      <footer className="discovery-footnote">
        <strong>Metodologia:</strong>
        <span>
          o ranking ordena o valor mais recente disponível da métrica. Não é recomendação de investimento e não
          preenche lacunas com estimativas.
        </span>
      </footer>
    </main>
  );
}

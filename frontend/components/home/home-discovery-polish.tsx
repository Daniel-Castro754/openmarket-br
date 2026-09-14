import Link from "next/link";

import { getScreener, type FinancialMetric, type ScreenerRow } from "../../lib/api";

type RankingPreview = {
  slug: string;
  label: string;
  metric: FinancialMetric;
  rows: ScreenerRow[];
};

const rankingDefinitions = [
  { slug: "revenue-growth", label: "Crescimento da receita", metric: "revenue_growth_yoy" as FinancialMetric },
  { slug: "roe", label: "ROE", metric: "roe" as FinancialMetric },
  { slug: "net-margin", label: "Margem líquida", metric: "net_margin" as FinancialMetric },
];

const researchLinks = [
  { label: "Document Hub", detail: "Documentos oficiais e relatórios", href: "/relatorios" },
  { label: "Macroeconomia", detail: "BCB, Focus e séries históricas", href: "/macroeconomia" },
  { label: "Economia real", detail: "Indicadores e séries do IBGE", href: "/analises" },
  { label: "Calculadoras", detail: "Simulações separadas da base factual", href: "/calculadoras" },
];

function formatPercent(value: string | null | undefined) {
  if (value == null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(numeric)}%`;
}

async function loadRankingPreview(
  slug: string,
  label: string,
  metric: FinancialMetric,
): Promise<RankingPreview> {
  try {
    const response = await getScreener({
      sort: metric,
      direction: "desc",
      limit: 8,
    });
    const rows = response.rows
      .filter((row) => {
        const value = row.metrics[metric];
        return value != null && Number.isFinite(Number(value));
      })
      .slice(0, 3);
    return { slug, label, metric, rows };
  } catch {
    return { slug, label, metric, rows: [] };
  }
}

export async function HomeDiscoveryPolish() {
  const rankings = await Promise.all(
    rankingDefinitions.map((definition) =>
      loadRankingPreview(definition.slug, definition.label, definition.metric),
    ),
  );

  return (
    <>
      <section className="home-v2-discovery" aria-label="Descoberta e rankings">
        <article className="home-v2-ranking-panel">
          <header className="home-v2-discovery-heading">
            <div>
              <span className="eyebrow">DESCOBERTA</span>
              <h2>Rankings em destaque</h2>
            </div>
            <Link href="/rankings">Explorar rankings →</Link>
          </header>

          <div className="home-v2-ranking-grid">
            {rankings.map((ranking) => (
              <section className="home-v2-ranking-column" key={ranking.slug}>
                <header>
                  <strong>{ranking.label}</strong>
                  <Link href={`/rankings?metric=${ranking.slug}`}>Ver ranking</Link>
                </header>

                <div className="home-v2-ranking-list">
                  {ranking.rows.length === 0 ? (
                    <div className="home-v2-ranking-empty">Sem dados válidos agora.</div>
                  ) : (
                    ranking.rows.map((row, index) => (
                      <Link className="home-v2-ranking-row" href={`/ativos/${row.ticker}`} key={row.ticker}>
                        <span className="home-v2-ranking-position">{index + 1}</span>
                        <span className="home-v2-ranking-company">
                          <strong>{row.ticker}</strong>
                          <small>{row.company_name}</small>
                        </span>
                        <b>{formatPercent(row.metrics[ranking.metric])}</b>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>

        <aside className="home-v2-research-links">
          <header className="home-v2-discovery-heading">
            <div>
              <span className="eyebrow">PESQUISA</span>
              <h2>Outras áreas</h2>
            </div>
          </header>
          <div className="home-v2-research-link-list">
            {researchLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="home-v2-transparency" aria-label="Dados e metodologia">
        <header>
          <span className="eyebrow">DADOS E METODOLOGIA</span>
          <strong>Origem antes de interpretação.</strong>
        </header>
        <div className="home-v2-transparency-grid">
          <div>
            <span className="home-v2-data-label official">Oficial</span>
            <strong>CVM · Banco Central · IBGE</strong>
            <small>Dado primário com fonte e período identificados.</small>
          </div>
          <div>
            <span className="home-v2-data-label calculated">Calculado</span>
            <strong>OpenMarket BR</strong>
            <small>Indicadores derivados com fórmula e dependências rastreáveis.</small>
          </div>
          <div>
            <span className="home-v2-data-label market">Mercado</span>
            <strong>Fonte ainda não integrada</strong>
            <small>Preço, consenso e similares só entram com fonte adequada.</small>
          </div>
        </div>
      </section>
    </>
  );
}

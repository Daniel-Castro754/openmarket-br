import Link from "next/link";

import { AssetSearch } from "./asset-search";

const rankingCards = [
  {
    title: "Crescimento",
    metric: "Receita e lucro",
    description: "Compare evolução anual e trimestral usando fatos oficiais da CVM.",
  },
  {
    title: "Rentabilidade",
    metric: "Margens e ROE",
    description: "Encontre empresas com retorno e eficiência operacional consistentes.",
  },
  {
    title: "Balanço",
    metric: "Caixa e dívida",
    description: "Observe liquidez, dívida bruta e dívida líquida no mesmo fechamento.",
  },
  {
    title: "Documentos",
    metric: "Eventos e resultados",
    description: "Acompanhe comunicados, apresentações e documentos oficiais da CVM.",
  },
];

const productCards = [
  {
    kicker: "ATIVOS",
    title: "Fundamentos em uma única página",
    text: "Históricos, margens, retorno, caixa, dívida e proveniência sem esconder a origem dos números.",
    href: "/ativos/PETR4",
    link: "Abrir PETR4",
  },
  {
    kicker: "DOCUMENT HUB",
    title: "Relatórios corporativos",
    text: "Biblioteca pública por ticker, período e tipo, com acesso direto ao documento oficial.",
    href: "/relatorios?ticker=PETR4",
    link: "Explorar documentos",
  },
  {
    kicker: "OPEN DATA",
    title: "Dados que podem ser auditados",
    text: "B3 e CVM entram por providers substituíveis, com fonte, referência e política de uso preservadas.",
    href: "/relatorios",
    link: "Ver proveniência",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <section className="market-hero">
        <div className="hero-copy">
          <span className="eyebrow">MERCADO BRASILEIRO • OPEN SOURCE</span>
          <h1>Dados para investir com contexto.</h1>
          <p>
            Pesquise ações, acompanhe fundamentos, leia documentos oficiais e compare sinais sem perder a
            proveniência dos dados.
          </p>
          <AssetSearch />
          <div className="hero-trust-row">
            <span>CVM</span>
            <span>B3</span>
            <span>PostgreSQL</span>
            <span>Dados rastreáveis</span>
          </div>
        </div>

        <aside className="hero-market-card">
          <div className="market-card-heading">
            <div>
              <span className="eyebrow">VISÃO RÁPIDA</span>
              <h2>OpenMarket BR</h2>
            </div>
            <span className="live-dot">base local</span>
          </div>
          <div className="market-stat-list">
            <div>
              <span>Fundamentos</span>
              <strong>DFP + ITR</strong>
              <small>Séries anuais e trimestrais com proveniência</small>
            </div>
            <div>
              <span>Documentos</span>
              <strong>IPE / CVM</strong>
              <small>Comunicados e documentos oficiais por ticker</small>
            </div>
            <div>
              <span>Metodologia</span>
              <strong>Rastreável</strong>
              <small>Fonte, data de referência e derivação preservadas</small>
            </div>
          </div>
          <Link className="market-card-link" href="/ativos/PETR4">
            Ver visão da ação →
          </Link>
        </aside>
      </section>

      <section className="market-section" id="rankings">
        <div className="market-section-heading">
          <div>
            <span className="eyebrow">RANKINGS</span>
            <h2>Encontre oportunidades por fundamento</h2>
          </div>
          <p>
            A estrutura visual já está preparada para rankings. Os resultados serão liberados apenas quando o
            universo sincronizado tiver dados suficientes — sem preencher posições com dados fictícios.
          </p>
        </div>
        <div className="ranking-grid">
          {rankingCards.map((card, index) => (
            <article className="ranking-card" key={card.title}>
              <div className="ranking-number">0{index + 1}</div>
              <span className="ranking-metric">{card.metric}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="ranking-state">Universo em expansão</span>
            </article>
          ))}
        </div>
      </section>

      <section className="market-section">
        <div className="market-section-heading compact-heading">
          <div>
            <span className="eyebrow">EXPLORE</span>
            <h2>Pesquisa, fundamentos e documentos</h2>
          </div>
        </div>
        <div className="product-grid">
          {productCards.map((card) => (
            <article className="product-card" key={card.title}>
              <span className="eyebrow">{card.kicker}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <Link href={card.href}>{card.link} →</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

import { AssetSearch } from "./asset-search";

const quickLinks = [
  { label: "Listas", detail: "Screener compacto", href: "/listas" },
  { label: "Análises", detail: "Consumo e atividade", href: "/analises" },
  { label: "Macroeconomia", detail: "BCB + Focus", href: "/macroeconomia" },
  { label: "Calculadoras", detail: "Simulações financeiras", href: "/calculadoras" },
  { label: "Relatórios", detail: "Document Hub", href: "/relatorios" },
];

const rankingCards = [
  {
    title: "Crescimento",
    metric: "Receita e lucro",
    description: "Evolução anual e trimestral a partir dos fatos publicados na CVM.",
  },
  {
    title: "Rentabilidade",
    metric: "Margens e ROE",
    description: "Eficiência operacional e retorno reunidos em uma leitura comparável.",
  },
  {
    title: "Balanço",
    metric: "Caixa e dívida",
    description: "Liquidez, dívida bruta e dívida líquida no mesmo fechamento contábil.",
  },
  {
    title: "Documentos",
    metric: "Eventos e resultados",
    description: "Comunicados, apresentações e documentos oficiais organizados por empresa.",
  },
];

const productCards = [
  {
    kicker: "ATIVOS",
    title: "Empresa em uma única tela",
    text: "Resultados, balanço, caixa, margens e documentos com origem preservada.",
    href: "/ativos/PETR4",
    link: "Abrir PETR4",
  },
  {
    kicker: "LISTAS",
    title: "Compare muitas empresas",
    text: "Escolha listas prontas ou monte sua própria combinação de indicadores.",
    href: "/listas",
    link: "Abrir listas",
  },
  {
    kicker: "ANÁLISES",
    title: "Economia real no contexto",
    text: "Consumo, atividade, inflação e séries oficiais do IBGE em painéis compactos.",
    href: "/analises",
    link: "Ver análises",
  },
  {
    kicker: "DOCUMENTOS",
    title: "Fonte primária sempre perto",
    text: "Navegue pelos documentos públicos por ticker, período e tipo sem perder a proveniência.",
    href: "/relatorios?ticker=PETR4",
    link: "Explorar documentos",
  },
];

export default function Home() {
  return (
    <main className="home-page home-dashboard-page">
      <section className="home-overview">
        <div className="hero-copy home-hero-copy">
          <span className="eyebrow">MERCADO BRASILEIRO • DADOS RASTREÁVEIS</span>
          <h1>Dados para investir com contexto.</h1>
          <p>
            Fundamentos, documentos oficiais, macroeconomia e análises econômicas em uma interface feita para
            pesquisar rápido e aprofundar quando necessário.
          </p>
          <AssetSearch />
          <div className="hero-trust-row">
            <span>CVM</span>
            <span>B3</span>
            <span>Banco Central</span>
            <span>IBGE</span>
          </div>
        </div>

        <aside className="home-coverage-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">PESQUISA CONECTADA</span>
              <h2>Do dado primário ao contexto.</h2>
            </div>
            <span className="live-dot">open source</span>
          </div>
          <div className="home-coverage-grid">
            <div>
              <span>Fundamentos</span>
              <strong>DFP + ITR</strong>
              <small>CVM</small>
            </div>
            <div>
              <span>Economia</span>
              <strong>BCB + IBGE</strong>
              <small>Macro e atividade</small>
            </div>
            <div>
              <span>Documentos</span>
              <strong>IPE</strong>
              <small>Fonte oficial</small>
            </div>
          </div>
          <Link className="market-card-link" href="/ativos/PETR4">
            Abrir visão de uma empresa →
          </Link>
        </aside>
      </section>

      <nav className="home-quick-links" aria-label="Atalhos do OpenMarket">
        {quickLinks.map((item) => (
          <Link href={item.href} key={item.href}>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </nav>

      <section className="market-section home-ranking-section" id="rankings">
        <div className="market-section-heading home-section-heading">
          <div>
            <span className="eyebrow">RANKINGS</span>
            <h2>Fundamentos para descobrir e comparar</h2>
          </div>
          <Link href="/listas">Abrir screener →</Link>
        </div>
        <div className="ranking-grid home-ranking-grid">
          {rankingCards.map((card, index) => (
            <Link className="ranking-card home-ranking-card" href="/listas" key={card.title}>
              <span className="home-ranking-index">0{index + 1}</span>
              <div>
                <span className="ranking-metric">{card.metric}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <span className="home-ranking-action">Explorar →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="market-section home-products-section">
        <div className="market-section-heading compact-heading home-section-heading">
          <div>
            <span className="eyebrow">PESQUISA</span>
            <h2>Escolha o nível de profundidade</h2>
          </div>
        </div>
        <div className="home-product-grid">
          {productCards.map((card) => (
            <article className="product-card home-product-card" key={card.title}>
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

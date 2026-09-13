import Link from "next/link";

import { AssetSearch } from "./asset-search";

const workspaceLinks = [
  { label: "Empresas", detail: "Abra uma companhia e siga do indicador até a fonte.", href: "/ativos/PETR4", meta: "CVM" },
  { label: "Screener", detail: "Combine filtros fundamentalistas sobre o universo sincronizado.", href: "/screener", meta: "CVM · cálculo" },
  { label: "Rankings", detail: "Ordene empresas pelos indicadores fundamentalistas disponíveis.", href: "/rankings", meta: "CVM · cálculo" },
  { label: "Últimos resultados", detail: "DFP e ITR recentes conectados ao documento original.", href: "/resultados", meta: "CVM · IPE" },
  { label: "Macroeconomia", detail: "Selic, Focus e séries oficiais em contexto.", href: "/macroeconomia", meta: "BCB" },
];

const discoveryModules = [
  {
    kicker: "EMPRESAS",
    title: "Visão de empresa",
    text: "Fundamentos, histórico, documentos e proveniência em uma única tela.",
    href: "/ativos/PETR4",
    action: "Abrir PETR4",
    status: "Disponível",
  },
  {
    kicker: "PESQUISA",
    title: "Listas",
    text: "Navegue pela base atual e use métricas financeiras para reduzir o universo de análise.",
    href: "/listas",
    action: "Abrir listas",
    status: "Disponível",
  },
  {
    kicker: "PESQUISA",
    title: "Screener avançado",
    text: "Combine crescimento, margens, ROE, resultados e balanço com lógica E e colunas configuráveis.",
    href: "/screener",
    action: "Montar filtros",
    status: "Disponível",
  },
  {
    kicker: "DESCUBERTA",
    title: "Setores",
    text: "A tela e a metodologia estão preparadas, mas a classificação setorial aguarda uma fonte rastreável.",
    href: "/setores",
    action: "Ver status",
    status: "Fonte pendente",
  },
  {
    kicker: "DESCUBERTA",
    title: "Rankings",
    text: "Crescimento, retorno e margens ordenados com período e fórmula explícitos.",
    href: "/rankings",
    action: "Abrir rankings",
    status: "Disponível",
  },
  {
    kicker: "RESULTADOS",
    title: "Últimos resultados",
    text: "Central de DFP e ITR recentes conectada aos documentos originais e às páginas das empresas.",
    href: "/resultados",
    action: "Ver resultados",
    status: "Disponível",
  },
  {
    kicker: "COMPARAÇÃO",
    title: "Comparar empresas",
    text: "Coloque companhias lado a lado sem perder período, unidade e origem do dado.",
    href: "/comparar",
    action: "Comparar",
    status: "Disponível",
  },
];

const contextModules = [
  {
    kicker: "ECONOMIA",
    title: "Macroeconomia",
    text: "Séries do Banco Central e expectativas Focus para ler o ambiente econômico.",
    href: "/macroeconomia",
    action: "Abrir macro",
  },
  {
    kicker: "ANÁLISES",
    title: "Economia real",
    text: "Consumo, atividade e séries oficiais do IBGE organizadas para pesquisa aplicada.",
    href: "/analises",
    action: "Ver análises",
  },
  {
    kicker: "FONTES",
    title: "Document Hub",
    text: "Pesquise documentos públicos e volte rapidamente da evidência ao dado estruturado.",
    href: "/relatorios",
    action: "Explorar documentos",
  },
  {
    kicker: "FERRAMENTAS",
    title: "Calculadoras",
    text: "Simulações financeiras separadas da base factual para manter contexto e metodologia claros.",
    href: "/calculadoras",
    action: "Abrir ferramentas",
  },
];

export default function Home() {
  return (
    <main className="home-page home-dashboard-page">
      <section className="home-overview home-workspace-overview">
        <div className="hero-copy home-hero-copy">
          <span className="eyebrow">OPEN FINANCIAL INTELLIGENCE · BRASIL</span>
          <h1>Pesquise a empresa. Entenda o número. Chegue à fonte.</h1>
          <p>
            O OpenMarket BR reúne fundamentos, documentos oficiais e contexto econômico em um fluxo de pesquisa
            orientado por proveniência, período e metodologia.
          </p>
          <AssetSearch />
          <div className="hero-trust-row">
            <span>CVM</span>
            <span>Banco Central</span>
            <span>IBGE</span>
            <span>dados públicos</span>
          </div>
        </div>

        <aside className="home-workspace-panel" aria-label="Entradas principais de pesquisa">
          <div className="home-workspace-heading">
            <div>
              <span className="eyebrow">COMEÇAR PESQUISA</span>
              <h2>Escolha o ponto de entrada.</h2>
            </div>
            <span className="home-status-badge available">ativo</span>
          </div>
          <div className="home-workspace-list">
            {workspaceLinks.map((item, index) => (
              <Link href={item.href} className="home-workspace-link" key={item.href}>
                <span className="home-workspace-index">0{index + 1}</span>
                <span className="home-workspace-copy">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="home-workspace-meta">{item.meta}</span>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="home-discovery-section" aria-labelledby="home-discovery-title">
        <div className="home-discovery-heading">
          <div>
            <span className="eyebrow">DESCOBERTA</span>
            <h2 id="home-discovery-title">Do universo de empresas até a análise individual</h2>
            <p>Recursos ativos usam apenas dados que a base consegue sustentar; lacunas metodológicas ficam explícitas.</p>
          </div>
          <Link href="/screener">Abrir screener →</Link>
        </div>

        <div className="home-discovery-grid">
          {discoveryModules.map((module) => {
            const available = module.status === "Disponível";
            const content = (
              <>
                <div className="home-module-topline">
                  <span className="eyebrow">{module.kicker}</span>
                  <span className={`home-status-badge ${available ? "available" : "planned"}`}>
                    {module.status}
                  </span>
                </div>
                <h3>{module.title}</h3>
                <p>{module.text}</p>
                <span className={`home-module-action ${available ? "" : "muted"}`}>{module.action} →</span>
              </>
            );

            return (
              <Link className={`home-module-card ${available ? "" : "planned"}`} href={module.href} key={module.title}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-context-section" aria-labelledby="home-context-title">
        <div className="home-discovery-heading compact">
          <div>
            <span className="eyebrow">CONTEXTO E FONTES</span>
            <h2 id="home-context-title">Complete a leitura sem sair do fluxo</h2>
          </div>
        </div>
        <div className="home-context-grid">
          {contextModules.map((module) => (
            <Link className="home-context-card" href={module.href} key={module.title}>
              <span className="eyebrow">{module.kicker}</span>
              <h3>{module.title}</h3>
              <p>{module.text}</p>
              <span>{module.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-principle-strip" aria-label="Princípios de dados do OpenMarket BR">
        <div>
          <strong>Oficial</strong>
          <span>Dado primário identificado pela fonte pública.</span>
        </div>
        <div>
          <strong>Calculado</strong>
          <span>Indicador derivado com fórmula e dependências explícitas.</span>
        </div>
        <div>
          <strong>Mercado</strong>
          <span>Espaço reservado para dados licenciados quando houver integração adequada.</span>
        </div>
      </section>
    </main>
  );
}

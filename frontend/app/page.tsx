import Link from "next/link";

import { HomeMacroFocusPanel } from "../components/home/home-macro-focus-panel";
import { AssetSearch } from "./asset-search";

const quickTickers = ["PETR4", "VALE3", "ITUB4", "BBAS3"];

const researchTools = [
  {
    label: "Empresas",
    detail: "Abra uma companhia e siga dos indicadores até os documentos de origem.",
    href: "/ativos/PETR4",
    meta: "CVM",
  },
  {
    label: "Listas de ativos",
    detail: "Navegue pelo universo sincronizado com visões financeiras compactas.",
    href: "/listas",
    meta: "CVM",
  },
  {
    label: "Screener",
    detail: "Combine filtros de crescimento, margem, retorno, dívida e resultados.",
    href: "/screener",
    meta: "CVM · cálculo",
  },
  {
    label: "Comparar",
    detail: "Coloque até quatro empresas na mesma régua contábil e no mesmo período.",
    href: "/comparar",
    meta: "CVM · cálculo",
  },
  {
    label: "Rankings",
    detail: "Ordene empresas por indicadores com fórmula, período e fonte explícitos.",
    href: "/rankings",
    meta: "CVM · cálculo",
  },
  {
    label: "Setores",
    detail: "Classificação setorial será ativada apenas quando houver fonte rastreável adequada.",
    href: "/setores",
    meta: "fonte pendente",
    pending: true,
  },
];

const contextTools = [
  {
    label: "Últimos resultados",
    detail: "DFP e ITR recentes ligados à empresa e ao documento original.",
    href: "/resultados",
    meta: "CVM · IPE",
  },
  {
    label: "Document Hub",
    detail: "Pesquise relatórios, fatos relevantes e outros documentos públicos.",
    href: "/relatorios",
    meta: "fontes oficiais",
  },
  {
    label: "Macroeconomia",
    detail: "Selic, Focus e séries do Banco Central para contextualizar a análise.",
    href: "/macroeconomia",
    meta: "BCB",
  },
  {
    label: "Economia real",
    detail: "Séries oficiais do IBGE organizadas para pesquisa aplicada.",
    href: "/analises",
    meta: "IBGE",
  },
  {
    label: "Calculadoras",
    detail: "Ferramentas de simulação separadas da base factual do produto.",
    href: "/calculadoras",
    meta: "ferramentas",
  },
];

function ToolRow({
  item,
  index,
}: {
  item: { label: string; detail: string; href: string; meta: string; pending?: boolean };
  index: number;
}) {
  return (
    <Link className={`research-home-row${item.pending ? " pending" : ""}`} href={item.href}>
      <span className="research-home-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="research-home-row-copy">
        <strong>{item.label}</strong>
        <small>{item.detail}</small>
      </span>
      <span className="research-home-row-meta">{item.meta}</span>
      <span className="research-home-row-arrow" aria-hidden="true">→</span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="research-home home-v2">
      <section className="home-v2-hero" aria-labelledby="home-v2-title">
        <div className="home-v2-search-panel">
          <span className="home-v2-kicker">PESQUISA DE MERCADO</span>
          <h1 id="home-v2-title">Pesquise empresas. Entenda os números.</h1>
          <p>
            Demonstrações, indicadores calculados e documentos oficiais em um só lugar, sempre com período e origem identificados.
          </p>

          <div className="home-v2-search-wrap">
            <AssetSearch />
          </div>

          <div className="home-v2-quick-searches" aria-label="Acessos rápidos de empresas">
            <span>Ir direto para</span>
            <div>
              {quickTickers.map((ticker) => (
                <Link href={`/ativos/${ticker}`} key={ticker}>{ticker}</Link>
              ))}
            </div>
          </div>
        </div>

        <HomeMacroFocusPanel />
      </section>

      <section className="research-home-source-strip" aria-label="Fontes e tratamento dos dados">
        <div><strong>CVM</strong><span>demonstrações e documentos corporativos</span></div>
        <div><strong>BCB</strong><span>macroeconomia e expectativas</span></div>
        <div><strong>IBGE</strong><span>atividade e economia real</span></div>
        <div><strong>OpenMarket</strong><span>indicadores calculados com fórmula explícita</span></div>
      </section>

      <section className="research-home-workspace" aria-label="Áreas de pesquisa">
        <div className="research-home-panel">
          <header className="research-home-panel-heading">
            <div>
              <span className="eyebrow">EMPRESAS</span>
              <h2>Pesquisa fundamentalista</h2>
            </div>
            <span>universo sincronizado</span>
          </header>
          <div className="research-home-list">
            {researchTools.map((item, index) => <ToolRow item={item} index={index} key={item.href} />)}
          </div>
        </div>

        <div className="research-home-panel">
          <header className="research-home-panel-heading">
            <div>
              <span className="eyebrow">CONTEXTO E FONTES</span>
              <h2>Documentos e economia</h2>
            </div>
            <span>fontes públicas</span>
          </header>
          <div className="research-home-list">
            {contextTools.map((item, index) => <ToolRow item={item} index={index} key={item.href} />)}
          </div>
        </div>
      </section>

      <section className="research-home-method" aria-label="Política de proveniência">
        <div>
          <span className="research-home-method-label official">Oficial</span>
          <p>Dado primário identificado com a fonte pública e o período correspondente.</p>
        </div>
        <div>
          <span className="research-home-method-label calculated">Calculado</span>
          <p>Indicador derivado pelo OpenMarket com fórmula e dependências rastreáveis.</p>
        </div>
        <div>
          <span className="research-home-method-label market">Mercado</span>
          <p>Dados de preço e consenso só entram quando existir integração licenciada adequada.</p>
        </div>
      </section>
    </main>
  );
}

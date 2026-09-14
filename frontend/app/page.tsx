import Link from "next/link";

import { HomeDiscoveryPolish } from "../components/home/home-discovery-polish";
import { HomeMacroFocusPanel } from "../components/home/home-macro-focus-panel";
import { HomeResearchWorkspace } from "../components/home/home-research-workspace";
import { AssetSearch } from "./asset-search";

const quickTickers = ["PETR4", "VALE3", "ITUB4", "BBAS3"];

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

      <HomeResearchWorkspace />
      <HomeDiscoveryPolish />
    </main>
  );
}

import Link from "next/link";

export default function SectorsPage() {
  return (
    <main className="discovery-page sectors-page">
      <header className="discovery-header">
        <div>
          <span className="eyebrow">SETORES · CLASSIFICAÇÃO</span>
          <h1>Setores</h1>
          <p>
            A estrutura visual está pronta, mas a classificação setorial ainda não foi integrada à base. Para evitar
            misturar categorias improvisadas com dados oficiais, o OpenMarket BR não agrupa empresas por setor até
            existir uma fonte definida, versionada e rastreável.
          </p>
        </div>
        <div className="discovery-header-stats" aria-label="Status da classificação setorial">
          <div><strong>0</strong><span>setores publicados</span></div>
          <div><strong>pendente</strong><span>fonte setorial</span></div>
          <div><strong>sem inferência</strong><span>regra atual</span></div>
        </div>
      </header>

      <section className="sector-unavailable-panel">
        <div className="sector-status-icon" aria-hidden="true">S</div>
        <div>
          <span className="eyebrow">FONTE AINDA NÃO INTEGRADA</span>
          <h2>Classificação setorial desativada por metodologia</h2>
          <p>
            Hoje a base conhece empresa, ticker, demonstrações financeiras, documentos, governança e outros campos,
            mas não possui um campo setorial com proveniência suficiente para alimentar filtros, rankings e medianas.
          </p>
        </div>
        <span className="source-pill muted">Planejado</span>
      </section>

      <section className="sector-roadmap-grid" aria-label="O que será habilitado com a fonte setorial">
        <article>
          <span className="eyebrow">01 · DESCOBERTA</span>
          <h3>Empresas por setor</h3>
          <p>Lista de companhias agrupadas pela classificação integrada, sem mapeamentos manuais ocultos.</p>
        </article>
        <article>
          <span className="eyebrow">02 · BENCHMARK</span>
          <h3>Medianas setoriais</h3>
          <p>ROE, margens, crescimento e alavancagem comparados somente entre pares compatíveis.</p>
        </article>
        <article>
          <span className="eyebrow">03 · RANKINGS</span>
          <h3>Filtro por setor</h3>
          <p>Os rankings atuais poderão ser recortados por setor assim que a classificação estiver disponível.</p>
        </article>
      </section>

      <section className="sector-current-paths">
        <div>
          <span className="eyebrow">ENQUANTO ISSO</span>
          <h2>Use os caminhos já suportados pela base</h2>
          <p>Você ainda pode descobrir empresas por indicadores, listas e documentos sem recorrer a setor inferido.</p>
        </div>
        <div className="sector-path-links">
          <Link href="/rankings">Abrir rankings →</Link>
          <Link href="/listas">Explorar listas →</Link>
          <Link href="/resultados">Ver últimos resultados →</Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function SectorsPage() {
  return (
    <main className="discovery-page sectors-page">
      <header className="discovery-header sectors-header">
        <div>
          <span className="eyebrow">SETORES · FONTE PENDENTE</span>
          <h1>Setores</h1>
          <p>
            A base ainda não possui classificação setorial com proveniência suficiente. Enquanto essa fonte não for
            integrada e versionada, o OpenMarket BR não agrupa empresas nem calcula comparações por setor.
          </p>
        </div>
      </header>

      <section className="sector-unavailable-panel sector-methodology-notice">
        <div>
          <span className="eyebrow">REGRA ATUAL</span>
          <h2>Classificação setorial desativada</h2>
          <p>
            Empresas, tickers, demonstrações, documentos e governança continuam disponíveis. Filtros, rankings e
            medianas setoriais só serão habilitados quando houver uma classificação rastreável na base.
          </p>
        </div>
        <span className="source-pill muted">Sem inferência</span>
      </section>

      <section className="sector-current-paths">
        <div>
          <span className="eyebrow">PESQUISA DISPONÍVEL</span>
          <h2>Use dados já suportados pela base</h2>
          <p>Descubra e compare empresas por indicadores, documentos e resultados sem recorrer a setor inferido.</p>
        </div>
        <div className="sector-path-links">
          <Link href="/screener">Abrir screener →</Link>
          <Link href="/rankings">Abrir rankings →</Link>
          <Link href="/resultados">Ver resultados →</Link>
        </div>
      </section>
    </main>
  );
}

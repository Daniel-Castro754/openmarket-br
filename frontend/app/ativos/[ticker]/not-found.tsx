import Link from "next/link";

export default function AssetNotFound() {
  return (
    <main className="asset-page">
      <nav className="asset-nav">
        <Link href="/">← OpenMarket BR</Link>
      </nav>
      <section className="panel empty-state">
        <span className="eyebrow">ATIVO NÃO DISPONÍVEL</span>
        <h1>Este ticker ainda não está sincronizado.</h1>
        <p>
          O visualizador público mostra somente dados já persistidos e validados. Tente outro ticker
          ou volte após a próxima sincronização da base.
        </p>
        <Link className="text-link" href="/">Voltar para a busca</Link>
      </section>
    </main>
  );
}

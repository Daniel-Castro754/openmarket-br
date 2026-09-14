import Link from "next/link";

export function AssetComparePanel({ ticker }: { ticker: string }) {
  return (
    <aside className="asset-compare-panel" aria-labelledby="asset-compare-panel-title">
      <div>
        <span className="eyebrow">COMPARAÇÃO</span>
        <h2 id="asset-compare-panel-title">Compare {ticker} com outras empresas</h2>
        <p>
          Leve o ativo atual para o comparador e adicione outras empresas para analisar os mesmos fundamentos e
          períodos lado a lado.
        </p>
      </div>

      <div className="asset-compare-current">
        <span>Ativo de partida</span>
        <strong>{ticker}</strong>
      </div>

      <div className="asset-compare-actions">
        <Link className="asset-compare-primary" href={`/comparar?tickers=${ticker}`}>
          Abrir comparador →
        </Link>
        <Link href="/screener">Encontrar empresas no Screener</Link>
      </div>

      <small>
        Empresas semelhantes não são sugeridas automaticamente enquanto não houver uma classificação setorial
        rastreável integrada.
      </small>
    </aside>
  );
}

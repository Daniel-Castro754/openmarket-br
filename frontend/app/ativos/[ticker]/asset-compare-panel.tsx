import Link from "next/link";

export function AssetComparePanel({ ticker }: { ticker: string }) {
  return (
    <aside className="asset-compare-panel" aria-labelledby="asset-compare-panel-title">
      <div>
        <span className="eyebrow">COMPARAÇÃO</span>
        <h2 id="asset-compare-panel-title">Coloque {ticker} lado a lado</h2>
        <p>
          Compare fundamentos com outras empresas usando as mesmas métricas e períodos, sem sugerir pares por setor enquanto a classificação setorial não estiver integrada.
        </p>
      </div>

      <div className="asset-compare-current">
        <span>Ativo atual</span>
        <strong>{ticker}</strong>
      </div>

      <div className="asset-compare-actions">
        <Link className="asset-compare-primary" href={`/comparar?tickers=${ticker}`}>
          Abrir comparador →
        </Link>
        <Link href="/screener">Encontrar empresas no Screener</Link>
      </div>

      <small>O OpenMarket não infere concorrentes ou empresas semelhantes sem uma fonte setorial rastreável.</small>
    </aside>
  );
}

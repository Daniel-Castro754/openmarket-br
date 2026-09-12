import type { FinancialSeries } from "../lib/api";

function formatValue(value: string, currency: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

export function FinancialBarChart({ series }: { series: FinancialSeries }) {
  const points = series.points.slice(-6);
  const maxValue = Math.max(...points.map((point) => Math.abs(Number(point.value))), 1);

  return (
    <article className="panel series-card">
      <div className="series-heading">
        <div>
          <span className="eyebrow">HISTÓRICO ANUAL</span>
          <h2>{series.label}</h2>
        </div>
        <span className="series-account">
          {series.statement} · {series.account_code}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="series-empty">Nenhum DFP anual disponível para esta métrica.</p>
      ) : (
        <div className="series-chart" aria-label={`Série anual de ${series.label}`}>
          {points.map((point) => {
            const numeric = Number(point.value);
            const width = Math.max((Math.abs(numeric) / maxValue) * 100, 2);
            const year = point.period_end.slice(0, 4);
            return (
              <div className="series-row" key={`${point.period_end}-${point.filing_version ?? 0}`}>
                <span className="series-year">{year}</span>
                <div className="series-track">
                  <span
                    className={`series-bar ${numeric < 0 ? "series-bar-negative" : ""}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <strong>{formatValue(point.value, point.currency)}</strong>
              </div>
            );
          })}
        </div>
      )}

      <footer className="series-footer">
        <span>DFP consolidada</span>
        {points.at(-1)?.filing_version != null && (
          <span>Última versão CVM: {points.at(-1)?.filing_version}</span>
        )}
      </footer>
    </article>
  );
}

import type { FinancialSeries } from "../lib/api";

function formatValue(value: string, currency: string | null | undefined, unit: FinancialSeries["unit"]) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;

  if (unit === "percent") {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(numeric)}%`;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

function periodLabel(periodEnd: string, frequency: FinancialSeries["frequency"]) {
  const [year, month] = periodEnd.split("-").map(Number);
  if (frequency === "annual") return String(year);

  const quarter = Math.max(1, Math.min(4, Math.ceil(month / 3)));
  return `${quarter}T${String(year).slice(-2)}`;
}

export function FinancialBarChart({ series }: { series: FinancialSeries }) {
  const limit = series.frequency === "annual" ? 6 : 8;
  const points = series.points.slice(-limit);
  const maxValue = Math.max(...points.map((point) => Math.abs(Number(point.value))), 1);
  const frequencyLabel = series.frequency === "annual" ? "HISTÓRICO ANUAL" : "HISTÓRICO TRIMESTRAL";
  const accountLabel = series.statement && series.account_code
    ? `${series.statement} · ${series.account_code}`
    : "Métrica derivada";

  return (
    <article className="panel series-card">
      <div className="series-heading">
        <div>
          <span className="eyebrow">{frequencyLabel}</span>
          <h2>{series.label}</h2>
        </div>
        <span className="series-account">{accountLabel}</span>
      </div>

      {points.length === 0 ? (
        <p className="series-empty">Nenhum dado comparável disponível para esta métrica.</p>
      ) : (
        <div className="series-chart" aria-label={`Série ${series.frequency} de ${series.label}`}>
          {points.map((point) => {
            const numeric = Number(point.value);
            const width = Math.max((Math.abs(numeric) / maxValue) * 100, 2);
            return (
              <div className="series-row" key={`${point.period_end}-${point.filing_version ?? 0}`}>
                <span className="series-year">{periodLabel(point.period_end, series.frequency)}</span>
                <div className="series-track">
                  <span
                    className={`series-bar ${numeric < 0 ? "series-bar-negative" : ""}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <strong>{formatValue(point.value, point.currency, series.unit)}</strong>
              </div>
            );
          })}
        </div>
      )}

      <footer className="series-footer">
        <span>
          {series.frequency === "annual" ? "DFP consolidada" : "CVM consolidada · trimestre isolado"}
        </span>
        {series.formula ? (
          <span>Calculado a partir dos fatos CVM</span>
        ) : points.at(-1)?.filing_version != null ? (
          <span>Última versão CVM: {points.at(-1)?.filing_version}</span>
        ) : null}
      </footer>
    </article>
  );
}

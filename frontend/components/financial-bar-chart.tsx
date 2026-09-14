import type { FinancialSeries, FinancialSeriesPoint } from "../lib/api";

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

function derivationTitle(point: FinancialSeriesPoint) {
  const sources = point.input_sources.map((source) => source.source_name).join(" + ");
  return [point.derivation, sources ? `Fontes: ${sources}` : null].filter(Boolean).join(" • ");
}

function DerivedMark({ point }: { point: FinancialSeriesPoint }) {
  if (!point.derived) return null;

  return (
    <span
      className="derived-mark"
      title={derivationTitle(point)}
      aria-label={`Valor derivado: ${point.derivation ?? "cálculo OpenMarket"}`}
    >
      D
    </span>
  );
}

export function FinancialBarChart({ series }: { series: FinancialSeries }) {
  const limit = series.frequency === "annual" ? 6 : 8;
  const points = series.points.slice(-limit);
  const maxValue = Math.max(...points.map((point) => Math.abs(Number(point.value))), 1);
  const frequencyLabel = series.frequency === "annual" ? "HISTÓRICO ANUAL" : "HISTÓRICO TRIMESTRAL";
  const accountLabel = series.statement && series.account_code
    ? `${series.statement} · ${series.account_code}`
    : "Métrica derivada";
  const hasDerivedPoints = points.some((point) => point.derived);
  const latestFiledPoint = [...points]
    .reverse()
    .find((point) => !point.derived && point.filing_version != null);
  const singlePoint = points.length === 1 ? points[0] : null;
  const cardClassName = [
    "panel",
    "series-card",
    series.frequency === "annual" ? "series-card-annual" : "series-card-quarterly",
    singlePoint ? "series-card-single" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      <div className="series-heading">
        <div>
          <span className="eyebrow">{frequencyLabel}</span>
          <h2>{series.label}</h2>
        </div>
        <span className="series-account">{accountLabel}</span>
      </div>

      {points.length === 0 ? (
        <p className="series-empty">Nenhum dado comparável disponível para esta métrica.</p>
      ) : singlePoint ? (
        <div className="series-single-point" aria-label={`Valor ${series.frequency} de ${series.label}`}>
          <div className="series-single-copy">
            <span>
              {periodLabel(singlePoint.period_end, series.frequency)}
              <DerivedMark point={singlePoint} />
            </span>
            <small>1 período disponível</small>
          </div>
          <strong>{formatValue(singlePoint.value, singlePoint.currency, series.unit)}</strong>
        </div>
      ) : (
        <div className="series-chart" aria-label={`Série ${series.frequency} de ${series.label}`}>
          {points.map((point) => {
            const numeric = Number(point.value);
            const width = Math.max((Math.abs(numeric) / maxValue) * 100, 2);
            return (
              <div className="series-row" key={`${point.period_end}-${point.filing_version ?? 0}-${point.derived}`}>
                <span className="series-year">
                  {periodLabel(point.period_end, series.frequency)}
                  <DerivedMark point={point} />
                </span>
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
        <span>{series.frequency === "annual" ? "DFP consolidada" : "ITR/DFP consolidada"}</span>
        {hasDerivedPoints ? (
          <span>D = valor calculado com proveniência</span>
        ) : series.formula ? (
          <span>Calculado a partir dos fatos CVM</span>
        ) : latestFiledPoint?.filing_version != null ? (
          <span>Última versão CVM: {latestFiledPoint.filing_version}</span>
        ) : null}
      </footer>
    </article>
  );
}

import type { FinancialSeries, FinancialSeriesPoint } from "../lib/api";
import { provenanceKind, provenanceLabel, sourceFreshnessLabel } from "../lib/data-semantics";
import { formatFinancialValue, formatPeriod } from "../lib/format";

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

function pointValueLabel(series: FinancialSeries, point: FinancialSeriesPoint) {
  return formatFinancialValue(point.value, series.unit, {
    currency: point.currency,
    percentDigits: 1,
  });
}

function pointInspectionLabel(series: FinancialSeries, point: FinancialSeriesPoint) {
  const period = formatPeriod(point.period_end, series.frequency);
  const provenance = provenanceLabel(provenanceKind({ derived: point.derived || Boolean(series.formula), source: point.source }));
  return `${period} · ${pointValueLabel(series, point)} · ${provenance}`;
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
  const latestPoint = points.at(-1) ?? null;
  const latestFiledPoint = [...points]
    .reverse()
    .find((point) => !point.derived && point.filing_version != null);
  const singlePoint = points.length === 1 ? points[0] : null;
  const provenance = provenanceLabel(provenanceKind({
    derived: hasDerivedPoints || Boolean(series.formula),
    source: latestPoint?.source,
  }));
  const freshness = sourceFreshnessLabel(latestPoint?.source);
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
        <div
          className="series-single-point"
          aria-label={pointInspectionLabel(series, singlePoint)}
          title={pointInspectionLabel(series, singlePoint)}
        >
          <div className="series-single-copy">
            <span>
              {formatPeriod(singlePoint.period_end, series.frequency)}
              <DerivedMark point={singlePoint} />
            </span>
            <small>1 período disponível</small>
          </div>
          <strong>{pointValueLabel(series, singlePoint)}</strong>
        </div>
      ) : (
        <div className="series-chart" aria-label={`Série ${series.frequency} de ${series.label}`}>
          {points.map((point) => {
            const numeric = Number(point.value);
            const width = Math.max((Math.abs(numeric) / maxValue) * 100, 2);
            const inspectionLabel = pointInspectionLabel(series, point);
            return (
              <div
                className="series-row"
                key={`${point.period_end}-${point.filing_version ?? 0}-${point.derived}`}
                aria-label={inspectionLabel}
                title={inspectionLabel}
              >
                <span className="series-year">
                  {formatPeriod(point.period_end, series.frequency)}
                  <DerivedMark point={point} />
                </span>
                <div className="series-track" aria-hidden="true">
                  <span
                    className={`series-bar ${numeric < 0 ? "series-bar-negative" : ""}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <strong>{pointValueLabel(series, point)}</strong>
              </div>
            );
          })}
        </div>
      )}

      <footer className="series-footer">
        <span>{provenance} · {series.frequency === "annual" ? "DFP consolidada" : "ITR/DFP consolidada"}</span>
        {hasDerivedPoints ? (
          <span>D = valor calculado com proveniência</span>
        ) : series.formula ? (
          <span>Calculado a partir dos fatos CVM</span>
        ) : latestFiledPoint?.filing_version != null ? (
          <span>Última versão CVM: {latestFiledPoint.filing_version}</span>
        ) : null}
        {freshness ? <span>{freshness}</span> : null}
      </footer>
    </article>
  );
}

import Link from "next/link";

import { getMacroSnapshot, type MacroIndicator } from "../../lib/macro-api";

function formatMacroValue(indicator: MacroIndicator) {
  const numeric = Number(indicator.latest_value);
  if (!Number.isFinite(numeric)) return indicator.latest_value;

  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: indicator.unit.includes("R$/") ? 2 : 1,
  }).format(numeric);

  if (indicator.unit.startsWith("%")) return `${formatted}%`;
  if (indicator.unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

function formatReferenceDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function sparklinePoints(indicator: MacroIndicator) {
  const points = indicator.points.slice(-18);
  if (points.length < 2) return null;

  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (values.length !== points.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  return points
    .map((point, index) => {
      const value = Number(point.value);
      const x = (index / (points.length - 1)) * 100;
      const y = 34 - ((value - min) / spread) * 28;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export async function HomeMacroFocusPanel() {
  const snapshot = await getMacroSnapshot().catch(() => null);
  const preferredKeys = ["selic_target", "ipca_12m", "ibc_br"];
  const indicator = preferredKeys
    .map((key) => snapshot?.indicators.find((item) => item.key === key))
    .find((item): item is MacroIndicator => item != null);

  if (!indicator) {
    return (
      <aside className="home-v2-macro home-v2-macro-empty" aria-label="Brasil em foco">
        <span className="home-v2-kicker">BRASIL EM FOCO</span>
        <h2>Contexto macroeconômico</h2>
        <p>Os dados oficiais não puderam ser carregados agora.</p>
        <Link href="/macroeconomia">Abrir macroeconomia →</Link>
      </aside>
    );
  }

  const sparkline = sparklinePoints(indicator);

  return (
    <aside className="home-v2-macro" aria-label="Brasil em foco">
      <div className="home-v2-macro-heading">
        <span className="home-v2-kicker">BRASIL EM FOCO</span>
        <span className="home-v2-source-badge">Oficial</span>
      </div>

      <div className="home-v2-macro-value-row">
        <div>
          <span className="home-v2-macro-label">{indicator.label}</span>
          <strong>{formatMacroValue(indicator)}</strong>
        </div>
        <span className="home-v2-macro-date">{formatReferenceDate(indicator.reference_date)}</span>
      </div>

      <p className="home-v2-macro-description">{indicator.description}</p>

      <div className="home-v2-sparkline" aria-hidden="true">
        {sparkline ? (
          <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <line x1="0" y1="35" x2="100" y2="35" />
            <polyline points={sparkline} />
          </svg>
        ) : (
          <span>Histórico curto ainda indisponível.</span>
        )}
      </div>

      <div className="home-v2-macro-footer">
        <span>Fonte: {indicator.source.source_name}</span>
        <Link href="/macroeconomia">Ver série →</Link>
      </div>
    </aside>
  );
}

import Link from "next/link";

import { formatDateShortPtBr, formatMacroValue } from "../../lib/format";
import { getMacroSnapshot, type MacroIndicator } from "../../lib/macro-api";
import { HomeMacroInteractiveChart } from "./home-macro-interactive-chart";

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

  return (
    <aside className="home-v2-macro" aria-label="Brasil em foco">
      <div className="home-v2-macro-heading">
        <span className="home-v2-kicker">BRASIL EM FOCO</span>
        <span className="home-v2-source-badge">Oficial</span>
      </div>

      <div className="home-v2-macro-value-row">
        <div>
          <span className="home-v2-macro-label">{indicator.label}</span>
          <strong>{formatMacroValue(indicator.latest_value, indicator.unit)}</strong>
        </div>
        <span className="home-v2-macro-date">{formatDateShortPtBr(indicator.reference_date)}</span>
      </div>

      <p className="home-v2-macro-description">{indicator.description}</p>

      <div className="home-v2-sparkline">
        <HomeMacroInteractiveChart
          points={indicator.points}
          unit={indicator.unit}
          label={indicator.label}
        />
      </div>

      <div className="home-v2-macro-footer">
        <span>Fonte: {indicator.source.source_name}</span>
        <Link href="/macroeconomia">Ver série →</Link>
      </div>
    </aside>
  );
}

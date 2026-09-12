import Link from "next/link";

import { getMacroSnapshot } from "../lib/macro-api";
import styles from "./macro-ticker-bar.module.css";

function valueLabel(value: string, unit: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: unit.includes("R$/") ? 2 : 1,
  }).format(numeric);
  if (unit.startsWith("%")) return `${formatted}%`;
  if (unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

export async function MacroTickerBar() {
  const snapshot = await getMacroSnapshot().catch(() => null);
  if (!snapshot?.indicators.length) return null;

  const preferred = ["selic_target", "ipca_12m", "usd_brl", "ibc_br"];
  const indicators = preferred
    .map((key) => snapshot.indicators.find((indicator) => indicator.key === key))
    .filter((indicator) => indicator != null);

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <span className={styles.label}>Brasil agora</span>
        <div className={styles.items}>
          {indicators.map((indicator) => (
            <div className={styles.item} key={indicator.key}>
              <span>{indicator.label}</span>
              <strong>{valueLabel(indicator.latest_value, indicator.unit)}</strong>
            </div>
          ))}
        </div>
        <Link href="/macroeconomia">Ver macroeconomia →</Link>
      </div>
    </div>
  );
}

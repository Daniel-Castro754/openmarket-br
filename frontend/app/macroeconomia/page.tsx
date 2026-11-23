import Link from "next/link";

import { MacroSparkline } from "../../components/charts/macro-sparkline";
import { getMacroSnapshot, type MacroIndicator } from "../../lib/macro-api";
import styles from "./macro.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatNumber(value: string, unit: string, maximumFractionDigits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits,
    minimumFractionDigits: unit.includes("R$/") ? 2 : 1,
  }).format(numeric);
  if (unit.startsWith("%")) return `${formatted}%`;
  if (unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

function changeLabel(indicator: MacroIndicator) {
  if (indicator.change == null) return "sem comparação";
  const delta = Number(indicator.change);
  if (!Number.isFinite(delta)) return "sem comparação";
  const sign = delta > 0 ? "+" : "";
  const suffix = indicator.unit.startsWith("%") ? " p.p." : "";
  return `${sign}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(delta)}${suffix}`;
}

function movementSentence(indicator?: MacroIndicator) {
  if (!indicator || indicator.previous_value == null) return null;
  const current = Number(indicator.latest_value);
  const previous = Number(indicator.previous_value);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const direction = current > previous ? "subiu" : current < previous ? "caiu" : "ficou estável";
  return `${indicator.label} ${direction}: ${formatNumber(indicator.latest_value, indicator.unit)}.`;
}

export default async function MacroPage() {
  const snapshot = await getMacroSnapshot().catch(() => ({ indicators: [], expectations: [] }));
  const byKey = new Map(snapshot.indicators.map((indicator) => [indicator.key, indicator]));
  const facts = [
    movementSentence(byKey.get("ipca_12m")),
    movementSentence(byKey.get("selic_target")),
    movementSentence(byKey.get("ibc_br")),
    movementSentence(byKey.get("usd_brl")),
  ].filter(Boolean) as string[];
  const years = [...new Set(snapshot.expectations.map((item) => item.reference_year))].sort();
  const expectationKeys = ["ipca", "gdp", "selic", "exchange"];

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/">Mercado</Link>
        <span>/</span>
        <strong>Macroeconomia</strong>
      </div>

      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>MACROECONOMIA · BRASIL</span>
          <h1>Indicadores macroeconômicos</h1>
          <p>Últimas leituras oficiais e expectativas Focus, com data, frequência e fonte preservadas.</p>
        </div>
        <div className={styles.headerMeta}>
          <span>BCB SGS</span>
          <span>Pesquisa Focus</span>
          <strong>Fonte oficial</strong>
        </div>
      </header>

      {snapshot.indicators.length === 0 ? (
        <section className={styles.empty}>
          Os indicadores macroeconômicos estão temporariamente indisponíveis. Nenhum valor substituto é inventado.
        </section>
      ) : (
        <>
          <section className={styles.snapshotPanel} aria-labelledby="macro-snapshot-title">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.kicker}>BRASIL AGORA</span>
                <h2 id="macro-snapshot-title">Últimas leituras</h2>
              </div>
              <span className={styles.sectionMeta}>{snapshot.indicators.length} séries disponíveis</span>
            </div>

            <div className={styles.kpiGrid} aria-label="Indicadores macroeconômicos">
              {snapshot.indicators.map((indicator) => (
                <article className={styles.kpiRow} key={indicator.key}>
                  <div className={styles.kpiIdentity}>
                    <span>{indicator.label}</span>
                    <strong>{formatNumber(indicator.latest_value, indicator.unit)}</strong>
                  </div>
                  <MacroSparkline
                    points={indicator.points}
                    label={indicator.label}
                    unit={indicator.unit}
                    className={styles.sparkline}
                  />
                  <span className={Number(indicator.change ?? 0) > 0 ? styles.up : Number(indicator.change ?? 0) < 0 ? styles.down : styles.flat}>
                    {changeLabel(indicator)}
                  </span>
                  <div className={styles.kpiMeta}>
                    <span>{formatDate(indicator.reference_date)}</span>
                    <span>{indicator.frequency}</span>
                    <span>{indicator.source.provider}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {facts.length ? (
            <section className={styles.movementStrip} aria-label="Mudanças na última leitura">
              <strong>Última divulgação</strong>
              <div>
                {facts.map((fact) => <span key={fact}>{fact}</span>)}
              </div>
              <small>Descrição mecânica da variação observada; não é previsão.</small>
            </section>
          ) : null}
        </>
      )}

      <section className={styles.focusSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>PESQUISA FOCUS</span>
            <h2>Expectativas anuais</h2>
          </div>
          <p>Medianas publicadas pelo Banco Central; faixa mínima/máxima e respondentes quando disponíveis.</p>
        </div>

        {years.length === 0 ? (
          <div className={styles.empty}>Expectativas Focus temporariamente indisponíveis.</div>
        ) : (
          <div className={styles.focusTableWrap}>
            <table className={styles.focusTable}>
              <thead>
                <tr>
                  <th>Indicador</th>
                  {years.map((year) => <th key={year}>{year}</th>)}
                </tr>
              </thead>
              <tbody>
                {expectationKeys.map((key) => {
                  const row = snapshot.expectations.filter((item) => item.key === key);
                  if (!row.length) return null;
                  return (
                    <tr key={key}>
                      <th>{row[0].label}</th>
                      {years.map((year) => {
                        const item = row.find((entry) => entry.reference_year === year);
                        return (
                          <td key={year}>
                            {item ? (
                              <>
                                <strong>{formatNumber(item.median, item.unit)}</strong>
                                {item.minimum != null && item.maximum != null && (
                                  <small>
                                    {formatNumber(item.minimum, item.unit)} — {formatNumber(item.maximum, item.unit)}
                                  </small>
                                )}
                                {item.respondents != null && <em>{item.respondents} respondentes</em>}
                              </>
                            ) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

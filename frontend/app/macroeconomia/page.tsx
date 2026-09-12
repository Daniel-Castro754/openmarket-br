import Link from "next/link";

import { getMacroSnapshot, type MacroIndicator, type MacroSeriesPoint } from "../../lib/macro-api";
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
  if (indicator.change == null) return "Sem comparação anterior";
  const delta = Number(indicator.change);
  if (!Number.isFinite(delta)) return "Sem comparação anterior";
  const sign = delta > 0 ? "+" : "";
  const suffix = indicator.unit.startsWith("%") ? " p.p." : "";
  return `${sign}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(delta)}${suffix}`;
}

function sparkline(points: MacroSeriesPoint[]) {
  if (points.length < 2) return "";
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 240;
      const y = 64 - ((value - min) / range) * 52;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function movementSentence(indicator?: MacroIndicator) {
  if (!indicator || indicator.previous_value == null) return null;
  const current = Number(indicator.latest_value);
  const previous = Number(indicator.previous_value);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const direction = current > previous ? "subiu" : current < previous ? "caiu" : "ficou estável";
  return `${indicator.label} ${direction} na última leitura (${formatNumber(indicator.latest_value, indicator.unit)}).`;
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

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>PAINEL MACROECONÔMICO</span>
          <h1>O cenário que move os ativos brasileiros</h1>
          <p>
            Juros, inflação, atividade e câmbio em uma única leitura, com séries oficiais do Banco
            Central e expectativas da Pesquisa Focus. Cada número mantém fonte e data de referência.
          </p>
        </div>
        <div className={styles.heroSource}>
          <span>Fontes primárias</span>
          <strong>BCB SGS + Focus</strong>
          <small>Atualização conforme cada série oficial</small>
        </div>
      </section>

      {snapshot.indicators.length === 0 ? (
        <section className={styles.empty}>
          Os indicadores macroeconômicos estão temporariamente indisponíveis. A API mantém a fonte oficial
          como única origem; nenhum valor substituto é inventado.
        </section>
      ) : (
        <>
          <section className={styles.kpiGrid} aria-label="Indicadores macroeconômicos">
            {snapshot.indicators.map((indicator) => (
              <article className={styles.kpiCard} key={indicator.key}>
                <div className={styles.kpiHeading}>
                  <div>
                    <span>{indicator.label}</span>
                    <strong>{formatNumber(indicator.latest_value, indicator.unit)}</strong>
                  </div>
                  <span className={Number(indicator.change ?? 0) > 0 ? styles.up : Number(indicator.change ?? 0) < 0 ? styles.down : styles.flat}>
                    {changeLabel(indicator)}
                  </span>
                </div>
                <svg className={styles.sparkline} viewBox="0 0 240 72" preserveAspectRatio="none" role="img" aria-label={`Histórico de ${indicator.label}`}>
                  <polyline points={sparkline(indicator.points)} fill="none" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className={styles.kpiMeta}>
                  <span>{formatDate(indicator.reference_date)}</span>
                  <span>{indicator.frequency}</span>
                  <span>{indicator.source.provider}</span>
                </div>
                <p>{indicator.description}</p>
              </article>
            ))}
          </section>

          <section className={styles.readingGrid}>
            <article className={styles.readingCard}>
              <span className={styles.kicker}>LEITURA DO MOMENTO</span>
              <h2>O que mudou na última divulgação</h2>
              <div className={styles.factList}>
                {facts.map((fact) => <p key={fact}>{fact}</p>)}
              </div>
              <small>
                São descrições mecânicas da variação observada, não previsão nem recomendação de investimento.
              </small>
            </article>

            <article className={styles.readingCard}>
              <span className={styles.kicker}>COMO USAR</span>
              <h2>Conecte macro e fundamentos</h2>
              <div className={styles.guideList}>
                <div><strong>Juros</strong><span>Custo de capital, crédito e valuation.</span></div>
                <div><strong>Inflação</strong><span>Preços, margens, contratos e renda real.</span></div>
                <div><strong>Atividade</strong><span>Demanda agregada e ciclo de receitas.</span></div>
                <div><strong>Câmbio</strong><span>Exportadores, importadores e dívida em moeda estrangeira.</span></div>
              </div>
            </article>
          </section>
        </>
      )}

      <section className={styles.focusSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>PESQUISA FOCUS</span>
            <h2>Expectativas do mercado</h2>
          </div>
          <p>Medianas anuais publicadas pelo Banco Central, com faixa mínima/máxima quando disponível.</p>
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

      <section className={styles.nextFeatures}>
        <div>
          <span className={styles.kicker}>PRÓXIMAS CAMADAS</span>
          <h2>Do macro para a decisão de investimento</h2>
          <p>
            A arquitetura agora permite cruzar o cenário macro com empresas e setores. Isso abre espaço para
            comparação entre ativos, cotações ajustadas/dolarizadas, agenda de proventos e gráficos de preço
            versus lucro sem depender de scraping de sites terceiros.
          </p>
        </div>
        <Link href="/ativos/PETR4">Ver exemplo em um ativo →</Link>
      </section>
    </main>
  );
}

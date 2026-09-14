"use client";

import { useMemo, useState } from "react";

import type {
  ConsumerInsightSnapshot,
  ConsumptionItem,
  EconomicTrend,
} from "../../lib/insights-api";
import styles from "./analises.module.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function formatPeriod(period?: string | null) {
  if (!period || !/^\d{6}$/.test(period)) return period ?? "—";
  const year = period.slice(0, 4);
  const month = Number(period.slice(4));
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(Number(year), month - 1, 1),
  );
  return `${label.replace(".", "")}/${year}`;
}

function Sparkline({ trend }: { trend: EconomicTrend }) {
  const values = trend.points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (values.length < 2) return <div className={styles.sparkEmpty}>Série indisponível</div>;

  const width = 320;
  const height = 82;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Histórico de ${trend.label}`}>
      <line x1="0" y1={height - 6} x2={width} y2={height - 6} className={styles.sparkBase} />
      <polyline points={points} className={styles.sparkPath} />
    </svg>
  );
}

function ConsumptionRow({ item, rank, max }: { item: ConsumptionItem; rank: number; max: number }) {
  const share = Number(item.share_percent);
  const width = max > 0 ? Math.max(3, (share / max) * 100) : 0;
  return (
    <div className={styles.consumptionRow}>
      <span className={styles.rank}>{rank}º</span>
      <div className={styles.consumptionBody}>
        <div className={styles.consumptionLabel}>
          <strong>{item.label}</strong>
          <span>
            <b>{number.format(share)}%</b>
            {item.monthly_value ? ` · ${money.format(Number(item.monthly_value))}/mês` : ""}
          </span>
        </div>
        <div className={styles.barTrack}>
          <span className={styles.barFill} style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ConsumerAnalysis({ snapshot }: { snapshot: ConsumerInsightSnapshot }) {
  const [profileKey, setProfileKey] = useState(snapshot.consumption_profiles[0]?.key ?? "brasil");
  const profile =
    snapshot.consumption_profiles.find((item) => item.key === profileKey) ?? snapshot.consumption_profiles[0];

  const ranked = useMemo(
    () => [...(profile?.items ?? [])].sort((a, b) => Number(b.share_percent) - Number(a.share_percent)),
    [profile],
  );
  const max = ranked.length ? Number(ranked[0].share_percent) : 0;

  return (
    <div className={styles.dashboard}>
      <section className={styles.consumptionCard}>
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.sourceLine}>
              <span className={styles.badge}>POF 2017–2018</span>
              <span>Fonte oficial · IBGE</span>
            </div>
            <h2>Estrutura da despesa de consumo</h2>
            <p>
              Participação de cada grupo na despesa média de consumo. Valores em reais aparecem somente quando a
              média mensal correspondente está publicada no conjunto utilizado.
            </p>
          </div>
          {profile?.average_monthly_consumption ? (
            <div className={styles.totalBox}>
              <span>Consumo médio mensal</span>
              <strong>{money.format(Number(profile.average_monthly_consumption))}</strong>
            </div>
          ) : null}
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Recorte da POF">
          {snapshot.consumption_profiles.map((item) => (
            <button
              type="button"
              key={item.key}
              className={item.key === profileKey ? styles.activeTab : styles.tab}
              onClick={() => setProfileKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.rankingList}>
          {ranked.slice(0, 8).map((item, index) => (
            <ConsumptionRow item={item} rank={index + 1} max={max} key={item.key} />
          ))}
        </div>

        <div className={styles.cardFooter}>
          <span>{profile?.description}</span>
          {profile?.source.source_url ? (
            <a href={profile.source.source_url} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>
          ) : null}
        </div>
      </section>

      <section>
        <div className={styles.blockTitle}>
          <div>
            <span className="eyebrow">SÉRIES CONJUNTURAIS</span>
            <h2>Atividade e preços</h2>
          </div>
          <p>Comércio, serviços, indústria e preços ajudam a separar a estrutura de consumo da evolução recente.</p>
        </div>

        <div className={styles.trendGrid}>
          {snapshot.trends.map((trend) => {
            const latest = trend.latest_value == null ? null : Number(trend.latest_value);
            const previous = trend.points.length > 1 ? Number(trend.points[trend.points.length - 2].value) : null;
            const delta = latest != null && previous != null ? latest - previous : null;
            return (
              <article className={styles.trendCard} key={trend.key}>
                <div className={styles.trendTop}>
                  <div>
                    <span>{trend.label}</span>
                    <strong>{latest == null ? "—" : `${number.format(latest)}${trend.unit.includes("%") ? "%" : ""}`}</strong>
                  </div>
                  <div className={styles.period}>{formatPeriod(trend.latest_period)}</div>
                </div>
                <Sparkline trend={trend} />
                <p>{trend.description}</p>
                <div className={styles.trendMeta}>
                  <span>{delta == null ? "Sem comparação" : `${delta >= 0 ? "▲" : "▼"} ${number.format(Math.abs(delta))} p.p. vs. leitura anterior`}</span>
                  {trend.source.source_url ? (
                    <a href={trend.source.source_url} target="_blank" rel="noreferrer">IBGE/SIDRA ↗</a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.methodCard}>
        <div>
          <span className="eyebrow">METODOLOGIA</span>
          <h2>Estrutura e tendência</h2>
        </div>
        <div className={styles.methodGrid}>
          {snapshot.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      </section>
    </div>
  );
}

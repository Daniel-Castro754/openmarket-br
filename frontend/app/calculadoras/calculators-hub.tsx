"use client";

import { useMemo, useState } from "react";

import styles from "./calculadoras.module.css";

type CalcKey = "compound" | "goal" | "dividends" | "real-rate" | "present-future" | "rule72";

type CalcMeta = {
  key: CalcKey;
  title: string;
  group: string;
  description: string;
};

const calculators: CalcMeta[] = [
  { key: "compound", title: "Juros compostos", group: "Investimentos", description: "Projete capital com aportes mensais." },
  { key: "goal", title: "Aportes para a meta", group: "Metas", description: "Descubra quanto investir por mês para chegar ao objetivo." },
  { key: "dividends", title: "Renda de dividendos", group: "Renda", description: "Estime o patrimônio necessário para uma renda mensal desejada." },
  { key: "real-rate", title: "Juros real × nominal", group: "Indicadores", description: "Veja quanto da taxa sobra depois da inflação." },
  { key: "present-future", title: "Valor presente e futuro", group: "Indicadores", description: "Traga valores no tempo usando capitalização composta." },
  { key: "rule72", title: "Regra do 72", group: "Indicadores", description: "Compare a estimativa rápida com o tempo exato para dobrar." },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthlyRate(annualPct: number) {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputWrap}>
        <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

function Result({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={accent ? styles.resultAccent : styles.result}><span>{label}</span><strong>{value}</strong></div>;
}

function CompoundCalculator() {
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(1000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(5);
  const result = useMemo(() => {
    const months = Math.max(0, Math.round(years * 12));
    const r = monthlyRate(rate);
    const factor = Math.pow(1 + r, months);
    const contributions = r === 0 ? monthly * months : monthly * ((factor - 1) / r);
    const finalValue = initial * factor + contributions;
    const invested = initial + monthly * months;
    return { finalValue, invested, interest: finalValue - invested, r };
  }, [initial, monthly, rate, years]);
  return <>
    <div className={styles.formGrid}><Field label="Valor inicial" value={initial} onChange={setInitial} suffix="R$" /><Field label="Aporte mensal" value={monthly} onChange={setMonthly} suffix="R$" /><Field label="Taxa anual" value={rate} onChange={setRate} suffix="% a.a." /><Field label="Prazo" value={years} onChange={setYears} suffix="anos" /></div>
    <div className={styles.results}><Result label="Valor final" value={brl.format(result.finalValue)} accent /><Result label="Total investido" value={brl.format(result.invested)} /><Result label="Juros acumulados" value={brl.format(result.interest)} /><Result label="Taxa mensal equivalente" value={`${pct.format(result.r * 100)}% a.m.`} /></div>
    <p className={styles.method}>Capitalização mensal; aportes entram ao fim de cada mês. Taxa anual convertida por equivalência composta.</p>
  </>;
}

function GoalCalculator() {
  const [current, setCurrent] = useState(20000);
  const [target, setTarget] = useState(500000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(10);
  const [inflation, setInflation] = useState(4);
  const result = useMemo(() => {
    const months = Math.max(1, Math.round(years * 12));
    const r = monthlyRate(rate);
    const targetFuture = target * Math.pow(1 + inflation / 100, years);
    const currentFuture = current * Math.pow(1 + r, months);
    const gap = Math.max(0, targetFuture - currentFuture);
    const payment = r === 0 ? gap / months : gap * r / (Math.pow(1 + r, months) - 1);
    return { targetFuture, payment, currentFuture };
  }, [current, target, years, rate, inflation]);
  return <>
    <div className={styles.formGrid}><Field label="Saldo atual" value={current} onChange={setCurrent} suffix="R$" /><Field label="Meta em reais de hoje" value={target} onChange={setTarget} suffix="R$" /><Field label="Prazo" value={years} onChange={setYears} suffix="anos" /><Field label="Rentabilidade anual" value={rate} onChange={setRate} suffix="% a.a." /><Field label="Inflação anual" value={inflation} onChange={setInflation} suffix="% a.a." /></div>
    <div className={styles.results}><Result label="Aporte mensal necessário" value={brl.format(result.payment)} accent /><Result label="Meta corrigida" value={brl.format(result.targetFuture)} /><Result label="Saldo atual projetado" value={brl.format(result.currentFuture)} /></div>
    <p className={styles.method}>A meta é corrigida pela inflação informada; rentabilidade e inflação são hipóteses, não previsões.</p>
  </>;
}

function DividendCalculator() {
  const [income, setIncome] = useState(5000);
  const [yieldPct, setYieldPct] = useState(7);
  const [current, setCurrent] = useState(100000);
  const required = yieldPct > 0 ? income * 12 / (yieldPct / 100) : 0;
  const gap = Math.max(0, required - current);
  return <>
    <div className={styles.formGrid}><Field label="Renda mensal desejada" value={income} onChange={setIncome} suffix="R$" /><Field label="Dividend yield anual assumido" value={yieldPct} onChange={setYieldPct} suffix="% a.a." /><Field label="Patrimônio atual" value={current} onChange={setCurrent} suffix="R$" /></div>
    <div className={styles.results}><Result label="Patrimônio estimado" value={brl.format(required)} accent /><Result label="Capital que falta" value={brl.format(gap)} /><Result label="Renda anual desejada" value={brl.format(income * 12)} /></div>
    <p className={styles.method}>Modelo simplificado: renda anual ÷ yield assumido. Dividendos variam e não são garantidos.</p>
  </>;
}

function RealRateCalculator() {
  const [nominal, setNominal] = useState(12);
  const [inflation, setInflation] = useState(4.5);
  const real = ((1 + nominal / 100) / (1 + inflation / 100) - 1) * 100;
  return <>
    <div className={styles.formGrid}><Field label="Taxa nominal" value={nominal} onChange={setNominal} suffix="% a.a." /><Field label="Inflação" value={inflation} onChange={setInflation} suffix="% a.a." /></div>
    <div className={styles.results}><Result label="Taxa real" value={`${pct.format(real)}% a.a.`} accent /><Result label="Diferença simples" value={`${pct.format(nominal - inflation)} p.p.`} /></div>
    <p className={styles.method}>Usa a equação de Fisher: (1 + taxa nominal) ÷ (1 + inflação) − 1.</p>
  </>;
}

function PresentFutureCalculator() {
  const [value, setValue] = useState(10000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(5);
  const [mode, setMode] = useState<"future" | "present">("future");
  const factor = Math.pow(1 + rate / 100, years);
  const result = mode === "future" ? value * factor : value / factor;
  return <>
    <div className={styles.toggleRow}><button className={mode === "future" ? styles.toggleActive : styles.toggle} onClick={() => setMode("future")}>Calcular valor futuro</button><button className={mode === "present" ? styles.toggleActive : styles.toggle} onClick={() => setMode("present")}>Calcular valor presente</button></div>
    <div className={styles.formGrid}><Field label={mode === "future" ? "Valor hoje" : "Valor futuro"} value={value} onChange={setValue} suffix="R$" /><Field label="Taxa anual" value={rate} onChange={setRate} suffix="% a.a." /><Field label="Prazo" value={years} onChange={setYears} suffix="anos" /></div>
    <div className={styles.results}><Result label={mode === "future" ? "Valor futuro" : "Valor presente"} value={brl.format(result)} accent /><Result label="Fator acumulado" value={`${pct.format((factor - 1) * 100)}%`} /></div>
    <p className={styles.method}>Capitalização composta anual para colocar valores em um mesmo ponto do tempo.</p>
  </>;
}

function Rule72Calculator() {
  const [rate, setRate] = useState(10);
  const approx = rate > 0 ? 72 / rate : 0;
  const exact = rate > 0 ? Math.log(2) / Math.log(1 + rate / 100) : 0;
  return <>
    <div className={styles.formGrid}><Field label="Taxa anual" value={rate} onChange={setRate} suffix="% a.a." /></div>
    <div className={styles.results}><Result label="Regra do 72" value={`${pct.format(approx)} anos`} accent /><Result label="Tempo exato" value={`${pct.format(exact)} anos`} /><Result label="Diferença" value={`${pct.format(Math.abs(approx - exact))} anos`} /></div>
    <p className={styles.method}>A regra do 72 é uma aproximação; o cálculo exato usa logaritmos e capitalização composta.</p>
  </>;
}

function CalculatorBody({ selected }: { selected: CalcKey }) {
  if (selected === "compound") return <CompoundCalculator />;
  if (selected === "goal") return <GoalCalculator />;
  if (selected === "dividends") return <DividendCalculator />;
  if (selected === "real-rate") return <RealRateCalculator />;
  if (selected === "present-future") return <PresentFutureCalculator />;
  return <Rule72Calculator />;
}

export function CalculatorsHub() {
  const [selected, setSelected] = useState<CalcKey>("compound");
  const active = calculators.find((item) => item.key === selected) ?? calculators[0];
  return (
    <div className={styles.workspace}>
      <aside className={styles.catalog}>
        <div className={styles.catalogTitle}><strong>Escolha a calculadora</strong><span>Investimentos, metas e indicadores</span></div>
        {calculators.map((item) => (
          <button key={item.key} type="button" onClick={() => setSelected(item.key)} className={selected === item.key ? styles.catalogActive : styles.catalogItem}>
            <span>{item.group}</span><strong>{item.title}</strong><small>{item.description}</small>
          </button>
        ))}
      </aside>
      <section className={styles.calculatorCard}>
        <div className={styles.calculatorHeading}><span className="eyebrow">{active.group.toUpperCase()}</span><h2>{active.title}</h2><p>{active.description}</p></div>
        <CalculatorBody selected={selected} />
        <div className={styles.disclaimer}><strong>Metodologia transparente</strong><span>Simulação educacional. Confirme regras fiscais, contratuais e condições do produto antes de decidir.</span></div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { FinancialMetric, ScreenerRow } from "../../lib/api";
import styles from "./screener.module.css";

type MetricKey =
  | "revenue"
  | "net_income"
  | "revenue_growth_yoy"
  | "gross_margin"
  | "operating_margin"
  | "net_margin"
  | "roe"
  | "cash"
  | "gross_debt"
  | "net_debt";

type Operator = "gt" | "gte" | "lt" | "lte";

type FilterRule = {
  id: number;
  metric: MetricKey;
  operator: Operator;
  value: string;
};

type ColumnDefinition = {
  key: "ticker" | "company" | "latest_period" | MetricKey;
  label: string;
  kind: "text" | "date" | "currency" | "percent";
  metric?: MetricKey;
};

const metricOptions: Array<{ key: MetricKey; label: string; unit: "%" | "R$"; group: string }> = [
  { key: "revenue_growth_yoy", label: "Crescimento da receita", unit: "%", group: "Crescimento" },
  { key: "roe", label: "ROE", unit: "%", group: "Rentabilidade" },
  { key: "gross_margin", label: "Margem bruta", unit: "%", group: "Margens" },
  { key: "operating_margin", label: "Margem operacional", unit: "%", group: "Margens" },
  { key: "net_margin", label: "Margem líquida", unit: "%", group: "Margens" },
  { key: "revenue", label: "Receita", unit: "R$", group: "Resultados" },
  { key: "net_income", label: "Lucro líquido", unit: "R$", group: "Resultados" },
  { key: "cash", label: "Caixa", unit: "R$", group: "Balanço" },
  { key: "gross_debt", label: "Dívida bruta", unit: "R$", group: "Balanço" },
  { key: "net_debt", label: "Dívida líquida", unit: "R$", group: "Balanço" },
];

const operatorLabels: Record<Operator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

const columns: ColumnDefinition[] = [
  { key: "ticker", label: "Ticker", kind: "text" },
  { key: "company", label: "Empresa", kind: "text" },
  { key: "revenue", label: "Receita", kind: "currency", metric: "revenue" },
  { key: "revenue_growth_yoy", label: "Receita YoY", kind: "percent", metric: "revenue_growth_yoy" },
  { key: "net_income", label: "Lucro líquido", kind: "currency", metric: "net_income" },
  { key: "roe", label: "ROE", kind: "percent", metric: "roe" },
  { key: "gross_margin", label: "Margem bruta", kind: "percent", metric: "gross_margin" },
  { key: "operating_margin", label: "Margem op.", kind: "percent", metric: "operating_margin" },
  { key: "net_margin", label: "Margem líquida", kind: "percent", metric: "net_margin" },
  { key: "cash", label: "Caixa", kind: "currency", metric: "cash" },
  { key: "gross_debt", label: "Dívida bruta", kind: "currency", metric: "gross_debt" },
  { key: "net_debt", label: "Dívida líquida", kind: "currency", metric: "net_debt" },
  { key: "latest_period", label: "Último período", kind: "date" },
];

const defaultColumns: ColumnDefinition["key"][] = [
  "ticker",
  "company",
  "revenue_growth_yoy",
  "roe",
  "net_margin",
  "net_debt",
  "latest_period",
];

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function metricNumber(row: ScreenerRow, metric: MetricKey) {
  const raw = row.metrics[metric as FinancialMetric];
  if (raw == null) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function matchesRule(row: ScreenerRow, rule: FilterRule) {
  const threshold = parseNumber(rule.value);
  if (threshold == null) return true;
  const current = metricNumber(row, rule.metric);
  if (current == null) return false;
  if (rule.operator === "gt") return current > threshold;
  if (rule.operator === "gte") return current >= threshold;
  if (rule.operator === "lt") return current < threshold;
  return current <= threshold;
}

function formatMetric(row: ScreenerRow, column: ColumnDefinition) {
  if (!column.metric) return "—";
  const value = metricNumber(row, column.metric);
  if (value == null) return "—";
  if (column.kind === "percent") {
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value)}%`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: row.currency || "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function comparableValue(row: ScreenerRow, key: ColumnDefinition["key"]): string | number | null {
  if (key === "ticker") return row.ticker;
  if (key === "company") return row.company_name;
  if (key === "latest_period") return row.latest_period ?? null;
  return metricNumber(row, key);
}

export function ScreenerWorkspace({ rows, total }: { rows: ScreenerRow[]; total: number }) {
  const [rules, setRules] = useState<FilterRule[]>([
    { id: 1, metric: "roe", operator: "gte", value: "" },
  ]);
  const [query, setQuery] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<ColumnDefinition["key"][]>(defaultColumns);
  const [showColumns, setShowColumns] = useState(false);
  const [sortKey, setSortKey] = useState<ColumnDefinition["key"]>("ticker");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const activeRuleCount = rules.filter((rule) => parseNumber(rule.value) != null).length;

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = rows.filter((row) => {
      if (needle && !`${row.ticker} ${row.company_name} ${row.legal_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)) {
        return false;
      }
      return rules.every((rule) => matchesRule(row, rule));
    });

    return [...filtered].sort((left, right) => {
      const a = comparableValue(left, sortKey);
      const b = comparableValue(right, sortKey);
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      const result = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), "pt-BR", { numeric: true });
      return sortDirection === "asc" ? result : -result;
    });
  }, [query, rows, rules, sortDirection, sortKey]);

  function updateRule(id: number, patch: Partial<FilterRule>) {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  }

  function addRule() {
    setRules((current) => [
      ...current,
      { id: Math.max(0, ...current.map((rule) => rule.id)) + 1, metric: "net_margin", operator: "gte", value: "" },
    ]);
  }

  function removeRule(id: number) {
    setRules((current) => current.length === 1
      ? [{ id: 1, metric: "roe", operator: "gte", value: "" }]
      : current.filter((rule) => rule.id !== id));
  }

  function clearFilters() {
    setRules([{ id: 1, metric: "roe", operator: "gte", value: "" }]);
    setQuery("");
  }

  function toggleColumn(key: ColumnDefinition["key"]) {
    if (key === "ticker" || key === "company") return;
    setVisibleColumns((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function toggleSort(key: ColumnDefinition["key"]) {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection(key === "ticker" || key === "company" ? "asc" : "desc");
    }
  }

  const activeColumns = columns.filter((column) => visibleColumns.includes(column.key));

  return (
    <section className={styles.workspace}>
      <aside className={styles.filterPanel}>
        <div className={styles.panelHeading}>
          <div>
            <span className="eyebrow">FILTROS</span>
            <h2>Construtor de critérios</h2>
          </div>
          <span className={styles.counter}>{activeRuleCount}</span>
        </div>

        <label className={styles.searchField}>
          <span>Empresa ou ticker</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="PETR4, Petrobras..."
          />
        </label>

        <div className={styles.rules}>
          {rules.map((rule) => {
            const metric = metricOptions.find((item) => item.key === rule.metric) ?? metricOptions[0];
            return (
              <div className={styles.ruleCard} key={rule.id}>
                <div className={styles.ruleTopline}>
                  <span>{metric.group}</span>
                  <button type="button" onClick={() => removeRule(rule.id)} aria-label="Remover filtro">×</button>
                </div>
                <select
                  value={rule.metric}
                  onChange={(event) => updateRule(rule.id, { metric: event.target.value as MetricKey })}
                  aria-label="Indicador"
                >
                  {metricOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
                </select>
                <div className={styles.ruleCondition}>
                  <select
                    value={rule.operator}
                    onChange={(event) => updateRule(rule.id, { operator: event.target.value as Operator })}
                    aria-label="Operador"
                  >
                    {(Object.keys(operatorLabels) as Operator[]).map((operator) => (
                      <option value={operator} key={operator}>{operatorLabels[operator]}</option>
                    ))}
                  </select>
                  <div className={styles.valueInput}>
                    <input
                      inputMode="decimal"
                      value={rule.value}
                      onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                      placeholder="valor"
                      aria-label={`Valor para ${metric.label}`}
                    />
                    <span>{metric.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button className={styles.addRuleButton} type="button" onClick={addRule}>+ Adicionar filtro</button>
        <button className={styles.clearButton} type="button" onClick={clearFilters}>Limpar critérios</button>

        <div className={styles.sourceNote}>
          <strong>Proveniência</strong>
          <span>Indicadores financeiros anuais consolidados, oficiais ou derivados de fatos da CVM.</span>
        </div>
      </aside>

      <div className={styles.resultsArea}>
        <div className={styles.summaryBar}>
          <div><span>Encontradas</span><strong>{filteredRows.length}</strong></div>
          <div><span>Filtros ativos</span><strong>{activeRuleCount}</strong></div>
          <div><span>Universo carregado</span><strong>{rows.length}/{total}</strong></div>
          <div><span>Frequência</span><strong>Anual</strong></div>
          <button type="button" onClick={() => setShowColumns((current) => !current)}>Colunas</button>
        </div>

        {showColumns ? (
          <div className={styles.columnPicker}>
            <div>
              <strong>Escolha as colunas</strong>
              <span>Ticker e empresa permanecem fixos.</span>
            </div>
            <div className={styles.columnOptions}>
              {columns.map((column) => (
                <label key={column.key}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.key)}
                    disabled={column.key === "ticker" || column.key === "company"}
                    onChange={() => toggleColumn(column.key)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.tableShell}>
          <table className={styles.table}>
            <thead>
              <tr>
                {activeColumns.map((column) => (
                  <th key={column.key} className={column.kind === "currency" || column.kind === "percent" ? styles.numeric : ""}>
                    <button type="button" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      {sortKey === column.key ? <span>{sortDirection === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.exchange}-${row.ticker}`}>
                  {activeColumns.map((column) => {
                    if (column.key === "ticker") {
                      return <td key={column.key}><Link className={styles.ticker} href={`/ativos/${row.ticker}`}>{row.ticker}</Link></td>;
                    }
                    if (column.key === "company") {
                      return <td className={styles.company} key={column.key}>{row.company_name}</td>;
                    }
                    if (column.key === "latest_period") {
                      return <td key={column.key}>{row.latest_period ? row.latest_period.slice(0, 4) : "—"}</td>;
                    }
                    return (
                      <td className={column.kind === "currency" || column.kind === "percent" ? styles.numeric : ""} key={column.key}>
                        {formatMetric(row, column)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr><td className={styles.empty} colSpan={Math.max(1, activeColumns.length)}>Nenhuma empresa atende aos critérios atuais.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className={styles.footer}>
          <span>Condições são combinadas com lógica E: a empresa precisa atender a todos os filtros preenchidos.</span>
          {total > rows.length ? (
            <span className={styles.warning}>Esta versão filtra os {rows.length} ativos carregados pela API; paginação filtrada no backend será o próximo passo de escala.</span>
          ) : (
            <span>Todo o universo sincronizado está carregado nesta visão.</span>
          )}
        </footer>
      </div>
    </section>
  );
}

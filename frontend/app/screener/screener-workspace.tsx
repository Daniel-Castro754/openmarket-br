"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { FinancialMetric, ScreenerResponse, ScreenerRow } from "../../lib/api";
import styles from "./screener.module.css";

type MetricKey =
  | "revenue"
  | "net_income"
  | "revenue_growth_yoy"
  | "gross_margin"
  | "operating_margin"
  | "net_margin"
  | "roe"
  | "current_ratio"
  | "cash"
  | "gross_debt"
  | "net_debt";

type Operator = "gt" | "gte" | "lt" | "lte";
type SortableKey = "ticker" | "company" | MetricKey;
type ColumnKey = SortableKey | "latest_period";

type FilterRule = {
  id: number;
  metric: MetricKey;
  operator: Operator;
  value: string;
};

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  kind: "text" | "date" | "currency" | "percent" | "multiple";
  metric?: MetricKey;
  sortable?: boolean;
};

const metricOptions: Array<{ key: MetricKey; label: string; unit: "%" | "R$" | "x"; group: string }> = [
  { key: "revenue_growth_yoy", label: "Crescimento da receita", unit: "%", group: "Crescimento" },
  { key: "roe", label: "ROE", unit: "%", group: "Rentabilidade" },
  { key: "current_ratio", label: "Liquidez corrente", unit: "x", group: "Liquidez" },
  { key: "gross_margin", label: "Margem bruta", unit: "%", group: "Margens" },
  { key: "operating_margin", label: "Margem operacional", unit: "%", group: "Margens" },
  { key: "net_margin", label: "Margem líquida", unit: "%", group: "Margens" },
  { key: "revenue", label: "Receita", unit: "R$", group: "Resultados" },
  { key: "net_income", label: "Lucro líquido", unit: "R$", group: "Resultados" },
  { key: "cash", label: "Caixa", unit: "R$", group: "Balanço" },
  { key: "gross_debt", label: "Dívida bruta", unit: "R$", group: "Balanço" },
  { key: "net_debt", label: "Dívida líquida", unit: "R$", group: "Balanço" },
];

const metricKeys = new Set<MetricKey>(metricOptions.map((item) => item.key));
const operatorKeys = new Set<Operator>(["gt", "gte", "lt", "lte"]);

const operatorLabels: Record<Operator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

const columns: ColumnDefinition[] = [
  { key: "ticker", label: "Ticker", kind: "text", sortable: true },
  { key: "company", label: "Empresa", kind: "text", sortable: true },
  { key: "revenue", label: "Receita", kind: "currency", metric: "revenue", sortable: true },
  { key: "revenue_growth_yoy", label: "Receita YoY", kind: "percent", metric: "revenue_growth_yoy", sortable: true },
  { key: "net_income", label: "Lucro líquido", kind: "currency", metric: "net_income", sortable: true },
  { key: "roe", label: "ROE", kind: "percent", metric: "roe", sortable: true },
  { key: "current_ratio", label: "Liquidez corrente", kind: "multiple", metric: "current_ratio", sortable: true },
  { key: "gross_margin", label: "Margem bruta", kind: "percent", metric: "gross_margin", sortable: true },
  { key: "operating_margin", label: "Margem op.", kind: "percent", metric: "operating_margin", sortable: true },
  { key: "net_margin", label: "Margem líquida", kind: "percent", metric: "net_margin", sortable: true },
  { key: "cash", label: "Caixa", kind: "currency", metric: "cash", sortable: true },
  { key: "gross_debt", label: "Dívida bruta", kind: "currency", metric: "gross_debt", sortable: true },
  { key: "net_debt", label: "Dívida líquida", kind: "currency", metric: "net_debt", sortable: true },
  { key: "latest_period", label: "Último período", kind: "date" },
];

const defaultColumns: ColumnKey[] = [
  "ticker",
  "company",
  "revenue_growth_yoy",
  "roe",
  "current_ratio",
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

function formatMetric(row: ScreenerRow, column: ColumnDefinition) {
  if (!column.metric) return "—";
  const value = metricNumber(row, column.metric);
  if (value == null) return "—";
  if (column.kind === "percent") {
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value)}%`;
  }
  if (column.kind === "multiple") {
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}x`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: row.currency || "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function parseFilterExpression(expression: string, id: number): FilterRule | null {
  const [metric, operator, value] = expression.split(":", 3);
  if (!metricKeys.has(metric as MetricKey) || !operatorKeys.has(operator as Operator) || value == null) return null;
  return { id, metric: metric as MetricKey, operator: operator as Operator, value };
}

function rulesFromFilters(filters: string[]) {
  const parsed = filters
    .map((filter, index) => parseFilterExpression(filter, index + 1))
    .filter((rule): rule is FilterRule => Boolean(rule));
  return parsed.length ? parsed : [{ id: 1, metric: "roe" as MetricKey, operator: "gte" as Operator, value: "" }];
}

function serializeRule(rule: FilterRule) {
  const value = parseNumber(rule.value);
  if (value == null) return null;
  return `${rule.metric}:${rule.operator}:${value}`;
}

function buildSearchParams({
  query,
  filters,
  sort,
  direction,
  offset,
}: {
  query: string;
  filters: string[];
  sort: string;
  direction: "asc" | "desc";
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  for (const filter of filters) params.append("filter", filter);
  if (sort !== "ticker") params.set("sort", sort);
  if (direction !== "asc") params.set("direction", direction);
  if (offset && offset > 0) params.set("offset", String(offset));
  return params;
}

export function ScreenerWorkspace({
  response,
  initialQuery,
  initialFilters,
}: {
  response: ScreenerResponse;
  initialQuery: string;
  initialFilters: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState<FilterRule[]>(() => rulesFromFilters(initialFilters));
  const [query, setQuery] = useState(initialQuery);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(defaultColumns);
  const [showColumns, setShowColumns] = useState(false);

  const activeRuleCount = rules.filter((rule) => parseNumber(rule.value) != null).length;
  const activeColumns = columns.filter((column) => visibleColumns.includes(column.key));
  const pageStart = response.total === 0 ? 0 : response.offset + 1;
  const pageEnd = Math.min(response.offset + response.rows.length, response.total);
  const canGoBack = response.offset > 0;
  const canGoForward = response.offset + response.limit < response.total;

  function navigate(params: URLSearchParams) {
    const suffix = params.size ? `?${params.toString()}` : "";
    startTransition(() => router.push(`/screener${suffix}`));
  }

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

  function applyFilters() {
    const filters = rules.map(serializeRule).filter((filter): filter is string => Boolean(filter));
    navigate(buildSearchParams({
      query,
      filters,
      sort: response.sort,
      direction: response.direction,
    }));
  }

  function clearFilters() {
    setRules([{ id: 1, metric: "roe", operator: "gte", value: "" }]);
    setQuery("");
    navigate(new URLSearchParams());
  }

  function toggleColumn(key: ColumnKey) {
    if (key === "ticker" || key === "company") return;
    setVisibleColumns((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function changeSort(key: SortableKey) {
    const nextDirection = response.sort === key
      ? (response.direction === "asc" ? "desc" : "asc")
      : (key === "ticker" || key === "company" ? "asc" : "desc");
    navigate(buildSearchParams({
      query: initialQuery,
      filters: initialFilters,
      sort: key,
      direction: nextDirection,
    }));
  }

  function changePage(nextOffset: number) {
    navigate(buildSearchParams({
      query: initialQuery,
      filters: initialFilters,
      sort: response.sort,
      direction: response.direction,
      offset: Math.max(0, nextOffset),
    }));
  }

  return (
    <section className={styles.workspace} aria-busy={isPending}>
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

        <button className={styles.applyButton} type="button" onClick={applyFilters} disabled={isPending}>
          {isPending ? "Aplicando..." : "Aplicar filtros"}
        </button>
        <button className={styles.addRuleButton} type="button" onClick={addRule}>+ Adicionar filtro</button>
        <button className={styles.clearButton} type="button" onClick={clearFilters}>Limpar critérios</button>

        <div className={styles.sourceNote}>
          <strong>Proveniência</strong>
          <span>Indicadores anuais consolidados, oficiais ou calculados a partir dos fatos sincronizados da CVM.</span>
        </div>
      </aside>

      <div className={styles.resultsArea}>
        <div className={styles.summaryBar}>
          <div><span>Encontradas</span><strong>{response.total.toLocaleString("pt-BR")}</strong></div>
          <div><span>Filtros aplicados</span><strong>{response.applied_filters}</strong></div>
          <div><span>Página</span><strong>{pageStart}-{pageEnd}</strong></div>
          <div><span>Universo</span><strong>{response.universe_total.toLocaleString("pt-BR")}</strong></div>
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
                  <th key={column.key} className={column.kind === "currency" || column.kind === "percent" || column.kind === "multiple" ? styles.numeric : ""}>
                    {column.sortable ? (
                      <button type="button" onClick={() => changeSort(column.key as SortableKey)} disabled={isPending}>
                        {column.label}
                        {response.sort === column.key ? <span>{response.direction === "asc" ? "↑" : "↓"}</span> : null}
                      </button>
                    ) : column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {response.rows.map((row) => (
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
                      <td className={column.kind === "currency" || column.kind === "percent" || column.kind === "multiple" ? styles.numeric : ""} key={column.key}>
                        {formatMetric(row, column)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {response.rows.length === 0 ? (
                <tr><td className={styles.empty} colSpan={Math.max(1, activeColumns.length)}>Nenhuma empresa atende aos critérios aplicados.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <button type="button" disabled={!canGoBack || isPending} onClick={() => changePage(response.offset - response.limit)}>← Anterior</button>
          <span>{pageStart}-{pageEnd} de {response.total.toLocaleString("pt-BR")}</span>
          <button type="button" disabled={!canGoForward || isPending} onClick={() => changePage(response.offset + response.limit)}>Próxima →</button>
        </div>

        <footer className={styles.footer}>
          <span>Condições são combinadas com lógica E: a empresa precisa atender a todos os filtros aplicados.</span>
          <span>Filtragem, ordenação por indicadores e paginação são processadas no backend sobre o universo pesquisado.</span>
        </footer>
      </div>
    </section>
  );
}

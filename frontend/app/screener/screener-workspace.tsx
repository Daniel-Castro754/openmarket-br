"use client";

import {
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { Column, ColumnDef } from "@tanstack/react-table";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemo, useState, useTransition } from "react";

import type {
  IndicatorDefinition,
  ScreenerResponse,
  ScreenerRow,
  SeriesUnit,
} from "../../lib/api";
import styles from "./screener.module.css";

type MetricKey = string;

type Operator = "gt" | "gte" | "lt" | "lte";
type FilterLogic = "and" | "or";
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

const screenerTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
  rowSortingFeature,
});


function columnSize(column: ColumnDefinition) {
  if (column.key === "ticker") return 92;
  if (column.key === "company") return 240;
  if (column.key === "latest_period") return 112;
  return column.kind === "currency" ? 148 : 124;
}

function pinnedCellStyle(
  column: Column<typeof screenerTableFeatures, ScreenerRow>,
  header = false,
): CSSProperties {
  const pinned = column.getIsPinned();
  const isLastStart = pinned === "start" && column.id === "company";

  return {
    boxShadow: isLastStart
      ? "-4px 0 4px -4px var(--border-strong) inset"
      : undefined,
    insetInlineStart: pinned === "start" ? `${column.getStart("start")}px` : undefined,
    insetInlineEnd: pinned === "end" ? `${column.getAfter("end")}px` : undefined,
    position: pinned ? "sticky" : undefined,
    width: column.getSize(),
    zIndex: pinned && !header ? 2 : undefined,
  };
}

const baseMetricOptions: Array<{ key: MetricKey; label: string; unit: "%" | "R$" | "x"; group: string }> = [
  { key: "revenue", label: "Receita", unit: "R$", group: "Resultados" },
  { key: "gross_profit", label: "Lucro bruto", unit: "R$", group: "Resultados" },
  { key: "operating_result", label: "Resultado operacional", unit: "R$", group: "Resultados" },
  { key: "net_income", label: "Lucro líquido", unit: "R$", group: "Resultados" },
  { key: "total_assets", label: "Ativos totais", unit: "R$", group: "Balanço" },
  { key: "equity", label: "Patrimônio líquido", unit: "R$", group: "Balanço" },
  { key: "cash", label: "Caixa", unit: "R$", group: "Balanço" },
  { key: "gross_debt", label: "Dívida bruta", unit: "R$", group: "Balanço" },
  { key: "net_debt", label: "Dívida líquida", unit: "R$", group: "Balanço" },
  { key: "operating_cash_flow", label: "Fluxo de caixa operacional", unit: "R$", group: "Fluxo de caixa" },
  { key: "investing_cash_flow", label: "Fluxo de caixa de investimentos", unit: "R$", group: "Fluxo de caixa" },
  { key: "financing_cash_flow", label: "Fluxo de caixa de financiamentos", unit: "R$", group: "Fluxo de caixa" },
  { key: "net_change_in_cash", label: "Variação líquida de caixa", unit: "R$", group: "Fluxo de caixa" },
];

const operatorKeys = new Set<Operator>(["gt", "gte", "lt", "lte"]);

const operatorLabels: Record<Operator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

const baseColumns: ColumnDefinition[] = [
  { key: "ticker", label: "Ticker", kind: "text", sortable: true },
  { key: "company", label: "Empresa", kind: "text", sortable: true },
  { key: "revenue", label: "Receita", kind: "currency", metric: "revenue", sortable: true },
  { key: "gross_profit", label: "Lucro bruto", kind: "currency", metric: "gross_profit", sortable: true },
  { key: "operating_result", label: "Resultado op.", kind: "currency", metric: "operating_result", sortable: true },
  { key: "net_income", label: "Lucro líquido", kind: "currency", metric: "net_income", sortable: true },
  { key: "total_assets", label: "Ativos", kind: "currency", metric: "total_assets", sortable: true },
  { key: "equity", label: "Patrimônio", kind: "currency", metric: "equity", sortable: true },
  { key: "cash", label: "Caixa", kind: "currency", metric: "cash", sortable: true },
  { key: "gross_debt", label: "Dívida bruta", kind: "currency", metric: "gross_debt", sortable: true },
  { key: "net_debt", label: "Dívida líquida", kind: "currency", metric: "net_debt", sortable: true },
  { key: "operating_cash_flow", label: "FCO", kind: "currency", metric: "operating_cash_flow", sortable: true },
  { key: "investing_cash_flow", label: "FC investimentos", kind: "currency", metric: "investing_cash_flow", sortable: true },
  { key: "financing_cash_flow", label: "FC financiamentos", kind: "currency", metric: "financing_cash_flow", sortable: true },
  { key: "net_change_in_cash", label: "Variação caixa", kind: "currency", metric: "net_change_in_cash", sortable: true },
  { key: "latest_period", label: "Último período", kind: "date" },
];

function screenerKeyForIndicator(definition: IndicatorDefinition): MetricKey {
  return definition.metric ?? definition.slug;
}

function optionUnit(unit: SeriesUnit): "%" | "R$" | "x" {
  if (unit === "percent") return "%";
  if (unit === "multiple") return "x";
  return "R$";
}

function columnKind(unit: SeriesUnit): ColumnDefinition["kind"] {
  if (unit === "percent") return "percent";
  if (unit === "multiple") return "multiple";
  return "currency";
}

function supportsAnnualScreener(definition: IndicatorDefinition) {
  return definition.available_frequencies.includes("annual") && !definition.requires_market_data;
}

function resolveMetricOptions(catalog: IndicatorDefinition[]) {
  const options = new Map<MetricKey, (typeof baseMetricOptions)[number]>(
    baseMetricOptions.map((option) => [option.key, option]),
  );

  for (const definition of catalog) {
    if (!supportsAnnualScreener(definition)) continue;
    const key = screenerKeyForIndicator(definition);
    options.set(key, {
      key,
      label: definition.label,
      unit: optionUnit(definition.unit),
      group: definition.group_label ?? definition.group,
    });
  }

  return [...options.values()];
}

function resolveColumns(catalog: IndicatorDefinition[]) {
  const columns = new Map<ColumnKey, ColumnDefinition>(
    baseColumns.map((column) => [column.key, column]),
  );

  for (const definition of catalog) {
    if (!supportsAnnualScreener(definition)) continue;
    const key = screenerKeyForIndicator(definition);
    columns.set(key, {
      key,
      label: definition.short_label ?? definition.label,
      kind: columnKind(definition.unit),
      metric: key,
      sortable: true,
    });
  }

  return [...columns.values()];
}

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

function resolveInitialColumns(
  requested: string[],
  columns: ColumnDefinition[],
  customized: boolean,
): ColumnKey[] {
  const available = new Set(columns.map((column) => column.key));
  const requestedValid = requested.filter((key): key is ColumnKey => available.has(key));
  const source = customized
    ? requestedValid
    : requestedValid.length
      ? requestedValid
      : defaultColumns.filter((key) => available.has(key));

  return [
    "ticker",
    "company",
    ...source.filter((key) => key !== "ticker" && key !== "company"),
  ];
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function metricNumber(row: ScreenerRow, metric: MetricKey) {
  const raw = row.metrics[metric];
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
  if (!metric || !operatorKeys.has(operator as Operator) || value == null) return null;
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
  logic,
  columns,
  offset,
}: {
  query: string;
  filters: string[];
  sort: string;
  direction: "asc" | "desc";
  logic: FilterLogic;
  columns: ColumnKey[];
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  for (const filter of filters) params.append("filter", filter);
  if (sort !== "ticker") params.set("sort", sort);
  if (direction !== "asc") params.set("direction", direction);
  if (logic !== "and") params.set("logic", logic);
  params.set("columns", "custom");
  for (const column of columns) {
    if (column !== "ticker" && column !== "company") params.append("column", column);
  }
  if (offset && offset > 0) params.set("offset", String(offset));
  return params;
}

export function ScreenerWorkspace({
  response,
  indicatorCatalog,
  initialQuery,
  initialFilters,
  initialLogic,
  initialColumns,
  initialColumnsCustomized,
}: {
  response: ScreenerResponse;
  indicatorCatalog: IndicatorDefinition[];
  initialQuery: string;
  initialFilters: string[];
  initialLogic: FilterLogic;
  initialColumns: string[];
  initialColumnsCustomized: boolean;
}) {
  const router = useRouter();
  const metricOptions = useMemo(() => resolveMetricOptions(indicatorCatalog), [indicatorCatalog]);
  const columns = useMemo(() => resolveColumns(indicatorCatalog), [indicatorCatalog]);
  const passportSlugByMetric = useMemo(
    () => new Map(
      indicatorCatalog
        .filter(supportsAnnualScreener)
        .map((definition) => [screenerKeyForIndicator(definition), definition.slug] as const),
    ),
    [indicatorCatalog],
  );
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState<FilterRule[]>(() => rulesFromFilters(initialFilters));
  const [query, setQuery] = useState(initialQuery);
  const [logic, setLogic] = useState<FilterLogic>(initialLogic);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(
    () => resolveInitialColumns(initialColumns, columns, initialColumnsCustomized),
  );
  const [showColumns, setShowColumns] = useState(false);

  const activeRules = rules.filter((rule) => parseNumber(rule.value) != null);
  const activeRuleCount = activeRules.length;
  const pageStart = response.total === 0 ? 0 : response.offset + 1;
  const pageEnd = Math.min(response.offset + response.rows.length, response.total);
  const canGoBack = response.offset > 0;
  const canGoForward = response.offset + response.limit < response.total;
  const columnVisibility = useMemo<Record<string, boolean>>(
    () => Object.fromEntries(
      columns.map((column) => [String(column.key), visibleColumns.includes(column.key)]),
    ),
    [columns, visibleColumns],
  );
  const sortingState = useMemo(
    () => [{ id: response.sort, desc: response.direction === "desc" }],
    [response.direction, response.sort],
  );
  const tableColumns = useMemo<
    ColumnDef<typeof screenerTableFeatures, ScreenerRow, unknown>[]
  >(
    () => columns.map((column) => ({
      id: String(column.key),
      accessorFn: (row) => {
        if (column.key === "ticker") return row.ticker;
        if (column.key === "company") return row.company_name;
        if (column.key === "latest_period") return row.latest_period?.slice(0, 4) ?? "—";
        return column.metric ? metricNumber(row, column.metric) : null;
      },
      header: column.label,
      size: columnSize(column),
      enableHiding: column.key !== "ticker" && column.key !== "company",
      enableSorting: Boolean(column.sortable),
      sortDescFirst: column.key !== "ticker" && column.key !== "company",
      cell: ({ row }) => {
        const source = row.original;
        if (column.key === "ticker") {
          return <Link className={styles.ticker} href={`/ativos/${source.ticker}`}>{source.ticker}</Link>;
        }
        if (column.key === "company") return source.company_name;
        if (column.key === "latest_period") return source.latest_period ? source.latest_period.slice(0, 4) : "—";

        const passportSlug = column.metric
          ? passportSlugByMetric.get(column.metric)
          : undefined;
        const renderedValue = formatMetric(source, column);
        return passportSlug ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Link
                className={styles.metricPassportLink}
                href={`/ativos/${source.ticker}/indicadores?passport=${encodeURIComponent(passportSlug)}#data-passport`}
              >
                {renderedValue}
              </Link>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className={styles.researchTooltip}
                side="top"
                sideOffset={6}
              >
                Ver proveniência de {column.label} para {source.ticker}
                <Tooltip.Arrow className={styles.researchTooltipArrow} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : renderedValue;
      },
    })),
    [columns, passportSlugByMetric],
  );

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
      logic,
      columns: visibleColumns,
    }));
  }

  function clearFilters() {
    setRules([{ id: 1, metric: "roe", operator: "gte", value: "" }]);
    setQuery("");
    setLogic("and");
    navigate(buildSearchParams({
      query: "",
      filters: [],
      sort: "ticker",
      direction: "asc",
      logic: "and",
      columns: visibleColumns,
    }));
  }

  function applyColumns() {
    navigate(buildSearchParams({
      query: initialQuery,
      filters: initialFilters,
      sort: response.sort,
      direction: response.direction,
      logic: response.logic,
      columns: visibleColumns,
      offset: response.offset,
    }));
    setShowColumns(false);
  }

  function changePage(nextOffset: number) {
    navigate(buildSearchParams({
      query: initialQuery,
      filters: initialFilters,
      sort: response.sort,
      direction: response.direction,
      logic: response.logic,
      columns: visibleColumns,
      offset: Math.max(0, nextOffset),
    }));
  }

  const table = useTable(
    {
      features: screenerTableFeatures,
      columns: tableColumns,
      data: response.rows,
      manualSorting: true,
      enableMultiSort: false,
      enableSortingRemoval: false,
      initialState: {
        columnPinning: {
          start: ["ticker", "company"],
          end: [],
        },
      },
      state: {
        columnVisibility,
        sorting: sortingState,
      },
      onColumnVisibilityChange: (updater) => {
        const next = typeof updater === "function"
          ? updater(columnVisibility)
          : updater;
        setVisibleColumns([
          "ticker",
          "company",
          ...columns
            .filter((column) => column.key !== "ticker" && column.key !== "company")
            .filter((column) => next[String(column.key)] !== false)
            .map((column) => column.key),
        ]);
      },
      onSortingChange: (updater) => {
        const next = typeof updater === "function"
          ? updater(sortingState)
          : updater;
        const primary = next[0];
        const sort = primary?.id ?? "ticker";
        const direction = primary?.desc ? "desc" : "asc";
        navigate(buildSearchParams({
          query: initialQuery,
          filters: initialFilters,
          sort,
          direction,
          logic: response.logic,
          columns: visibleColumns,
        }));
      },
    },
    (state) => state,
  );

  const columnByKey = new Map(columns.map((column) => [String(column.key), column]));

  return (
    <Tooltip.Provider delayDuration={240} skipDelayDuration={120}>
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

        <div className={styles.logicControl}>
          <span>Combinação dos critérios</span>
          <div role="group" aria-label="Lógica dos filtros">
            <button
              type="button"
              className={logic === "and" ? styles.logicActive : ""}
              onClick={() => setLogic("and")}
            >
              Todas as condições
            </button>
            <button
              type="button"
              className={logic === "or" ? styles.logicActive : ""}
              onClick={() => setLogic("or")}
            >
              Qualquer condição
            </button>
          </div>
        </div>

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

        {activeRules.length ? (
          <div className={styles.querySummary} aria-label="Resumo da consulta">
            <strong>{logic === "and" ? "Todas devem ser verdadeiras" : "Basta uma ser verdadeira"}</strong>
            <div>
              {activeRules.map((rule) => {
                const metric = metricOptions.find((item) => item.key === rule.metric);
                return (
                  <span key={rule.id}>
                    {metric?.label ?? rule.metric} {operatorLabels[rule.operator]} {rule.value}
                    {metric?.unit ? ` ${metric.unit}` : ""}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

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
          <div><span>Lógica</span><strong>{response.logic === "and" ? "E" : "OU"}</strong></div>
          <div><span>Página</span><strong>{pageStart}-{pageEnd}</strong></div>
          <div><span>Universo</span><strong>{response.universe_total.toLocaleString("pt-BR")}</strong></div>
          <Popover.Root open={showColumns} onOpenChange={setShowColumns}>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="Escolher colunas visíveis"
              >
                Colunas
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className={styles.columnPicker}
                align="end"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
              >
                <div>
                  <strong>Escolha as colunas</strong>
                  <span>Ticker e empresa permanecem fixos.</span>
                </div>
                <div className={styles.columnOptions}>
                  {table.getAllLeafColumns().map((column) => (
                    <label key={column.id}>
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        disabled={!column.getCanHide()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span>{columnByKey.get(column.id)?.label ?? column.id}</span>
                    </label>
                  ))}
                </div>
                <div className={styles.columnPickerActions}>
                  <span>{visibleColumns.length} colunas selecionadas</span>
                  <div>
                    <Popover.Close asChild>
                      <button type="button" className={styles.columnPickerCancel}>
                        Fechar
                      </button>
                    </Popover.Close>
                    <button type="button" onClick={applyColumns} disabled={isPending}>
                      Aplicar colunas
                    </button>
                  </div>
                </div>
                <Popover.Arrow className={styles.columnPickerArrow} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        <div className={styles.tableShell}>
          <table
            className={styles.table}
            style={{
              width: Math.max(
                table.getVisibleLeafColumns().reduce((total, column) => total + column.getSize(), 0),
                920,
              ),
            }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const definition = columnByKey.get(header.column.id);
                    const isNumeric = definition?.kind === "currency"
                      || definition?.kind === "percent"
                      || definition?.kind === "multiple";
                    const sorted = header.column.getIsSorted();
                    const pinned = Boolean(header.column.getIsPinned());
                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={[
                          isNumeric ? styles.numeric : "",
                          pinned ? styles.pinnedCell : "",
                        ].filter(Boolean).join(" ")}
                        style={pinnedCellStyle(header.column, true)}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={isPending}
                            title={sorted === "asc" ? "Ordenar decrescente" : "Ordenar crescente"}
                          >
                            <table.FlexRender header={header} />
                            {sorted ? <span>{sorted === "asc" ? "↑" : "↓"}</span> : null}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const definition = columnByKey.get(cell.column.id);
                    const isNumeric = definition?.kind === "currency"
                      || definition?.kind === "percent"
                      || definition?.kind === "multiple";
                    const pinned = Boolean(cell.column.getIsPinned());
                    return (
                      <td
                        key={cell.id}
                        className={[
                          isNumeric ? styles.numeric : "",
                          definition?.key === "company" ? styles.company : "",
                          pinned ? styles.pinnedCell : "",
                        ].filter(Boolean).join(" ")}
                        style={pinnedCellStyle(cell.column)}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    className={styles.empty}
                    colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                  >
                    Nenhuma empresa atende aos critérios aplicados.
                  </td>
                </tr>
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
          <span>
            {response.logic === "and"
              ? "Lógica E: a empresa precisa atender a todos os filtros aplicados."
              : "Lógica OU: basta a empresa atender a um dos filtros aplicados."}
          </span>
          <span>Filtragem, ordenação por indicadores e paginação são processadas no backend sobre o universo pesquisado.</span>
        </footer>
      </div>
      </section>
    </Tooltip.Provider>
  );
}

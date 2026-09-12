"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { FinancialMetric, ScreenerRow } from "../../lib/api";
import styles from "./listas.module.css";

type ColumnKey =
  | "ticker"
  | "company_name"
  | "latest_period"
  | "financial_item_count"
  | "document_count"
  | "instrument_type"
  | "security_category"
  | "governance_level"
  | "cvm_code"
  | "isin"
  | FinancialMetric;

type PresetKey = "essential" | "results" | "margins" | "balance" | "cash" | "registry" | "custom";

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  group: "Identificação" | "Resultados" | "Margens" | "Balanço" | "Caixa" | "Cobertura";
  kind: "text" | "currency" | "percent" | "integer" | "date";
  metric?: FinancialMetric;
};

const columns: ColumnDefinition[] = [
  { key: "ticker", label: "Ticker", group: "Identificação", kind: "text" },
  { key: "company_name", label: "Empresa", group: "Identificação", kind: "text" },
  { key: "instrument_type", label: "Tipo", group: "Identificação", kind: "text" },
  { key: "security_category", label: "Categoria", group: "Identificação", kind: "text" },
  { key: "governance_level", label: "Governança", group: "Identificação", kind: "text" },
  { key: "cvm_code", label: "CVM", group: "Identificação", kind: "text" },
  { key: "isin", label: "ISIN", group: "Identificação", kind: "text" },
  { key: "latest_period", label: "Último período", group: "Cobertura", kind: "date" },
  { key: "financial_item_count", label: "Fatos CVM", group: "Cobertura", kind: "integer" },
  { key: "document_count", label: "Documentos", group: "Cobertura", kind: "integer" },
  { key: "revenue", label: "Receita", group: "Resultados", kind: "currency", metric: "revenue" },
  { key: "gross_profit", label: "Lucro bruto", group: "Resultados", kind: "currency", metric: "gross_profit" },
  { key: "operating_result", label: "Resultado op.", group: "Resultados", kind: "currency", metric: "operating_result" },
  { key: "net_income", label: "Lucro líquido", group: "Resultados", kind: "currency", metric: "net_income" },
  { key: "revenue_growth_yoy", label: "Receita YoY", group: "Resultados", kind: "percent", metric: "revenue_growth_yoy" },
  { key: "gross_margin", label: "Margem bruta", group: "Margens", kind: "percent", metric: "gross_margin" },
  { key: "operating_margin", label: "Margem op.", group: "Margens", kind: "percent", metric: "operating_margin" },
  { key: "net_margin", label: "Margem líquida", group: "Margens", kind: "percent", metric: "net_margin" },
  { key: "roe", label: "ROE", group: "Margens", kind: "percent", metric: "roe" },
  { key: "total_assets", label: "Ativos", group: "Balanço", kind: "currency", metric: "total_assets" },
  { key: "equity", label: "Patrimônio", group: "Balanço", kind: "currency", metric: "equity" },
  { key: "cash", label: "Caixa", group: "Balanço", kind: "currency", metric: "cash" },
  { key: "gross_debt", label: "Dívida bruta", group: "Balanço", kind: "currency", metric: "gross_debt" },
  { key: "net_debt", label: "Dívida líquida", group: "Balanço", kind: "currency", metric: "net_debt" },
  { key: "operating_cash_flow", label: "Caixa operacional", group: "Caixa", kind: "currency", metric: "operating_cash_flow" },
  { key: "investing_cash_flow", label: "Caixa investimentos", group: "Caixa", kind: "currency", metric: "investing_cash_flow" },
  { key: "financing_cash_flow", label: "Caixa financiamentos", group: "Caixa", kind: "currency", metric: "financing_cash_flow" },
  { key: "net_change_in_cash", label: "Variação caixa", group: "Caixa", kind: "currency", metric: "net_change_in_cash" },
];

const presets: Record<Exclude<PresetKey, "custom">, ColumnKey[]> = {
  essential: ["ticker", "company_name", "revenue", "net_income", "net_margin", "roe"],
  results: ["ticker", "company_name", "revenue", "revenue_growth_yoy", "gross_profit", "operating_result", "net_income"],
  margins: ["ticker", "company_name", "gross_margin", "operating_margin", "net_margin", "roe"],
  balance: ["ticker", "company_name", "total_assets", "equity", "cash", "gross_debt", "net_debt"],
  cash: ["ticker", "company_name", "operating_cash_flow", "investing_cash_flow", "financing_cash_flow", "net_change_in_cash"],
  registry: ["ticker", "company_name", "instrument_type", "governance_level", "cvm_code", "isin", "latest_period", "document_count"],
};

const presetLabels: Record<PresetKey, string> = {
  essential: "Essencial",
  results: "Resultados",
  margins: "Margens",
  balance: "Balanço",
  cash: "Caixa",
  registry: "Cadastro",
  custom: "Personalizada",
};

const defaultCustom: ColumnKey[] = ["ticker", "company_name", "revenue", "net_income", "net_margin", "roe", "net_debt"];
const storageKey = "openmarket-custom-list-columns";

function rawValue(row: ScreenerRow, column: ColumnDefinition): string | number | null {
  if (column.metric) {
    const value = row.metrics[column.metric];
    if (value == null) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  const value = row[column.key as keyof ScreenerRow];
  if (typeof value === "string" || typeof value === "number") return value;
  return value == null ? null : String(value);
}

function formatValue(row: ScreenerRow, column: ColumnDefinition) {
  const value = rawValue(row, column);
  if (value == null || value === "") return "—";

  if (column.kind === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: row.currency || "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (column.kind === "percent" && typeof value === "number") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;
  }
  if (column.kind === "integer" && typeof value === "number") {
    return new Intl.NumberFormat("pt-BR").format(value);
  }
  if (column.kind === "date" && typeof value === "string") {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  return String(value);
}

export function AssetListTable({ rows, total }: { rows: ScreenerRow[]; total: number }) {
  const [preset, setPreset] = useState<PresetKey>("essential");
  const [customColumns, setCustomColumns] = useState<ColumnKey[]>(defaultCustom);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey>("ticker");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ColumnKey[];
      const valid = parsed.filter((key) => columns.some((column) => column.key === key));
      if (valid.length >= 2) setCustomColumns(valid);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  const activeKeys = preset === "custom" ? customColumns : presets[preset];
  const activeColumns = activeKeys
    .map((key) => columns.find((column) => column.key === key))
    .filter((column): column is ColumnDefinition => Boolean(column));

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = needle
      ? rows.filter((row) => `${row.ticker} ${row.company_name} ${row.legal_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle))
      : rows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return filtered;
    return [...filtered].sort((left, right) => {
      const a = rawValue(left, column);
      const b = rawValue(right, column);
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      const result = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), "pt-BR", { numeric: true });
      return sortDirection === "asc" ? result : -result;
    });
  }, [query, rows, sortDirection, sortKey]);

  function toggleSort(key: ColumnKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

  function toggleCustomColumn(key: ColumnKey) {
    setCustomColumns((current) => {
      const exists = current.includes(key);
      if (exists && (key === "ticker" || current.length <= 2)) return current;
      const next = exists ? current.filter((item) => item !== key) : [...current, key];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  const groups = ["Identificação", "Resultados", "Margens", "Balanço", "Caixa", "Cobertura"] as const;

  return (
    <section className={styles.workspace}>
      <div className={styles.toolbar}>
        <div className={styles.presets} role="tablist" aria-label="Listas de ativos">
          {(Object.keys(presetLabels) as PresetKey[]).map((key) => (
            <button
              className={preset === key ? styles.activePreset : ""}
              key={key}
              onClick={() => setPreset(key)}
              type="button"
            >
              {presetLabels[key]}
            </button>
          ))}
        </div>
        <div className={styles.searchBox}>
          <input
            aria-label="Filtrar lista"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar ticker ou empresa"
            value={query}
          />
          <span>{visibleRows.length}/{total}</span>
        </div>
      </div>

      {preset === "custom" && (
        <div className={styles.columnPicker}>
          <div className={styles.columnPickerHeading}>
            <div>
              <strong>Monte sua lista</strong>
              <span>Escolha os campos. A seleção fica salva neste navegador.</span>
            </div>
            <button
              onClick={() => {
                setCustomColumns(defaultCustom);
                window.localStorage.setItem(storageKey, JSON.stringify(defaultCustom));
              }}
              type="button"
            >
              Restaurar padrão
            </button>
          </div>
          <div className={styles.columnGroups}>
            {groups.map((group) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {columns.filter((column) => column.group === group).map((column) => (
                  <label key={column.key}>
                    <input
                      checked={customColumns.includes(column.key)}
                      disabled={column.key === "ticker"}
                      onChange={() => toggleCustomColumn(column.key)}
                      type="checkbox"
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tableShell}>
        <table className={styles.assetTable}>
          <thead>
            <tr>
              {activeColumns.map((column) => (
                <th key={column.key} className={column.kind !== "text" && column.kind !== "date" ? styles.numeric : ""}>
                  <button onClick={() => toggleSort(column.key)} type="button">
                    {column.label}
                    {sortKey === column.key && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.exchange}-${row.ticker}`}>
                {activeColumns.map((column) => {
                  const value = formatValue(row, column);
                  const numeric = column.kind === "currency" || column.kind === "percent" || column.kind === "integer";
                  return (
                    <td className={numeric ? styles.numeric : ""} key={column.key} title={value}>
                      {column.key === "ticker" ? (
                        <Link className={styles.tickerLink} href={`/ativos/${row.ticker}`}>{row.ticker}</Link>
                      ) : column.key === "company_name" ? (
                        <span className={styles.companyName}>{value}</span>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td className={styles.empty} colSpan={activeColumns.length}>Nenhum ativo encontrado nesta lista.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className={styles.tableFooter}>
        <span>Universo atual: ativos já sincronizados no OpenMarket.</span>
        <span>Dados financeiros: demonstrações anuais consolidadas da CVM.</span>
      </footer>
    </section>
  );
}

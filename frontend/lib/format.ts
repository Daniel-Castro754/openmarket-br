import type { SeriesFrequency, SeriesUnit } from "./api";

export const DATA_EMPTY = "—";
export const DATA_NOT_AVAILABLE = "N/D";
export const DATA_NOT_APPLICABLE = "N/A";

type FinancialFormatOptions = {
  currency?: string | null;
  compact?: boolean;
  showCurrency?: boolean;
  percentDigits?: number;
  multipleDigits?: number;
  fallback?: string;
};

type NumericFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
};

const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.NumberFormatOptions) {
  const key = JSON.stringify(options);
  const cached = numberFormatters.get(key);
  if (cached) return cached;
  const created = new Intl.NumberFormat("pt-BR", options);
  numberFormatters.set(key, created);
  return created;
}

function dateFormatter(options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(options);
  const cached = dateFormatters.get(key);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat("pt-BR", options);
  dateFormatters.set(key, created);
  return created;
}

function utcDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

export function formatNumberPtBr(
  value: string | number | null | undefined,
  options: NumericFormatOptions = {},
) {
  const fallback = options.fallback ?? DATA_EMPTY;
  if (value == null || String(value).trim() === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return formatter({
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(numeric);
}

export function formatMacroValue(
  value: string | number | null | undefined,
  unit: string,
  options: NumericFormatOptions = {},
) {
  const minimumFractionDigits = options.minimumFractionDigits
    ?? (unit.includes("R$/") ? 2 : unit.startsWith("%") ? 1 : 1);
  const formatted = formatNumberPtBr(value, {
    ...options,
    minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
  if (formatted === (options.fallback ?? DATA_EMPTY)) return formatted;
  if (unit.startsWith("%")) return `${formatted}%`;
  if (unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

export function formatFinancialValue(
  value: string | number | null | undefined,
  unit: SeriesUnit,
  options: FinancialFormatOptions = {},
) {
  const fallback = options.fallback ?? DATA_EMPTY;
  if (value == null || String(value).trim() === "") return fallback;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  if (unit === "percent") {
    const digits = options.percentDigits ?? 2;
    return `${formatter({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(numeric)}%`;
  }

  if (unit === "multiple") {
    const digits = options.multipleDigits ?? 2;
    return `${formatter({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(numeric)}x`;
  }

  if (options.showCurrency === false) {
    return formatter({
      notation: options.compact === false ? "standard" : "compact",
      maximumFractionDigits: options.compact === false ? 2 : 1,
    }).format(numeric);
  }

  return formatter({
    style: "currency",
    currency: options.currency ?? "BRL",
    notation: options.compact === false ? "standard" : "compact",
    maximumFractionDigits: options.compact === false ? 2 : 1,
  }).format(numeric);
}

export function formatPeriod(
  periodEnd?: string | null,
  frequency: SeriesFrequency = "annual",
  fallback = "Sem período",
) {
  if (!periodEnd) return fallback;
  const [year, month] = periodEnd.split("-").map(Number);
  if (!Number.isFinite(year)) return periodEnd;
  if (frequency === "annual") return String(year);

  const quarter = Math.max(1, Math.min(4, Math.ceil((Number.isFinite(month) ? month : 12) / 3)));
  return `${quarter}T${String(year).slice(-2)}`;
}

export function formatYear(period?: string | null, fallback = "Sem período") {
  if (!period) return fallback;
  const year = period.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : period;
}

export function formatDatePtBr(value?: string | null, fallback = DATA_EMPTY) {
  if (!value) return fallback;
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter({
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateShortPtBr(value?: string | null, fallback = DATA_EMPTY) {
  if (!value) return fallback;
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter({
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthShortPtBr(value?: string | null, fallback = DATA_EMPTY) {
  if (!value) return fallback;
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter({ month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

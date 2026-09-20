import { getIndicatorCatalog, getScreener } from "../../lib/api";
import { ScreenerWorkspace } from "./screener-workspace";
import styles from "./screener.module.css";

export const dynamic = "force-dynamic";

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value?: string | string[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseOffset(value?: string) {
  const numeric = Number(value ?? 0);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
    sort?: string | string[];
    direction?: string | string[];
    offset?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const q = firstValue(query.q)?.trim() || undefined;
  const filters = allValues(query.filter);
  const sort = firstValue(query.sort) || "ticker";
  const direction = firstValue(query.direction) === "desc" ? "desc" : "asc";
  const offset = parseOffset(firstValue(query.offset));
  const limit = 50;

  const [screener, indicatorCatalog] = await Promise.all([
    getScreener({ q, filters, sort, direction, offset, limit }),
    getIndicatorCatalog(),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className="eyebrow">SCREENER · CVM</span>
          <h1>Screener fundamentalista</h1>
          <p>Filtre, ordene e compare empresas usando apenas indicadores disponíveis na base sincronizada.</p>
        </div>
        <div className={styles.headerStats} aria-label="Resumo do universo do screener">
          <div><strong>{screener.universe_total.toLocaleString("pt-BR")}</strong><span>universo</span></div>
          <div><strong>{screener.total.toLocaleString("pt-BR")}</strong><span>resultados</span></div>
          <div><strong>{screener.applied_filters}</strong><span>filtros</span></div>
          <div><strong>CVM</strong><span>fonte</span></div>
        </div>
      </header>

      <ScreenerWorkspace
        response={screener}
        indicatorCatalog={indicatorCatalog}
        initialQuery={q ?? ""}
        initialFilters={filters}
      />
    </main>
  );
}

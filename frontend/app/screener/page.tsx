import { getScreener } from "../../lib/api";
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

  const screener = await getScreener({
    q,
    filters,
    sort,
    direction,
    offset,
    limit,
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">SCREENER FUNDAMENTALISTA · CVM</span>
          <h1>Filtre empresas por fundamentos reais.</h1>
          <p>
            Filtros, ordenação e paginação são processados pela API sobre o universo sincronizado. A interface não
            precisa mais limitar a análise ao primeiro lote carregado no navegador.
          </p>
        </div>
        <div className={styles.headerStats} aria-label="Resumo do universo do screener">
          <div><strong>{screener.universe_total.toLocaleString("pt-BR")}</strong><span>ativos pesquisados</span></div>
          <div><strong>{screener.total.toLocaleString("pt-BR")}</strong><span>após os filtros</span></div>
          <div><strong>CVM</strong><span>fonte financeira</span></div>
        </div>
      </header>

      <ScreenerWorkspace
        response={screener}
        initialQuery={q ?? ""}
        initialFilters={filters}
      />
    </main>
  );
}

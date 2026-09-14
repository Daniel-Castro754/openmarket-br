import Link from "next/link";

import {
  getDocuments,
  type DocumentProcessingStatus,
  type DocumentType,
} from "../../lib/api";
import styles from "./report-viewer.module.css";

const PAGE_SIZE = 24;

const typeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: "dfp", label: "DFP" },
  { value: "itr", label: "ITR" },
  { value: "fre", label: "FRE" },
  { value: "material_fact", label: "Fato relevante" },
  { value: "earnings_release", label: "Release de resultados" },
  { value: "presentation", label: "Apresentação" },
  { value: "annual_report", label: "Relatório anual" },
  { value: "other", label: "Outros" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function typeLabel(value: DocumentType) {
  return typeOptions.find((item) => item.value === value)?.label ?? value;
}

function statusClass(status: DocumentProcessingStatus) {
  if (status === "ready") return styles.statusReady;
  if (status === "failed") return styles.statusFailed;
  return styles.statusPending;
}

function statusLabel(status: DocumentProcessingStatus) {
  if (status === "ready") return "Pronto";
  if (status === "failed") return "Falhou";
  return "Metadados";
}

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value?: string | string[]) {
  const parsed = Number.parseInt(firstValue(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function reportsHref({
  q,
  ticker,
  documentType,
  page,
}: {
  q: string;
  ticker: string;
  documentType?: DocumentType;
  page: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (ticker) params.set("ticker", ticker);
  if (documentType) params.set("type", documentType);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/relatorios?${suffix}` : "/relatorios";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    ticker?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const q = firstValue(query.q)?.trim() ?? "";
  const ticker = firstValue(query.ticker)?.trim().toUpperCase() ?? "";
  const rawType = firstValue(query.type);
  const documentType = typeOptions.find((item) => item.value === rawType)?.value;
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await getDocuments({
    q: q || undefined,
    ticker: ticker || undefined,
    documentType,
    limit: PAGE_SIZE + 1,
    offset,
  });
  const documents = result.slice(0, PAGE_SIZE);
  const hasNext = result.length > PAGE_SIZE;
  const hasFilters = Boolean(q || ticker || documentType);

  return (
    <main className={`${styles.shell} ${styles.libraryShell}`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>DOCUMENT HUB · CVM</span>
          <h1>Relatórios e documentos</h1>
          <p>Pesquise a biblioteca sincronizada e abra a evidência original sem sair do fluxo de análise.</p>
        </div>
        <div className={styles.headerMeta}>
          <span>{documents.length} nesta página</span>
          <span>Página {page}</span>
          <strong>Fonte oficial</strong>
        </div>
      </header>

      <form className={styles.filters} method="get">
        <input name="q" defaultValue={q} placeholder="Título ou período" aria-label="Buscar por título ou período" />
        <input name="ticker" defaultValue={ticker} placeholder="Ticker, ex.: PETR4" aria-label="Filtrar por ticker" />
        <select name="type" defaultValue={documentType ?? ""} aria-label="Filtrar por tipo">
          <option value="">Todos os tipos</option>
          {typeOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="submit">Aplicar</button>
        {hasFilters ? <Link className={styles.clearFilters} href="/relatorios">Limpar</Link> : null}
      </form>

      {documents.length === 0 ? (
        <section className={styles.empty}>
          Nenhum documento encontrado para os filtros atuais.
          {page > 1 ? " Volte uma página para continuar navegando." : ""}
        </section>
      ) : (
        <section className={styles.libraryTablePanel}>
          <div className={styles.libraryTableWrap}>
            <table className={styles.libraryTable}>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Referência</th>
                  <th>Publicado</th>
                  <th>Status</th>
                  <th>Fonte</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <div className={styles.documentCell}>
                        <strong>{document.tickers[0] ?? document.company_name ?? "—"}</strong>
                        <span>{document.title}</span>
                        {document.company_name ? <small>{document.company_name}</small> : null}
                      </div>
                    </td>
                    <td><span className={styles.badge}>{typeLabel(document.document_type)}</span></td>
                    <td>{document.reference_period ?? "—"}</td>
                    <td>{formatDate(document.published_at)}</td>
                    <td><span className={statusClass(document.processing_status)}>{statusLabel(document.processing_status)}</span></td>
                    <td>{document.source.source_name}</td>
                    <td><Link className={styles.openDocument} href={`/relatorios/${document.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <nav className={styles.pagination} aria-label="Paginação de documentos">
        {page > 1 ? (
          <Link href={reportsHref({ q, ticker, documentType, page: page - 1 })}>← Anterior</Link>
        ) : (
          <span className={styles.paginationDisabled}>← Anterior</span>
        )}
        <span>Página {page}</span>
        {hasNext ? (
          <Link href={reportsHref({ q, ticker, documentType, page: page + 1 })}>Próxima →</Link>
        ) : (
          <span className={styles.paginationDisabled}>Próxima →</span>
        )}
      </nav>
    </main>
  );
}

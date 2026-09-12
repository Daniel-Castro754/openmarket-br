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
  if (!value) return "Data não informada";
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
  if (status === "ready") return "processado";
  if (status === "failed") return "falhou";
  return "metadados";
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
    <main className={styles.shell}>
      <nav className={styles.topbar}>
        <Link href="/">← OpenMarket BR</Link>
        <span>Document Hub / Relatórios</span>
      </nav>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>DOCUMENT HUB</span>
          <h1>Relatórios</h1>
          <p>
            Biblioteca pública de documentos corporativos da CVM, com proveniência, filtros por ticker
            e acesso ao documento oficial dentro do workspace.
          </p>
        </div>
      </header>

      <form className={styles.filters} method="get">
        <input name="q" defaultValue={q} placeholder="Buscar por título ou período" />
        <input name="ticker" defaultValue={ticker} placeholder="Ticker, ex.: PETR4" />
        <select name="type" defaultValue={documentType ?? ""}>
          <option value="">Todos os tipos</option>
          {typeOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="submit">Filtrar</button>
      </form>

      <div className={styles.librarySummary}>
        <div>
          <strong>{documents.length}</strong> documentos nesta página
          {ticker ? <span> · {ticker}</span> : null}
          {documentType ? <span> · {typeLabel(documentType)}</span> : null}
        </div>
        <div className={styles.summaryActions}>
          <span>Página {page}</span>
          {hasFilters ? <Link href="/relatorios">Limpar filtros</Link> : null}
        </div>
      </div>

      {documents.length === 0 ? (
        <section className={styles.empty}>
          Nenhum documento encontrado para os filtros atuais.
          {page > 1 ? " Volte uma página para continuar navegando." : ""}
        </section>
      ) : (
        <section className={styles.libraryGrid}>
          {documents.map((document) => (
            <Link className={styles.card} href={`/relatorios/${document.id}`} key={document.id}>
              <div className={styles.cardTop}>
                <span className={styles.badge}>{typeLabel(document.document_type)}</span>
                <span className={statusClass(document.processing_status)}>
                  {statusLabel(document.processing_status)}
                </span>
              </div>
              <h2>{document.title}</h2>
              <p>
                {document.company_name ?? "Companhia não vinculada"}
                {document.tickers.length ? ` · ${document.tickers.join(" / ")}` : ""}
              </p>
              <div className={styles.cardMeta}>
                <span>{formatDate(document.published_at)}</span>
                {document.reference_period && <span>Referência {document.reference_period}</span>}
                {document.page_count != null && <span>{document.page_count} páginas</span>}
                <span>{document.source.source_name}</span>
              </div>
            </Link>
          ))}
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

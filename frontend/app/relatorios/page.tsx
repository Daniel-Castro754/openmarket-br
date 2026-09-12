import Link from "next/link";

import {
  getDocuments,
  type DocumentProcessingStatus,
  type DocumentType,
} from "../../lib/api";
import styles from "./report-viewer.module.css";

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

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    ticker?: string | string[];
    type?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const q = firstValue(query.q)?.trim() ?? "";
  const ticker = firstValue(query.ticker)?.trim().toUpperCase() ?? "";
  const rawType = firstValue(query.type);
  const documentType = typeOptions.find((item) => item.value === rawType)?.value;

  const documents = await getDocuments({
    q: q || undefined,
    ticker: ticker || undefined,
    documentType,
  });

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
            Biblioteca pública de documentos corporativos com proveniência, navegação por conteúdo e
            preparação para análise com citações.
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

      {documents.length === 0 ? (
        <section className={styles.empty}>
          Nenhum documento encontrado para os filtros atuais. A biblioteca ficará preenchida conforme os
          providers públicos forem sincronizados.
        </section>
      ) : (
        <section className={styles.libraryGrid}>
          {documents.map((document) => (
            <Link className={styles.card} href={`/relatorios/${document.id}`} key={document.id}>
              <div className={styles.cardTop}>
                <span className={styles.badge}>{typeLabel(document.document_type)}</span>
                <span className={statusClass(document.processing_status)}>
                  {document.processing_status}
                </span>
              </div>
              <h2>{document.title}</h2>
              <p>
                {document.company_name ?? "Companhia não vinculada"}
                {document.tickers.length ? ` · ${document.tickers.join(" / ")}` : ""}
              </p>
              <div className={styles.cardMeta}>
                <span>{formatDate(document.published_at)}</span>
                {document.reference_period && <span>Período {document.reference_period}</span>}
                {document.page_count != null && <span>{document.page_count} páginas</span>}
                <span>{document.source.source_name}</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

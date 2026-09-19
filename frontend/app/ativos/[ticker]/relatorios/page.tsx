import Link from "next/link";

import { getDocuments, type DocumentProcessingStatus } from "../../../../lib/api";
import {
  categoryCounts,
  documentCategory,
  documentCategoryLabel,
  documentCategoryOptions,
  type DocumentCategory,
} from "../../../../lib/document-taxonomy";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function documentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    dfp: "DFP",
    itr: "ITR",
    fre: "FRE",
    material_fact: "Fato relevante",
    earnings_release: "Release",
    presentation: "Apresentação",
    annual_report: "Relatório anual",
    other: "Documento",
  };
  return labels[value] ?? value;
}

function statusLabel(status: DocumentProcessingStatus, hasOriginal: boolean) {
  if (status === "ready") return "Texto extraído";
  if (status === "failed") return "Falha na extração";
  if (hasOriginal) return "Original disponível";
  return "Aguardando processamento";
}

function normalizeCategory(value?: string): DocumentCategory | null {
  return documentCategoryOptions.some((item) => item.value === value)
    ? (value as DocumentCategory)
    : null;
}

function categoryHref(ticker: string, category: DocumentCategory | null) {
  if (!category) return `/ativos/${ticker}/relatorios`;
  return `/ativos/${ticker}/relatorios?category=${category}`;
}

export default async function AssetReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams]);
  const ticker = rawTicker.trim().toUpperCase();
  const rawCategory = Array.isArray(query.category) ? query.category[0] : query.category;
  const selectedCategory = normalizeCategory(rawCategory);
  const documents = await getDocuments({ ticker, limit: 100 });
  const counts = categoryCounts(documents);
  const visibleDocuments = selectedCategory
    ? documents.filter((document) => documentCategory(document) === selectedCategory)
    : documents;

  return (
    <section className="asset-doc-workspace asset-reports-workspace" id="relatorios">
      <header className="asset-doc-header">
        <div className="asset-doc-header-copy">
          <span className="eyebrow">DOCUMENTOS</span>
          <h2>Relatórios e arquivos oficiais de {ticker}</h2>
          <p>
            Biblioteca documental organizada por finalidade, com período de referência, origem e estado de processamento.
          </p>
        </div>

        <div className="asset-doc-header-actions">
          <span className="asset-doc-source">CVM + fontes sincronizadas</span>
          <span className="asset-doc-count">{documents.length} arquivos</span>
          <Link className="asset-doc-header-link" href={`/relatorios?ticker=${ticker}`}>
            Abrir Document Hub →
          </Link>
        </div>
      </header>

      <nav className="asset-doc-filters" aria-label="Categorias de documentos">
        <Link
          href={categoryHref(ticker, null)}
          className={!selectedCategory ? "asset-doc-filter asset-doc-filter-active" : "asset-doc-filter"}
        >
          Todos <strong>{documents.length}</strong>
        </Link>
        {documentCategoryOptions.map((option) => (
          <Link
            href={categoryHref(ticker, option.value)}
            key={option.value}
            className={
              selectedCategory === option.value
                ? "asset-doc-filter asset-doc-filter-active"
                : "asset-doc-filter"
            }
          >
            {option.label} <strong>{counts.get(option.value) ?? 0}</strong>
          </Link>
        ))}
      </nav>

      <div className="asset-doc-list-shell">
        <div className="asset-doc-list-head" aria-hidden="true">
          <span>Tipo / data</span>
          <span>Documento</span>
          <span>Status</span>
        </div>

        <div className="asset-doc-list">
          {visibleDocuments.map((document) => {
            const category = documentCategory(document);
            const ready = document.processing_status === "ready";
            return (
              <Link className="asset-doc-row" href={`/relatorios/${document.id}`} key={document.id}>
                <div className="asset-doc-meta">
                  <span className="asset-doc-type">{documentTypeLabel(document.document_type)}</span>
                  <span className="asset-doc-date">{formatDate(document.published_at)}</span>
                </div>

                <div className="asset-doc-main">
                  <h3>{document.title}</h3>
                  <div className="asset-doc-subline">
                    <span className="asset-doc-category">{documentCategoryLabel(category)}</span>
                    {document.reference_period ? <span>Referência: {document.reference_period}</span> : null}
                    <span>{document.source.source_name}</span>
                  </div>
                </div>

                <div className="asset-doc-side">
                  <span className={`asset-doc-status ${ready ? "asset-doc-status-ready" : ""}`}>
                    {statusLabel(document.processing_status, Boolean(document.source_url))}
                  </span>
                  <span className="asset-doc-open">Abrir →</span>
                </div>
              </Link>
            );
          })}

          {visibleDocuments.length === 0 ? (
            <div className="asset-doc-empty">
              Nenhum documento encontrado nesta categoria para {ticker}.
            </div>
          ) : null}
        </div>
      </div>

      <div className="asset-doc-note">
        <strong>
          {selectedCategory ? documentCategoryLabel(selectedCategory) : "Biblioteca completa"}
        </strong>
        <span>
          As categorias usam o tipo oficial quando disponível e uma classificação auxiliar pelo título nos documentos genéricos.
        </span>
      </div>
    </section>
  );
}

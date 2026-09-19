import Link from "next/link";

import { getDocuments } from "../../../../lib/api";
import {
  categoryCounts,
  documentCategory,
  documentCategoryLabel,
  documentCategoryOptions,
  sourceClassificationLabel,
  type DocumentCategory,
} from "../../../../lib/document-taxonomy";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function monthLabel(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
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

function normalizeCategory(value?: string): DocumentCategory | null {
  return documentCategoryOptions.some((item) => item.value === value)
    ? (value as DocumentCategory)
    : null;
}

function categoryHref(ticker: string, category: DocumentCategory | null) {
  if (!category) return `/ativos/${ticker}/eventos`;
  return `/ativos/${ticker}/eventos?category=${category}`;
}

export default async function AssetEventsPage({
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

  const groups = new Map<string, typeof visibleDocuments>();
  for (const document of visibleDocuments) {
    const key = document.published_at?.slice(0, 7) ?? "unknown";
    const current = groups.get(key) ?? [];
    current.push(document);
    groups.set(key, current);
  }

  return (
    <section className="asset-doc-workspace asset-events-workspace" id="eventos">
      <header className="asset-doc-header">
        <div className="asset-doc-header-copy">
          <span className="eyebrow">EVENTOS E COMUNICADOS</span>
          <h2>Linha do tempo de {ticker}</h2>
          <p>
            Publicações oficiais organizadas cronologicamente para mostrar o que mudou na companhia e em qual contexto.
          </p>
        </div>

        <div className="asset-doc-header-actions">
          <span className="asset-doc-source">Fonte oficial</span>
          <span className="asset-doc-count">{visibleDocuments.length} eventos</span>
          <Link className="asset-doc-header-link" href={`/ativos/${ticker}/relatorios`}>
            Ver biblioteca →
          </Link>
        </div>
      </header>

      <nav className="asset-doc-filters" aria-label="Categorias de eventos">
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

      <div className="asset-event-timeline">
        {[...groups.entries()].map(([month, monthDocuments]) => (
          <section className="asset-event-month" key={month}>
            <div className="asset-event-month-label">
              {month === "unknown" ? "Sem data" : monthLabel(`${month}-01`)}
              <strong>{monthDocuments.length}</strong>
            </div>

            <div className="asset-event-month-list">
              {monthDocuments.map((document) => {
                const category = documentCategory(document);
                return (
                  <Link
                    className="asset-event-row"
                    href={`/relatorios/${document.id}`}
                    key={document.id}
                  >
                    <div className="asset-event-date">
                      <span>{formatDate(document.published_at)}</span>
                      <small>{documentTypeLabel(document.document_type)}</small>
                    </div>

                    <div className="asset-event-content">
                      <div className="asset-event-category">
                        {documentCategoryLabel(category)}
                      </div>
                      <h3>{document.title}</h3>
                      <div className="asset-doc-subline">
                        {sourceClassificationLabel(document) ? (
                          <span>CVM: {sourceClassificationLabel(document)}</span>
                        ) : null}
                        {document.reference_period ? <span>Referência: {document.reference_period}</span> : null}
                        <span>{document.source.source_name}</span>
                      </div>
                    </div>

                    <span className="asset-doc-open">Abrir →</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {visibleDocuments.length === 0 ? (
          <div className="asset-doc-empty">
            Nenhum evento encontrado nesta categoria para {ticker}.
          </div>
        ) : null}
      </div>

      <div className="asset-doc-note">
        <strong>Linha do tempo</strong>
        <span>
          Eventos prioriza sequência e contexto. Relatórios mantém a biblioteca completa para exploração documental.
        </span>
      </div>
    </section>
  );
}

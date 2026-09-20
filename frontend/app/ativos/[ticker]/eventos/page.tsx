import Link from "next/link";

import {
  getCompanyEvents,
  type CompanyEvent,
  type CompanyEventCategory,
  type CompanyEventType,
} from "../../../../lib/api";

const categoryOptions: Array<{ value: CompanyEventCategory; label: string }> = [
  { value: "results", label: "Resultados" },
  { value: "material", label: "Comunicados" },
  { value: "governance", label: "Governança" },
  { value: "finance", label: "Financeiro / Dívida" },
  { value: "operations", label: "Operacional" },
  { value: "calendar", label: "Calendário" },
  { value: "regulatory", label: "Regulatório" },
  { value: "other", label: "Outros" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function eventTypeLabel(value: CompanyEventType) {
  const labels: Record<CompanyEventType, string> = {
    material_fact: "Fato relevante",
    earnings: "Resultados",
    filing: "Documento periódico",
    presentation: "Apresentação",
    annual_report: "Relatório anual",
    governance: "Governança",
    document: "Documento",
  };
  return labels[value];
}

function categoryLabel(value: CompanyEventCategory) {
  return categoryOptions.find((item) => item.value === value)?.label ?? "Outros";
}

function normalizeCategory(value?: string): CompanyEventCategory | null {
  return categoryOptions.some((item) => item.value === value)
    ? (value as CompanyEventCategory)
    : null;
}

function categoryHref(ticker: string, category: CompanyEventCategory | null) {
  if (!category) return `/ativos/${ticker}/eventos`;
  return `/ativos/${ticker}/eventos?category=${category}`;
}

function eventRow(event: CompanyEvent) {
  return (
    <>
      <div className="asset-event-date">
        <span>{formatDate(event.event_date)}</span>
        <small>{eventTypeLabel(event.event_type)}</small>
      </div>

      <div className="asset-event-content">
        <div className="asset-event-category">{categoryLabel(event.category)}</div>
        <h3>{event.title}</h3>
        <div className="asset-doc-subline">
          {event.source_classification ? <span>CVM: {event.source_classification}</span> : null}
          {event.reference_period ? <span>Referência: {event.reference_period}</span> : null}
          <span>{event.source.source_name}</span>
        </div>
      </div>

      <span className="asset-doc-open">
        {event.source_document_id ? "Abrir →" : "Evento"}
      </span>
    </>
  );
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

  const timeline = await getCompanyEvents({ ticker, limit: 100 });
  const events = timeline.events;
  const counts = new Map<CompanyEventCategory, number>(
    categoryOptions.map((option) => [option.value, 0]),
  );
  for (const event of events) {
    counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
  }

  const visibleEvents = selectedCategory
    ? events.filter((event) => event.category === selectedCategory)
    : events;

  const groups = new Map<string, CompanyEvent[]>();
  for (const event of visibleEvents) {
    const key = event.event_date.slice(0, 7);
    const current = groups.get(key) ?? [];
    current.push(event);
    groups.set(key, current);
  }

  return (
    <section className="asset-doc-workspace asset-events-workspace" id="eventos">
      <header className="asset-doc-header">
        <div className="asset-doc-header-copy">
          <span className="eyebrow">EVENTOS E COMUNICADOS</span>
          <h2>Linha do tempo de {ticker}</h2>
          <p>
            Eventos corporativos derivados de fontes oficiais e organizados em uma timeline única da companhia.
          </p>
        </div>

        <div className="asset-doc-header-actions">
          <span className="asset-doc-source">Fonte oficial</span>
          <span className="asset-doc-count">{visibleEvents.length} eventos</span>
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
          Todos <strong>{events.length}</strong>
        </Link>
        {categoryOptions.map((option) => (
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
        {[...groups.entries()].map(([month, monthEvents]) => (
          <section className="asset-event-month" key={month}>
            <div className="asset-event-month-label">
              {monthLabel(`${month}-01`)}
              <strong>{monthEvents.length}</strong>
            </div>

            <div className="asset-event-month-list">
              {monthEvents.map((event) =>
                event.source_document_id ? (
                  <Link
                    className="asset-event-row"
                    href={`/relatorios/${event.source_document_id}`}
                    key={event.id}
                  >
                    {eventRow(event)}
                  </Link>
                ) : (
                  <article className="asset-event-row" key={event.id}>
                    {eventRow(event)}
                  </article>
                ),
              )}
            </div>
          </section>
        ))}

        {visibleEvents.length === 0 ? (
          <div className="asset-doc-empty">
            Nenhum evento encontrado nesta categoria para {ticker}.
          </div>
        ) : null}
      </div>

      <div className="asset-doc-note">
        <strong>Timeline unificada</strong>
        <span>
          A linha do tempo é um read-model derivado das fontes persistidas. Relatórios mantém o documento original e sua proveniência.
        </span>
      </div>
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { getDocument } from "../../../lib/api";
import styles from "../report-viewer.module.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function pagesLabel(pageStart?: number | null, pageEnd?: number | null) {
  if (pageStart == null) return "Página não informada";
  if (pageEnd == null || pageEnd === pageStart) return `Página ${pageStart}`;
  return `Páginas ${pageStart}–${pageEnd}`;
}

export default async function ReportViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();

  return (
    <main className={styles.shell}>
      <nav className={styles.topbar}>
        <Link href="/relatorios">← Biblioteca de relatórios</Link>
        <span>{document.tickers.length ? document.tickers.join(" / ") : "Documento público"}</span>
      </nav>

      <header className={styles.viewerHeader}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>{document.document_type}</span>
          {document.reference_period && <span className={styles.badge}>{document.reference_period}</span>}
          <span className={styles.badge}>{document.processing_status}</span>
        </div>
        <h1>{document.title}</h1>
        <p>
          {document.company_name ?? "Companhia não vinculada"} · {formatDate(document.published_at)} · {document.source.source_name}
        </p>
      </header>

      <section className={styles.viewerGrid}>
        <aside className={styles.sidebar}>
          <span className={styles.eyebrow}>NAVEGAÇÃO</span>
          <h2>Índice do documento</h2>
          <div className={styles.sectionNav}>
            {document.sections.map((section) => (
              <a href={`#sec-${section.sequence}`} key={section.id}>
                {section.heading ?? `Seção ${section.sequence}`} · {pagesLabel(section.page_start, section.page_end)}
              </a>
            ))}
            {document.sections.length === 0 && (
              <span className={styles.pageLabel}>Texto extraído ainda não disponível.</span>
            )}
          </div>
          <dl className={styles.metaList}>
            <div><dt>Período</dt><dd>{document.reference_period ?? "—"}</dd></div>
            <div><dt>Publicado</dt><dd>{formatDate(document.published_at)}</dd></div>
            <div><dt>Páginas</dt><dd>{document.page_count ?? "—"}</dd></div>
            <div><dt>Formato</dt><dd>{document.content_type}</dd></div>
          </dl>
          {document.source_url && (
            <a className={styles.originalLink} href={document.source_url} target="_blank" rel="noreferrer">
              Abrir documento original ↗
            </a>
          )}
        </aside>

        <article className={styles.documentPane}>
          <span className={styles.eyebrow}>DOCUMENTO</span>
          <h2>Conteúdo navegável</h2>
          {document.sections.length === 0 ? (
            <section className={styles.empty}>
              Este documento ainda não possui texto extraído. Os metadados e o link da fonte continuam disponíveis.
            </section>
          ) : (
            document.sections.map((section) => (
              <section className={styles.documentSection} id={`sec-${section.sequence}`} key={section.id}>
                <div className={styles.pageLabel}>{pagesLabel(section.page_start, section.page_end)}</div>
                <h2>{section.heading ?? `Seção ${section.sequence}`}</h2>
                <p>{section.text}</p>
              </section>
            ))
          )}
        </article>

        <aside className={styles.analysisPane}>
          <span className={styles.eyebrow}>ANÁLISE</span>
          <h2>Painel lateral</h2>
          <div className={styles.analysisCard}>
            <strong>Resumo executivo</strong>
            <p>Entrará quando o analisador estruturado estiver conectado ao documento.</p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Métricas e tickers</strong>
            <p>A próxima etapa extrairá métricas, empresas citadas, riscos, catalisadores e recomendações com citações.</p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Proveniência</strong>
            <p>
              {document.source.source_name} · qualidade {document.source.quality} · licença {document.source.license.license_id}.
            </p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Estado de processamento</strong>
            <p>{document.processing_status}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

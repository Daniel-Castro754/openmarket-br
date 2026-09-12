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

function processingLabel(status: string) {
  if (status === "ready") return "Texto extraído";
  if (status === "failed") return "Falha no processamento";
  return "Metadados sincronizados";
}

export default async function ReportViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();

  const hasOriginal = Boolean(document.source_url);
  const hasExtractedText = document.sections.length > 0;

  return (
    <main className={`${styles.shell} ${styles.viewerShell}`}>
      <nav className={styles.topbar}>
        <Link href="/relatorios">← Biblioteca de relatórios</Link>
        <span>{document.tickers.length ? document.tickers.join(" / ") : "Documento público"}</span>
      </nav>

      <header className={styles.viewerHeader}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>{document.document_type}</span>
          {document.reference_period && <span className={styles.badge}>{document.reference_period}</span>}
          <span className={styles.badge}>{processingLabel(document.processing_status)}</span>
        </div>
        <h1>{document.title}</h1>
        <p>
          {document.company_name ?? "Companhia não vinculada"} · {formatDate(document.published_at)} · {document.source.source_name}
        </p>
      </header>

      <section className={styles.viewerGrid}>
        <aside className={styles.sidebar}>
          <span className={styles.eyebrow}>DOCUMENTO</span>
          <h2>Informações</h2>
          <dl className={styles.metaList}>
            <div><dt>Empresa</dt><dd>{document.company_name ?? "—"}</dd></div>
            <div><dt>Ticker</dt><dd>{document.tickers.join(" / ") || "—"}</dd></div>
            <div><dt>Período</dt><dd>{document.reference_period ?? "—"}</dd></div>
            <div><dt>Publicado</dt><dd>{formatDate(document.published_at)}</dd></div>
            <div><dt>Páginas</dt><dd>{document.page_count ?? "—"}</dd></div>
            <div><dt>Formato</dt><dd>{document.content_type}</dd></div>
          </dl>
          {document.source_url && (
            <a className={styles.originalLink} href={document.source_url} target="_blank" rel="noreferrer">
              Abrir original na CVM ↗
            </a>
          )}

          {hasExtractedText ? (
            <>
              <span className={styles.eyebrowBlock}>SEÇÕES EXTRAÍDAS</span>
              <div className={styles.sectionNav}>
                {document.sections.map((section) => (
                  <a href={`#sec-${section.sequence}`} key={section.id}>
                    {section.heading ?? `Seção ${section.sequence}`} · {pagesLabel(section.page_start, section.page_end)}
                  </a>
                ))}
              </div>
            </>
          ) : null}
        </aside>

        <article className={styles.documentPane}>
          <div className={styles.documentPaneHeader}>
            <div>
              <span className={styles.eyebrow}>VISUALIZAÇÃO</span>
              <h2>Documento oficial</h2>
            </div>
            {document.source_url ? (
              <a href={document.source_url} target="_blank" rel="noreferrer">
                Abrir em nova aba ↗
              </a>
            ) : null}
          </div>

          {hasOriginal ? (
            <div className={styles.pdfFrameWrap}>
              <iframe
                className={styles.pdfFrame}
                src={document.source_url ?? undefined}
                title={`Documento oficial: ${document.title}`}
              />
              <p className={styles.viewerFallback}>
                Se o navegador bloquear a visualização incorporada, use “Abrir em nova aba” para acessar o documento oficial.
              </p>
            </div>
          ) : (
            <section className={styles.empty}>
              Este registro não possui link direto para o documento original.
            </section>
          )}

          {hasExtractedText ? (
            <div className={styles.extractedContent}>
              <span className={styles.eyebrow}>CONTEÚDO EXTRAÍDO</span>
              {document.sections.map((section) => (
                <section className={styles.documentSection} id={`sec-${section.sequence}`} key={section.id}>
                  <div className={styles.pageLabel}>{pagesLabel(section.page_start, section.page_end)}</div>
                  <h2>{section.heading ?? `Seção ${section.sequence}`}</h2>
                  <p>{section.text}</p>
                </section>
              ))}
            </div>
          ) : null}
        </article>

        <aside className={styles.analysisPane}>
          <span className={styles.eyebrow}>CONTEXTO</span>
          <h2>Proveniência</h2>
          <div className={styles.analysisCard}>
            <strong>Fonte oficial</strong>
            <p>{document.source.source_name}</p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Qualidade</strong>
            <p>{document.source.quality}</p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Licença</strong>
            <p>
              {document.source.license.license_id} · {document.source.license.redistribution}
            </p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Estado</strong>
            <p>{processingLabel(document.processing_status)}</p>
          </div>
          <div className={styles.analysisCard}>
            <strong>Análise estruturada</strong>
            <p>
              Resumo, métricas, riscos e citações entram na próxima camada, sem bloquear a leitura do documento oficial.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

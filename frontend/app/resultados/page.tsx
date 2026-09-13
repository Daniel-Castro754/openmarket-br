import Link from "next/link";

import { getDocuments, type DocumentSummary, type DocumentType } from "../../lib/api";

export const dynamic = "force-dynamic";

type ResultType = "all" | "dfp" | "itr";

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function periodLabel(value?: string | null) {
  if (!value) return "—";
  const normalized = value.slice(0, 10);
  const [year, month] = normalized.split("-").map(Number);
  if (!year || !month) return value;
  const quarter = Math.max(1, Math.min(4, Math.ceil(month / 3)));
  return month === 12 ? String(year) : `${quarter}T${String(year).slice(-2)}`;
}

function sortByPublication(documents: DocumentSummary[]) {
  return [...documents].sort((a, b) => {
    const aTime = a.published_at ? Date.parse(a.published_at) : 0;
    const bTime = b.published_at ? Date.parse(b.published_at) : 0;
    return bTime - aTime;
  });
}

async function loadResults(type: ResultType, q?: string) {
  if (type === "dfp" || type === "itr") {
    return getDocuments({ documentType: type as DocumentType, q, limit: 100 });
  }

  const [dfp, itr] = await Promise.all([
    getDocuments({ documentType: "dfp", q, limit: 100 }),
    getDocuments({ documentType: "itr", q, limit: 100 }),
  ]);
  return sortByPublication([...dfp, ...itr]).slice(0, 100);
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; q?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawType = firstValue(query.type);
  const type: ResultType = rawType === "dfp" || rawType === "itr" ? rawType : "all";
  const q = firstValue(query.q)?.trim() || undefined;
  const documents = await loadResults(type, q);

  return (
    <main className="discovery-page results-page">
      <header className="discovery-header">
        <div>
          <span className="eyebrow">RESULTADOS · DOCUMENTOS OFICIAIS</span>
          <h1>Últimos resultados</h1>
          <p>
            Central de DFP e ITR sincronizados. Cada linha mantém o vínculo com o documento original e com a página da
            companhia quando há ticker associado.
          </p>
        </div>
        <div className="discovery-header-stats" aria-label="Resumo dos resultados">
          <div><strong>{documents.length.toLocaleString("pt-BR")}</strong><span>documentos exibidos</span></div>
          <div><strong>DFP + ITR</strong><span>tipos incluídos</span></div>
          <div><strong>CVM</strong><span>origem documental</span></div>
        </div>
      </header>

      <form className="results-filter-bar" method="get">
        <label>
          <span>Buscar</span>
          <input name="q" defaultValue={q ?? ""} placeholder="Empresa, ticker ou documento" />
        </label>
        <label>
          <span>Tipo</span>
          <select name="type" defaultValue={type}>
            <option value="all">DFP + ITR</option>
            <option value="dfp">DFP</option>
            <option value="itr">ITR</option>
          </select>
        </label>
        <button type="submit">Aplicar filtros</button>
        {(q || type !== "all") ? <Link href="/resultados">Limpar</Link> : null}
      </form>

      <section className="discovery-table-panel">
        <div className="discovery-table-heading">
          <div>
            <span className="eyebrow">PUBLICAÇÕES SINCRONIZADAS</span>
            <h2>{type === "all" ? "DFP e ITR" : type.toUpperCase()}</h2>
          </div>
          <span className="source-pill">Fonte oficial</span>
        </div>

        <div className="discovery-table-wrap">
          <table className="discovery-table results-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Período</th>
                <th>Publicado em</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const ticker = document.tickers[0];
                return (
                  <tr key={document.id}>
                    <td>
                      <div className="document-company-cell">
                        <strong>{ticker ?? document.company_name ?? "—"}</strong>
                        <span>{document.company_name ?? document.title}</span>
                      </div>
                    </td>
                    <td><span className="document-type-badge">{document.document_type.toUpperCase()}</span></td>
                    <td>{periodLabel(document.reference_period)}</td>
                    <td>{formatDate(document.published_at)}</td>
                    <td>
                      <span className={`processing-status ${document.processing_status}`}>
                        {document.processing_status === "ready"
                          ? "Pronto"
                          : document.processing_status === "failed"
                            ? "Falhou"
                            : "Processando"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link href={`/relatorios/${document.id}`}>Documento</Link>
                        {ticker ? <Link href={`/ativos/${ticker}`}>Empresa</Link> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {documents.length === 0 ? (
            <div className="discovery-empty-state">
              Nenhum DFP ou ITR corresponde aos filtros na base documental atual.
            </div>
          ) : null}
        </div>
      </section>

      <footer className="discovery-footnote">
        <strong>Proveniência:</strong>
        <span>
          esta página não reconstrói datas nem títulos. Ela exibe os metadados sincronizados no Document Hub e mantém
          acesso ao documento correspondente.
        </span>
      </footer>
    </main>
  );
}

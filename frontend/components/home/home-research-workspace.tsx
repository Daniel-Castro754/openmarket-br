import Link from "next/link";

import { getDocuments, type DocumentSummary } from "../../lib/api";
import { getMacroSnapshot, type MacroIndicator } from "../../lib/macro-api";

const shortcuts = [
  { label: "Empresas", detail: "Demonstrações e indicadores", href: "/listas", meta: "CVM" },
  { label: "Screener", detail: "Filtre por fundamentos", href: "/screener", meta: "CVM · cálculo" },
  { label: "Comparar", detail: "Empresas lado a lado", href: "/comparar", meta: "CVM · cálculo" },
  { label: "Rankings", detail: "Ordenação por indicadores", href: "/rankings", meta: "CVM · cálculo" },
  { label: "Resultados", detail: "DFP e ITR recentes", href: "/resultados", meta: "CVM · IPE" },
  { label: "Relatórios", detail: "Documentos oficiais", href: "/relatorios", meta: "fontes oficiais" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function periodLabel(value?: string | null) {
  if (!value) return "—";
  const normalized = value.slice(0, 10);
  const [year, month] = normalized.split("-").map(Number);
  if (!year || !month) return value;
  if (month === 12) return String(year);
  const quarter = Math.max(1, Math.min(4, Math.ceil(month / 3)));
  return `${quarter}T${String(year).slice(-2)}`;
}

function sortDocuments(documents: DocumentSummary[]) {
  return [...documents].sort((a, b) => {
    const aTime = a.published_at ? Date.parse(a.published_at) : 0;
    const bTime = b.published_at ? Date.parse(b.published_at) : 0;
    return bTime - aTime;
  });
}

function valueLabel(indicator: MacroIndicator) {
  const numeric = Number(indicator.latest_value);
  if (!Number.isFinite(numeric)) return indicator.latest_value;
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: indicator.unit.includes("R$/") ? 2 : 1,
  }).format(numeric);
  if (indicator.unit.startsWith("%")) return `${formatted}%`;
  if (indicator.unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

function macroByKey(indicators: MacroIndicator[], key: string) {
  return indicators.find((indicator) => indicator.key === key) ?? null;
}

async function loadLatestResults() {
  try {
    const [dfp, itr] = await Promise.all([
      getDocuments({ documentType: "dfp", limit: 12 }),
      getDocuments({ documentType: "itr", limit: 12 }),
    ]);
    return sortDocuments([...dfp, ...itr]).slice(0, 5);
  } catch {
    return null;
  }
}

export async function HomeResearchWorkspace() {
  const [documents, macro] = await Promise.all([
    loadLatestResults(),
    getMacroSnapshot().catch(() => null),
  ]);

  const panorama = macro
    ? [
        macroByKey(macro.indicators, "selic_target"),
        macroByKey(macro.indicators, "ipca_12m"),
        macroByKey(macro.indicators, "usd_brl"),
        macroByKey(macro.indicators, "ibc_br"),
      ].filter((indicator): indicator is MacroIndicator => indicator != null)
    : [];

  return (
    <>
      <section className="home-v2-shortcuts" aria-label="Acessos principais">
        {shortcuts.map((item) => (
          <Link href={item.href} className="home-v2-shortcut" key={item.href}>
            <span className="home-v2-shortcut-meta">{item.meta}</span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
            <span className="home-v2-shortcut-action">Abrir →</span>
          </Link>
        ))}
      </section>

      <section className="home-v2-workspace" aria-label="Resultados recentes e panorama do Brasil">
        <article className="home-v2-results-panel">
          <header className="home-v2-workspace-heading">
            <div>
              <span className="eyebrow">PUBLICAÇÕES</span>
              <h2>Últimos resultados</h2>
            </div>
            <Link href="/resultados">Ver todos →</Link>
          </header>

          <div className="home-v2-results-list">
            {documents === null ? (
              <div className="home-v2-workspace-state">Não foi possível carregar os resultados agora.</div>
            ) : documents.length === 0 ? (
              <div className="home-v2-workspace-state">Nenhum DFP ou ITR recente disponível.</div>
            ) : (
              documents.map((document) => {
                const ticker = document.tickers[0];
                return (
                  <Link href={`/relatorios/${document.id}`} className="home-v2-result-row" key={document.id}>
                    <span className="home-v2-result-company">
                      <strong>{ticker ?? document.company_name ?? "—"}</strong>
                      <small>{document.company_name ?? document.title}</small>
                    </span>
                    <span className="home-v2-result-type">{document.document_type.toUpperCase()}</span>
                    <span className="home-v2-result-period">{periodLabel(document.reference_period)}</span>
                    <span className="home-v2-result-date">{formatDate(document.published_at)}</span>
                    <span className="home-v2-result-arrow" aria-hidden="true">→</span>
                  </Link>
                );
              })
            )}
          </div>
        </article>

        <aside className="home-v2-panorama-panel">
          <header className="home-v2-workspace-heading">
            <div>
              <span className="eyebrow">BRASIL</span>
              <h2>Panorama</h2>
            </div>
            <Link href="/macroeconomia">Macroeconomia →</Link>
          </header>

          <div className="home-v2-panorama-list">
            {macro === null ? (
              <div className="home-v2-workspace-state">Dados macro indisponíveis no momento.</div>
            ) : panorama.length === 0 ? (
              <div className="home-v2-workspace-state">Nenhum indicador macro disponível.</div>
            ) : (
              panorama.map((indicator) => (
                <div className="home-v2-panorama-row" key={indicator.key}>
                  <span>
                    <strong>{indicator.label}</strong>
                    <small>{formatDate(indicator.reference_date)}</small>
                  </span>
                  <b>{valueLabel(indicator)}</b>
                </div>
              ))
            )}
          </div>

          <footer className="home-v2-panorama-source">
            <span>Fonte</span>
            <strong>{panorama[0]?.source.source_name ?? "Banco Central do Brasil"}</strong>
          </footer>
        </aside>
      </section>
    </>
  );
}

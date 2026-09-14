import Link from "next/link";

const footerGroups = [
  {
    title: "Pesquisa",
    links: [
      { label: "Empresas", href: "/" },
      { label: "Screener", href: "/screener" },
      { label: "Comparar", href: "/comparar" },
      { label: "Rankings", href: "/rankings" },
      { label: "Listas", href: "/listas" },
    ],
  },
  {
    title: "Mercado e dados",
    links: [
      { label: "Resultados", href: "/resultados" },
      { label: "Relatórios", href: "/relatorios" },
      { label: "Macroeconomia", href: "/macroeconomia" },
      { label: "Economia real", href: "/analises" },
    ],
  },
  {
    title: "Ferramentas",
    links: [
      { label: "Calculadoras", href: "/calculadoras" },
      { label: "Screener fundamentalista", href: "/screener" },
      { label: "Comparador de empresas", href: "/comparar" },
      { label: "Document Hub", href: "/relatorios" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Rodapé do OpenMarket BR">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Link className="site-footer-logo" href="/" aria-label="OpenMarket BR — início">
              <span className="site-footer-logo-mark">OM</span>
              <span>OpenMarket BR</span>
            </Link>
            <p>
              Pesquisa financeira brasileira com dados oficiais, indicadores calculados e metodologia rastreável.
            </p>
            <div className="site-footer-source-row" aria-label="Principais fontes de dados">
              <span>CVM</span>
              <span>BCB</span>
              <span>IBGE</span>
            </div>
          </div>

          <nav className="site-footer-navigation" aria-label="Navegação do rodapé">
            {footerGroups.map((group) => (
              <div className="site-footer-group" key={group.title}>
                <h2>{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="site-footer-group">
              <h2>Projeto</h2>
              <ul>
                <li>
                  <a
                    href="https://github.com/Daniel-Castro754/openmarket-br"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Código no GitHub ↗
                  </a>
                </li>
                <li><Link href="/relatorios">Fontes e documentos</Link></li>
                <li><Link href="/macroeconomia">Dados oficiais</Link></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="site-footer-disclaimer">
          <strong>Informação, não recomendação.</strong>
          <p>
            O OpenMarket BR tem caráter informativo e educacional. Os dados apresentados não constituem recomendação
            de compra, venda ou manutenção de ativos. Valores derivados são identificados como calculados e mantêm
            referência à fonte e ao período utilizados.
          </p>
        </div>

        <div className="site-footer-bottom">
          <span>© {year} OpenMarket BR</span>
          <span>Projeto open source · dados com proveniência</span>
        </div>
      </div>
    </footer>
  );
}

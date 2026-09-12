import Link from "next/link";

import { ThemeSwitcher } from "./theme-switcher";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="OpenMarket BR">
          <span className="brand-mark">OM</span>
          <span className="brand-copy">
            <strong>OpenMarket</strong>
            <small>Brasil</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/listas">Listas</Link>
          <Link href="/#rankings">Rankings</Link>
          <Link href="/ativos/PETR4">Ativos</Link>
          <Link href="/comparar">Comparar</Link>
          <Link href="/analises">Análises</Link>
          <Link href="/macroeconomia">Macro</Link>
          <Link href="/calculadoras">Calculadoras</Link>
          <Link href="/relatorios">Relatórios</Link>
        </nav>

        <div className="site-header-actions">
          <span className="open-source-pill">Dados rastreáveis</span>
          <ThemeSwitcher />
          <Link className="header-cta" href="/relatorios">Document Hub</Link>
        </div>
      </div>
    </header>
  );
}

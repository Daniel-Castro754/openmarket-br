import Link from "next/link";

import { SiteNavigation } from "./site-navigation";
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

        <SiteNavigation />

        <div className="site-header-actions">
          <ThemeSwitcher />
          <Link className="header-cta" href="/relatorios">Document Hub</Link>
        </div>
      </div>
    </header>
  );
}

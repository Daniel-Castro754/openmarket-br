import Link from "next/link";

import { HeaderAssetSearch } from "./header-asset-search";
import { SiteNavigation } from "./site-navigation";
import { ThemeSwitcher } from "./theme-switcher";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="OpenMarket BR">
          <span className="brand-mark">OM</span>
          <span className="brand-copy">
            <strong>OpenMarket BR</strong>
            <small>dados públicos</small>
          </span>
        </Link>

        <SiteNavigation />

        <div className="site-header-actions">
          <HeaderAssetSearch />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "assets" | "lists" | "compare" | "macro" | "analysis" | "calculator" | "reports";

type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  activePrefixes?: string[];
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

type MegaItem = {
  label: string;
  detail: string;
  icon?: IconName;
  href?: string;
  activePrefixes?: string[];
  planned?: boolean;
};

type MegaColumn = {
  label: string;
  items: MegaItem[];
};

const links = {
  home: { href: "/", label: "Início", icon: "home", activePrefixes: ["/"] } satisfies NavLink,
  assets: { href: "/ativos/PETR4", label: "Ativos", icon: "assets", activePrefixes: ["/ativos"] } satisfies NavLink,
  lists: { href: "/listas", label: "Listas", icon: "lists", activePrefixes: ["/listas"] } satisfies NavLink,
  compare: { href: "/comparar", label: "Comparar", icon: "compare", activePrefixes: ["/comparar"] } satisfies NavLink,
  macro: { href: "/macroeconomia", label: "Macroeconomia", icon: "macro", activePrefixes: ["/macroeconomia"] } satisfies NavLink,
  analysis: { href: "/analises", label: "Análises", icon: "analysis", activePrefixes: ["/analises"] } satisfies NavLink,
  calculator: { href: "/calculadoras", label: "Calculadoras", icon: "calculator", activePrefixes: ["/calculadoras"] } satisfies NavLink,
  reports: { href: "/relatorios", label: "Relatórios", icon: "reports", activePrefixes: ["/relatorios"] } satisfies NavLink,
};

const sideGroups: NavGroup[] = [
  { label: "Navegar", links: [links.home, links.assets, links.lists, links.compare] },
  { label: "Mercado", links: [links.macro, links.analysis] },
  { label: "Ferramentas", links: [links.calculator, links.reports] },
];

const marketColumns: MegaColumn[] = [
  {
    label: "Empresas",
    items: [
      { label: "Visão de empresa", detail: "Fundamentos, histórico e documentos", href: links.assets.href, icon: "assets", activePrefixes: ["/ativos"] },
      { label: "Listas", detail: "Pesquisa e seleção de companhias", href: links.lists.href, icon: "lists", activePrefixes: ["/listas"] },
      { label: "Comparar", detail: "Coloque empresas lado a lado", href: links.compare.href, icon: "compare", activePrefixes: ["/comparar"] },
    ],
  },
  {
    label: "Descobrir",
    items: [
      { label: "Setores", detail: "Empresas organizadas por atividade", planned: true },
      { label: "Rankings", detail: "Crescimento, retorno, margens e dívida", planned: true },
      { label: "Últimos resultados", detail: "DFP e ITR publicados recentemente", planned: true },
    ],
  },
  {
    label: "Economia",
    items: [
      { label: "Macroeconomia", detail: "BCB, Focus e séries oficiais", href: links.macro.href, icon: "macro", activePrefixes: ["/macroeconomia"] },
      { label: "Análises", detail: "Consumo, atividade e contexto econômico", href: links.analysis.href, icon: "analysis", activePrefixes: ["/analises"] },
    ],
  },
  {
    label: "Fontes",
    items: [
      { label: "Documentos", detail: "Hub de relatórios e arquivos oficiais", href: links.reports.href, icon: "reports", activePrefixes: ["/relatorios"] },
      { label: "Agenda de resultados", detail: "Calendário de divulgações", planned: true },
    ],
  },
];

const toolColumns: MegaColumn[] = [
  {
    label: "Análise",
    items: [
      { label: "Listas", detail: "Base atual para filtros e descoberta", href: links.lists.href, icon: "lists", activePrefixes: ["/listas"] },
      { label: "Comparar empresas", detail: "Compare fundamentos em paralelo", href: links.compare.href, icon: "compare", activePrefixes: ["/comparar"] },
      { label: "Screener avançado", detail: "Filtros combinados por indicador", planned: true },
    ],
  },
  {
    label: "Utilidades",
    items: [
      { label: "Calculadoras", detail: "Simulações financeiras", href: links.calculator.href, icon: "calculator", activePrefixes: ["/calculadoras"] },
      { label: "Document Hub", detail: "Pesquisa em documentos públicos", href: links.reports.href, icon: "reports", activePrefixes: ["/relatorios"] },
    ],
  },
  {
    label: "Transparência",
    items: [
      { label: "Proveniência", detail: "Origem preservada em cada série e cálculo", href: links.assets.href, icon: "assets", activePrefixes: ["/ativos"] },
      { label: "Metodologia global", detail: "Catálogo de fórmulas e fontes", planned: true },
    ],
  },
];

function isActive(pathname: string, link: Pick<NavLink, "href" | "activePrefixes">) {
  if (!link.activePrefixes?.length) return false;
  if (link.href === "/") return pathname === "/";
  return link.activePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isMegaItemActive(pathname: string, item: MegaItem) {
  if (!item.href || !item.activePrefixes?.length) return false;
  return item.activePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return <svg {...common}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></svg>;
  }
  if (name === "assets") {
    return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  }
  if (name === "lists") {
    return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h10" /></svg>;
  }
  if (name === "compare") {
    return <svg {...common}><path d="M8 3v13" /><path d="m4 12 4 4 4-4" /><path d="M16 21V8" /><path d="m20 12-4-4-4 4" /></svg>;
  }
  if (name === "macro") {
    return <svg {...common}><path d="M3 21h18" /><path d="M5 21V10" /><path d="M9 21V10" /><path d="M15 21V10" /><path d="M19 21V10" /><path d="m3 10 9-6 9 6" /></svg>;
  }
  if (name === "analysis") {
    return <svg {...common}><path d="M5 21V10" /><path d="M12 21V4" /><path d="M19 21v-7" /><path d="M3 21h18" /></svg>;
  }
  if (name === "calculator") {
    return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8" /><path d="M8 11h.01" /><path d="M12 11h.01" /><path d="M16 11h.01" /><path d="M8 15h.01" /><path d="M12 15h.01" /><path d="M16 15v4" /></svg>;
  }
  return <svg {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M8 12h8" /><path d="M8 16h8" /></svg>;
}

function MegaMenu({ label, columns, pathname }: { label: string; columns: MegaColumn[]; pathname: string }) {
  const active = columns.some((column) => column.items.some((item) => isMegaItemActive(pathname, item)));

  return (
    <div className={`nav-group nav-mega-group ${active ? "nav-group-active" : ""}`}>
      <button type="button" className="nav-group-trigger" aria-haspopup="true">
        {label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      <div className="nav-dropdown nav-mega" role="menu">
        {columns.map((column) => (
          <section className="nav-mega-column" key={column.label}>
            <span className="nav-mega-eyebrow">{column.label}</span>
            <div className="nav-mega-items">
              {column.items.map((item) => item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className={isMegaItemActive(pathname, item) ? "nav-mega-item nav-dropdown-active" : "nav-mega-item"}
                >
                  {item.icon ? <span className="nav-mega-icon"><Icon name={item.icon} /></span> : null}
                  <span className="nav-mega-copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </Link>
              ) : (
                <div className="nav-mega-item nav-mega-planned" key={item.label} aria-disabled="true">
                  <span className="nav-mega-copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <span className="nav-planned-badge">Planejado</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SideLink({ link, pathname }: { link: NavLink; pathname: string }) {
  return (
    <Link
      href={link.href}
      title={link.label}
      className={`side-nav-item ${isActive(pathname, link) ? "active" : ""}`}
    >
      <Icon name={link.icon} />
      <span>{link.label}</span>
    </Link>
  );
}

function expandSidebar() {
  document.documentElement.dataset.navigation = "sidebar";
  window.localStorage.setItem("openmarket-nav-position", "sidebar");
  window.dispatchEvent(new Event("openmarket-appearance-change"));
}

export function SiteSideNavigation() {
  const pathname = usePathname();

  return (
    <aside className="site-side-navigation" aria-label="Navegação principal lateral">
      <Link className="side-brand" href="/" aria-label="OpenMarket BR">
        <span className="side-brand-mark">OM</span>
        <span className="side-brand-copy">
          <strong>OpenMarket</strong>
          <small>Brasil · dados públicos</small>
        </span>
      </Link>

      <button type="button" className="rail-expand-button" onClick={expandSidebar} aria-label="Expandir navegação" title="Expandir menu">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      <div className="side-nav-sections">
        {sideGroups.map((group) => (
          <section className="side-nav-section" key={group.label}>
            <span className="side-nav-eyebrow">{group.label}</span>
            <div className="side-nav-links">
              {group.links.map((link) => <SideLink link={link} pathname={pathname} key={link.href} />)}
            </div>
          </section>
        ))}
      </div>

      <div className="side-nav-footer">
        <span className="side-nav-open-source">Código aberto</span>
        <small>v0.1 · pré-painel</small>
      </div>
    </aside>
  );
}

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Navegação principal superior">
      <Link className={isActive(pathname, links.home) ? "nav-link-active" : undefined} href={links.home.href}>Início</Link>
      <Link className={isActive(pathname, links.assets) ? "nav-link-active" : undefined} href={links.assets.href}>Ativos</Link>
      <Link className={isActive(pathname, links.lists) ? "nav-link-active" : undefined} href={links.lists.href}>Listas</Link>
      <Link className={isActive(pathname, links.compare) ? "nav-link-active" : undefined} href={links.compare.href}>Comparar</Link>
      <MegaMenu label="Mercado" columns={marketColumns} pathname={pathname} />
      <MegaMenu label="Ferramentas" columns={toolColumns} pathname={pathname} />
      <Link className={isActive(pathname, links.reports) ? "nav-link-active" : undefined} href={links.reports.href}>Relatórios</Link>
    </nav>
  );
}

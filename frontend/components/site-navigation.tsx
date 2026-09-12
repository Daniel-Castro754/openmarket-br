"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
  activePrefixes?: string[];
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

const directLinks: NavLink[] = [
  { href: "/", label: "Início", activePrefixes: ["/"] },
  { href: "/ativos/PETR4", label: "Ativos", activePrefixes: ["/ativos"] },
  { href: "/listas", label: "Listas", activePrefixes: ["/listas"] },
  { href: "/analises", label: "Análises", activePrefixes: ["/analises"] },
  { href: "/relatorios", label: "Relatórios", activePrefixes: ["/relatorios"] },
];

const groups: NavGroup[] = [
  {
    label: "Mercado",
    links: [
      { href: "/#rankings", label: "Rankings" },
      { href: "/macroeconomia", label: "Macroeconomia", activePrefixes: ["/macroeconomia"] },
    ],
  },
  {
    label: "Ferramentas",
    links: [
      { href: "/comparar", label: "Comparador", activePrefixes: ["/comparar"] },
      { href: "/calculadoras", label: "Calculadoras", activePrefixes: ["/calculadoras"] },
    ],
  },
];

function isActive(pathname: string, link: NavLink) {
  if (!link.activePrefixes?.length) return false;
  if (link.href === "/") return pathname === "/";
  return link.activePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function Group({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = group.links.some((link) => isActive(pathname, link));

  return (
    <div className={`nav-group ${active ? "nav-group-active" : ""}`}>
      <button type="button" className="nav-group-trigger" aria-haspopup="true">
        {group.label}
        <span aria-hidden="true">⌄</span>
      </button>
      <div className="nav-dropdown" role="menu">
        {group.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            role="menuitem"
            className={isActive(pathname, link) ? "nav-dropdown-active" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Navegação principal">
      <Link className={isActive(pathname, directLinks[0]) ? "nav-link-active" : undefined} href="/">
        Início
      </Link>
      <Group group={groups[0]} pathname={pathname} />
      {directLinks.slice(1, 4).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(pathname, link) ? "nav-link-active" : undefined}
        >
          {link.label}
        </Link>
      ))}
      <Group group={groups[1]} pathname={pathname} />
      <Link
        className={isActive(pathname, directLinks[4]) ? "nav-link-active" : undefined}
        href={directLinks[4].href}
      >
        {directLinks[4].label}
      </Link>
    </nav>
  );
}

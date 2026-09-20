"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AssetTabs({ ticker }: { ticker: string }) {
  const pathname = usePathname();
  const base = `/ativos/${ticker}`;
  const tabs = [
    { label: "Visão geral", href: base, exact: true },
    { label: "Indicadores", href: `${base}/indicadores` },
    { label: "Financeiro", href: `${base}/financeiro` },
    { label: "Desempenho & risco", href: `${base}/desempenho` },
    { label: "Eventos", href: `${base}/eventos` },
    { label: "Relatórios", href: `${base}/relatorios` },
  ];

  return (
    <nav className="asset-tabs asset-tabs-v2" aria-label="Seções da ação">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link className={active ? "active" : ""} href={tab.href} key={tab.href}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

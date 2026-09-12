import Link from "next/link";

import { AssetSearch } from "./asset-search";

const pillars = [
  ["Dados rastreáveis", "Cada número deve carregar fonte, data de referência e política de uso."],
  ["Providers substituíveis", "B3, CVM e outras fontes entram por contratos; o domínio não depende delas."],
  ["Document Hub", "Abra relatórios públicos, navegue por seções e acompanhe a proveniência antes da análise com IA."],
];

export default function Home() {
  return (
    <main>
      <header className="hero">
        <span className="eyebrow">OPEN SOURCE • BRASIL</span>
        <h1>OpenMarket BR</h1>
        <p>Uma base aberta para pesquisar, visualizar e analisar o mercado financeiro brasileiro.</p>
        <AssetSearch />
      </header>
      <section className="grid">
        {pillars.map(([title, text]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
            {title === "Document Hub" && <Link href="/relatorios">Abrir biblioteca →</Link>}
          </article>
        ))}
      </section>
      <section className="status">
        <strong>Fase atual</strong>
        <span>CVM + B3 + PostgreSQL + ativos + séries financeiras + Document Hub.</span>
      </section>
    </main>
  );
}

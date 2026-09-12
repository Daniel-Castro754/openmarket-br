const pillars = [
  ["Dados rastreáveis", "Cada número deve carregar fonte, data de referência e política de uso."],
  ["Providers substituíveis", "B3, CVM e outras fontes entram por contratos; o domínio não depende delas."],
  ["Comunidade primeiro", "API, visualizador, screeners e ferramentas são construídos por Pull Requests."],
];

export default function Home() {
  return (
    <main>
      <header className="hero">
        <span className="eyebrow">OPEN SOURCE • BRASIL</span>
        <h1>OpenMarket BR</h1>
        <p>Uma base aberta para pesquisar, visualizar e analisar o mercado financeiro brasileiro.</p>
      </header>
      <section className="grid">
        {pillars.map(([title, text]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className="status">
        <strong>Fase 0</strong>
        <span>Fundação da arquitetura e contratos de dados.</span>
      </section>
    </main>
  );
}

import { notFound } from "next/navigation";

import styles from "./design-system-page.module.css";

const colorTokens = [
  ["Background", "bg"],
  ["Surface", "surface"],
  ["Surface soft", "surfaceSoft"],
  ["Border", "border"],
  ["Text", "text"],
  ["Muted", "muted"],
  ["Accent", "accent"],
  ["Info", "info"],
  ["Warning", "warning"],
  ["Positive", "positive"],
  ["Negative", "negative"],
] as const;

export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className="eyebrow">DEV · DESIGN SYSTEM</span>
        <h1>OpenMarket BR — sistema visual vivo</h1>
        <p>
          Referência de desenvolvimento para tokens, densidade, proveniência, estados de dados,
          controles e superfícies analíticas. Esta rota retorna 404 fora do ambiente de desenvolvimento.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="ds-colors">
        <header className={styles.sectionHeader}>
          <div>
            <span className="eyebrow">FUNDAÇÃO</span>
            <h2 id="ds-colors">Cores semânticas</h2>
          </div>
          <small>Fonte: design-system.css</small>
        </header>
        <div className={styles.swatchGrid}>
          {colorTokens.map(([label, token]) => (
            <article className={styles.swatchCard} key={token}>
              <div className={`${styles.swatch} ${styles[token]}`} aria-hidden="true" />
              <strong>{label}</strong>
              <code>--{token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}</code>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-type">
        <header className={styles.sectionHeader}>
          <div>
            <span className="eyebrow">TIPOGRAFIA</span>
            <h2 id="ds-type">Hierarquia e números</h2>
          </div>
          <small>Compacta, analítica e tabular quando numérica</small>
        </header>
        <div className={styles.typeGrid}>
          <div><span>Hero</span><strong className={styles.heroType}>Pesquise empresas. Entenda os números.</strong></div>
          <div><span>Título</span><strong className={styles.titleType}>Indicadores fundamentalistas</strong></div>
          <div><span>Corpo</span><p>Demonstrações, períodos e fontes permanecem próximos aos valores.</p></div>
          <div><span>Número</span><strong className={styles.numeric}>R$ 123,4 bi · 22,35% · 1,08x</strong></div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-semantics">
        <header className={styles.sectionHeader}>
          <div>
            <span className="eyebrow">SEMÂNTICA</span>
            <h2 id="ds-semantics">Proveniência e estado do dado</h2>
          </div>
          <small>Origem não deve parecer recomendação</small>
        </header>
        <div className={styles.semanticRows}>
          <div>
            <span className={`${styles.badge} ${styles.official}`}>Oficial</span>
            <span className={`${styles.badge} ${styles.calculated}`}>Calculado</span>
            <span className={`${styles.badge} ${styles.market}`}>Mercado</span>
          </div>
          <div className={styles.dataStates}>
            <span><b>0</b><small>valor real</small></span>
            <span><b>—</b><small>ausência contextual</small></span>
            <span><b>N/D</b><small>não disponível</small></span>
            <span><b>N/A</b><small>não aplicável</small></span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-controls">
        <header className={styles.sectionHeader}>
          <div>
            <span className="eyebrow">INTERAÇÃO</span>
            <h2 id="ds-controls">Controles e densidade</h2>
          </div>
          <small>Default e compact</small>
        </header>
        <div className={styles.controls}>
          <input className="ui-control" defaultValue="PETR4" aria-label="Exemplo de input padrão" />
          <select className="ui-control ui-control--compact" defaultValue="annual" aria-label="Exemplo de select compacto">
            <option value="annual">Anual</option>
            <option value="quarterly">Trimestral</option>
          </select>
          <button className="ui-button ui-button--primary" type="button">Ação primária</button>
          <button className="ui-button ui-button--secondary ui-button--compact" type="button">Ação compacta</button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-table">
        <header className={styles.sectionHeader}>
          <div>
            <span className="eyebrow">DADOS</span>
            <h2 id="ds-table">Tabela analítica</h2>
          </div>
          <small>Alinhamento numérico e proveniência visível</small>
        </header>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Empresa</th><th>Margem líquida</th><th>ROE</th><th>Fonte</th></tr></thead>
            <tbody>
              <tr><td>PETR4</td><td>22,35%</td><td>18,42%</td><td><span className={`${styles.badge} ${styles.calculated}`}>Calculado</span></td></tr>
              <tr><td>VALE3</td><td>—</td><td>16,08%</td><td><span className={`${styles.badge} ${styles.official}`}>Oficial</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-chart">
        <header className={styles.sectionHeader}>
          <div>
            <span className="eyebrow">GRÁFICOS</span>
            <h2 id="ds-chart">Contrato visual</h2>
          </div>
          <small>Tokens --chart-*</small>
        </header>
        <div className={styles.chartDemo} aria-label="Demonstração de cores de gráfico">
          <span className={styles.chartGrid} />
          <span className={styles.chartPrimary} />
          <span className={styles.chartSecondary} />
          <span className={styles.chartNegative} />
        </div>
      </section>

      <footer className={styles.footer}>
        <strong>Regra de manutenção</strong>
        <p>Atualize esta página quando um token ou primitive compartilhado mudar; não use esta rota para inventar padrões paralelos.</p>
      </footer>
    </main>
  );
}

import { getScreener } from "../../lib/api";
import { ScreenerWorkspace } from "./screener-workspace";
import styles from "./screener.module.css";

export const dynamic = "force-dynamic";

export default async function ScreenerPage() {
  const screener = await getScreener({ limit: 100 });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">SCREENER FUNDAMENTALISTA · CVM</span>
          <h1>Filtre empresas por fundamentos reais.</h1>
          <p>
            Combine condições sobre crescimento, margens, rentabilidade, resultados e balanço usando apenas os
            valores já sincronizados no OpenMarket BR. Sem preços, estimativas ou preenchimento artificial.
          </p>
        </div>
        <div className={styles.headerStats} aria-label="Resumo do universo carregado">
          <div><strong>{screener.total.toLocaleString("pt-BR")}</strong><span>ativos sincronizados</span></div>
          <div><strong>{screener.rows.length.toLocaleString("pt-BR")}</strong><span>carregados nesta visão</span></div>
          <div><strong>CVM</strong><span>fonte financeira</span></div>
        </div>
      </header>

      <ScreenerWorkspace rows={screener.rows} total={screener.total} />
    </main>
  );
}

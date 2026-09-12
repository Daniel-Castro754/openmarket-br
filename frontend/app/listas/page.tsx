import { AssetListTable } from "./asset-list-table";
import { getScreener } from "../../lib/api";
import styles from "./listas.module.css";

export const dynamic = "force-dynamic";

export default async function AssetListsPage() {
  const screener = await getScreener({ limit: 80 });

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <span className="eyebrow">SCREENER • LISTAS DE ATIVOS</span>
          <div className={styles.titleRow}>
            <h1>Listas de ativos</h1>
            <span className={styles.universeBadge}>{screener.total.toLocaleString("pt-BR")} sincronizados</span>
          </div>
          <p>Troque a visão, ordene indicadores ou monte sua própria combinação de colunas.</p>
        </div>

        <div className={styles.headerStats} aria-label="Resumo do screener">
          <div>
            <strong>6</strong>
            <span>visões prontas</span>
          </div>
          <div>
            <strong>28</strong>
            <span>campos</span>
          </div>
          <div>
            <strong>CVM</strong>
            <span>fonte financeira</span>
          </div>
        </div>
      </header>

      <AssetListTable rows={screener.rows} total={screener.total} />
    </main>
  );
}

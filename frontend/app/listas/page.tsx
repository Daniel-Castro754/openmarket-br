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
          <span className="eyebrow">ATIVOS · CVM</span>
          <div className={styles.titleRow}>
            <h1>Listas de ativos</h1>
            <span className={styles.universeBadge}>{screener.total.toLocaleString("pt-BR")} sincronizados</span>
          </div>
          <p>Alterne entre visões prontas, ordene a tabela ou personalize as colunas.</p>
        </div>

        <div className={styles.sourceMeta} aria-label="Origem dos dados">
          <strong>CVM</strong>
          <span>Demonstrações anuais consolidadas</span>
        </div>
      </header>

      <AssetListTable rows={screener.rows} total={screener.total} />
    </main>
  );
}

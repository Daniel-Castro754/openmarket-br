import { AssetListTable } from "./asset-list-table";
import { getScreener } from "../../lib/api";
import styles from "./listas.module.css";

export default async function AssetListsPage() {
  const screener = await getScreener({ limit: 80 });

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow">LISTAS DE ATIVOS</span>
          <h1>Encontre o que importa, sem tabela gigante.</h1>
          <p>
            Alterne entre listas prontas ou monte uma visão personalizada com os campos que você usa.
            A proposta é manter alta densidade de informação sem transformar cada linha em um cartão.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div>
            <strong>{screener.total.toLocaleString("pt-BR")}</strong>
            <span>ativos sincronizados</span>
          </div>
          <div>
            <strong>6</strong>
            <span>listas prontas</span>
          </div>
          <div>
            <strong>28</strong>
            <span>campos selecionáveis</span>
          </div>
        </div>
      </section>

      <AssetListTable rows={screener.rows} total={screener.total} />
    </main>
  );
}

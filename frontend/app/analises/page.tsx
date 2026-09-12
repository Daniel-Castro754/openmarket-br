import { ConsumerAnalysis } from "./consumer-analysis";
import { getConsumerInsights } from "../../lib/insights-api";
import styles from "./analises.module.css";

export const dynamic = "force-dynamic";

export default async function AnalysesPage() {
  let snapshot = null;

  try {
    snapshot = await getConsumerInsights();
  } catch (error) {
    console.error("Unable to load consumer insights", error);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow">ANÁLISES ECONÔMICAS</span>
          <h1>Consumo, atividade e sinais da economia real.</h1>
          <p>
            Transformamos bases oficiais em leituras visuais: estrutura do orçamento das famílias,
            varejo, serviços, indústria e inflação. Cada bloco preserva fonte e período.
          </p>
        </div>
        <div className={styles.heroAside}>
          <strong>IBGE conectado</strong>
          <span>POF + SIDRA</span>
          <small>Dados estruturais e séries conjunturais no mesmo painel.</small>
        </div>
      </section>

      {snapshot ? (
        <ConsumerAnalysis snapshot={snapshot} />
      ) : (
        <section className={styles.unavailable} role="status">
          <div>
            <span className="eyebrow">DADOS TEMPORARIAMENTE INDISPONÍVEIS</span>
            <h2>A página continua acessível.</h2>
            <p>
              A OpenMarket API não respondeu nesta tentativa. Inicie ou reinicie o backend e recarregue a página
              para buscar novamente os dados oficiais do IBGE.
            </p>
          </div>
          <a className={styles.retryLink} href="/analises">Tentar novamente</a>
        </section>
      )}
    </main>
  );
}

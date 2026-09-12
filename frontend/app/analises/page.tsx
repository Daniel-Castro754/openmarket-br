import { ConsumerAnalysis } from "./consumer-analysis";
import { getConsumerInsights } from "../../lib/insights-api";
import styles from "./analises.module.css";

export const dynamic = "force-dynamic";

export default async function AnalysesPage() {
  const snapshot = await getConsumerInsights();

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

      <ConsumerAnalysis snapshot={snapshot} />
    </main>
  );
}

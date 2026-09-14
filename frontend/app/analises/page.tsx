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
      <header className={styles.hero}>
        <div>
          <span className="eyebrow">ECONOMIA REAL · IBGE</span>
          <h1>Análises econômicas</h1>
          <p>
            Consumo das famílias e séries de atividade organizados com período, fonte e metodologia explícitos.
          </p>
        </div>
        <div className={styles.heroMeta} aria-label="Cobertura das análises econômicas">
          <span><strong>IBGE</strong> fonte oficial</span>
          <span><strong>POF + SIDRA</strong> bases</span>
          <span><strong>Oficial</strong> proveniência</span>
        </div>
      </header>

      {snapshot ? (
        <ConsumerAnalysis snapshot={snapshot} />
      ) : (
        <section className={styles.unavailable} role="status">
          <div>
            <span className="eyebrow">DADOS INDISPONÍVEIS</span>
            <h2>Não foi possível carregar as séries do IBGE.</h2>
            <p>
              A página não usa valores substitutos. Reinicie a API, se necessário, e tente carregar os dados oficiais novamente.
            </p>
          </div>
          <a className={styles.retryLink} href="/analises">Tentar novamente</a>
        </section>
      )}
    </main>
  );
}

import { CalculatorsHub } from "./calculators-hub";
import styles from "./calculadoras.module.css";

export default function CalculatorsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className="eyebrow">CALCULADORAS</span>
          <h1>Calculadoras financeiras</h1>
          <p>Ferramentas independentes da base factual, com fórmulas visíveis e cálculo local no navegador.</p>
        </div>
        <div className={styles.heroMeta}>
          <span>6 ferramentas</span>
          <span>cálculo local</span>
          <strong>metodologia explícita</strong>
        </div>
      </header>
      <CalculatorsHub />
    </main>
  );
}

import { CalculatorsHub } from "./calculators-hub";
import styles from "./calculadoras.module.css";

export default function CalculatorsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow">CALCULADORAS</span>
          <h1>Simule antes de decidir.</h1>
          <p>
            Ferramentas rápidas para juros, metas, renda e poder de compra. As fórmulas ficam visíveis e
            não dependem de cadastro nem de dados pessoais.
          </p>
        </div>
        <div className={styles.heroCards}>
          <div><strong>6</strong><span>calculadoras iniciais</span></div>
          <div><strong>100%</strong><span>cálculo no navegador</span></div>
          <div><strong>0</strong><span>dados pessoais enviados</span></div>
        </div>
      </section>
      <CalculatorsHub />
    </main>
  );
}

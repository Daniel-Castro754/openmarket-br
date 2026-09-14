type ChecklistStatus = "positive" | "attention" | "unavailable";

export type FundamentalsChecklistItem = {
  label: string;
  value: string;
  detail: string;
  status: ChecklistStatus;
};

function statusLabel(status: ChecklistStatus) {
  if (status === "positive") return "Atende";
  if (status === "attention") return "Atenção";
  return "Sem dado";
}

function statusSymbol(status: ChecklistStatus) {
  if (status === "positive") return "✓";
  if (status === "attention") return "!";
  return "—";
}

export function FundamentalsChecklist({ items }: { items: FundamentalsChecklistItem[] }) {
  const positive = items.filter((item) => item.status === "positive").length;
  const attention = items.filter((item) => item.status === "attention").length;
  const unavailable = items.filter((item) => item.status === "unavailable").length;

  return (
    <section className="fundamentals-checklist" aria-labelledby="fundamentals-checklist-title">
      <div className="section-title-row fundamentals-checklist-heading">
        <div>
          <span className="eyebrow">CHECKLIST DE FUNDAMENTOS</span>
          <h2 id="fundamentals-checklist-title">Sinais objetivos do último período</h2>
        </div>
        <div className="fundamentals-checklist-summary" aria-label="Resumo do checklist">
          <span className="positive">{positive} atendem</span>
          {attention > 0 ? <span className="attention">{attention} atenção</span> : null}
          {unavailable > 0 ? <span>{unavailable} sem dado</span> : null}
        </div>
      </div>

      <div className="fundamentals-checklist-list">
        {items.map((item) => (
          <article className={`fundamentals-checklist-row ${item.status}`} key={item.label}>
            <span className="fundamentals-checklist-status" aria-hidden="true">
              {statusSymbol(item.status)}
            </span>
            <div className="fundamentals-checklist-copy">
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              <div className="fundamentals-checklist-value">
                <b>{item.value}</b>
                <small>{statusLabel(item.status)}</small>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="fundamentals-checklist-note">
        Contagem descritiva dos critérios matemáticos disponíveis; não é nota, recomendação de investimento ou
        classificação de qualidade da empresa.
      </p>
    </section>
  );
}

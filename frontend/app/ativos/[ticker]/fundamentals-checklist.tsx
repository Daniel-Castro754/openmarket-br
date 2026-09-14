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
  return (
    <section className="fundamentals-checklist" aria-labelledby="fundamentals-checklist-title">
      <div className="section-title-row fundamentals-checklist-heading">
        <div>
          <span className="eyebrow">CHECKLIST DE FUNDAMENTOS</span>
          <h2 id="fundamentals-checklist-title">Leitura objetiva dos dados disponíveis</h2>
        </div>
        <span className="data-source-pill">Sem pontuação</span>
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
        Critérios matemáticos aplicados somente aos dados disponíveis. O checklist não é recomendação de compra,
        venda ou manutenção e não gera nota para o ativo.
      </p>
    </section>
  );
}

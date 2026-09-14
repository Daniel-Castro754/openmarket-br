type SummaryMetric = {
  label: string;
  value: string;
  context: string;
  provenance?: string;
};

export function AssetSummaryStrip({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <section className="asset-summary-v2" aria-label="Indicadores em destaque">
      {metrics.map((metric) => (
        <article key={metric.label}>
          <div className="asset-summary-heading">
            <span>{metric.label}</span>
            {metric.provenance ? <small>{metric.provenance}</small> : null}
          </div>
          <strong>{metric.value}</strong>
          <p>{metric.context}</p>
        </article>
      ))}
    </section>
  );
}

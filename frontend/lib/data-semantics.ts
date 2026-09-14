import type { SourceMetadata } from "./api";
import { formatDatePtBr } from "./format";

export type ProvenanceKind = "official" | "calculated" | "market" | "source";

export const PROVENANCE_LABELS: Record<ProvenanceKind, string> = {
  official: "Oficial",
  calculated: "Calculado",
  market: "Mercado",
  source: "Fonte",
};

export function provenanceKind({
  derived,
  source,
}: {
  derived?: boolean;
  source?: SourceMetadata | null;
}): ProvenanceKind {
  if (derived) return "calculated";
  if (source?.quality === "official") return "official";
  if (source?.quality === "licensed") return "market";
  return "source";
}

export function provenanceLabel(kind: ProvenanceKind) {
  return PROVENANCE_LABELS[kind];
}

export function sourceFreshnessLabel(source?: SourceMetadata | null) {
  if (!source) return null;
  if (source.reference_date) return `Referência ${formatDatePtBr(source.reference_date)}`;
  if (source.retrieved_at) return `Sincronizado ${formatDatePtBr(source.retrieved_at)}`;
  return null;
}

import type { DocumentSummary } from "./api";

export type DocumentCategory =
  | "results"
  | "material"
  | "governance"
  | "finance"
  | "operations"
  | "calendar"
  | "regulatory"
  | "other";

export const documentCategoryOptions: Array<{ value: DocumentCategory; label: string }> = [
  { value: "results", label: "Resultados" },
  { value: "material", label: "Comunicados" },
  { value: "governance", label: "Governança" },
  { value: "finance", label: "Financeiro / Dívida" },
  { value: "operations", label: "Operacional" },
  { value: "calendar", label: "Calendário" },
  { value: "regulatory", label: "Regulatório" },
  { value: "other", label: "Outros" },
];

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function documentCategory(document: DocumentSummary): DocumentCategory {
  if (document.document_type === "material_fact") return "material";
  if (document.document_type === "fre") return "governance";
  if (
    document.document_type === "dfp"
    || document.document_type === "itr"
    || document.document_type === "earnings_release"
    || document.document_type === "annual_report"
    || document.document_type === "presentation"
  ) {
    return "results";
  }

  const text = normalized(document.title);

  if (containsAny(text, ["calendario", "agenda de eventos"])) return "calendar";

  if (
    containsAny(text, [
      "divida",
      "debenture",
      "captacao",
      "emissao",
      "titulos",
      "titulo global",
      "bond",
      "resgate",
      "financiamento",
      "pagamento de parcelas",
      "credito",
    ])
  ) {
    return "finance";
  }

  if (
    containsAny(text, [
      "assembleia",
      "conselho",
      "governanca",
      "transacao com parte relacionada",
      "posicao consolidada",
      "posicao individual",
      "acionista",
      "administrador",
      "estatuto",
      "capital social",
    ])
  ) {
    return "governance";
  }

  if (
    containsAny(text, [
      "producao",
      "exploracao",
      "blocos exploratorios",
      "hidrocarboneto",
      "hidrocarbonetos",
      "reserva",
      "plataforma",
      "campo",
      "operacao",
      "operacional",
      "petroleo",
      "gas natural",
    ])
  ) {
    return "operations";
  }

  if (
    containsAny(text, [
      "resultado",
      "desempenho financeiro",
      "demonstracao financeira",
      "informacoes financeiras",
      "relatorio anual",
      "relato integrado",
    ])
  ) {
    return "results";
  }

  if (
    containsAny(text, [
      "regulatorio",
      "regulacao",
      "fiscal",
      "tribut",
      "anp",
      "ibama",
      "cade",
      "cvm",
      "sec",
    ])
  ) {
    return "regulatory";
  }

  if (
    containsAny(text, [
      "comunicado",
      "informa",
      "esclarecimento",
      "aviso",
      "fato relevante",
    ])
  ) {
    return "material";
  }

  return "other";
}

export function documentCategoryLabel(value: DocumentCategory) {
  return documentCategoryOptions.find((item) => item.value === value)?.label ?? "Outros";
}

export function categoryCounts(documents: DocumentSummary[]) {
  const counts = new Map<DocumentCategory, number>();
  for (const item of documentCategoryOptions) counts.set(item.value, 0);
  for (const document of documents) {
    const category = documentCategory(document);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

"use client";

import { useMemo, useState } from "react";

import type { DocumentSection } from "../../lib/api";
import styles from "./report-viewer.module.css";

const MAX_RESULTS = 8;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function excerpt(section: DocumentSection, query: string) {
  const haystack = section.text.replace(/\s+/g, " ").trim();
  if (!haystack) return "Sem texto extraído nesta seção.";

  const normalizedHaystack = normalize(haystack);
  const normalizedQuery = normalize(query);
  const index = normalizedHaystack.indexOf(normalizedQuery);
  if (index < 0) return haystack.slice(0, 150);

  const start = Math.max(0, index - 55);
  const end = Math.min(haystack.length, index + query.length + 95);
  return `${start > 0 ? "…" : ""}${haystack.slice(start, end)}${end < haystack.length ? "…" : ""}`;
}

function sectionHref(section: DocumentSection) {
  const anchor = `#sec-${section.sequence}`;
  if (section.page_start == null) return anchor;
  return `?page=${section.page_start}${anchor}`;
}

export function DocumentTextSearch({ sections }: { sections: DocumentSection[] }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const matches = useMemo(() => {
    if (trimmed.length < 2) return [];
    const needle = normalize(trimmed);
    return sections.filter((section) => {
      const searchable = `${section.heading ?? ""}\n${section.text}`;
      return normalize(searchable).includes(needle);
    });
  }, [sections, trimmed]);

  return (
    <div className={styles.documentSearch}>
      <label htmlFor="document-text-search">Buscar no texto</label>
      <input
        id="document-text-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Termo, métrica, risco..."
        autoComplete="off"
      />
      <div className={styles.searchMeta} aria-live="polite">
        {trimmed.length < 2
          ? "Digite ao menos 2 caracteres."
          : `${matches.length} ${matches.length === 1 ? "seção encontrada" : "seções encontradas"}.`}
      </div>

      {trimmed.length >= 2 && matches.length > 0 ? (
        <div className={styles.searchResults}>
          {matches.slice(0, MAX_RESULTS).map((section) => (
            <a href={sectionHref(section)} className={styles.searchResult} key={section.id}>
              <strong>{section.heading ?? `Seção ${section.sequence}`}</strong>
              <span>
                {section.page_start != null ? `Pág. ${section.page_start} · ` : ""}
                {excerpt(section, trimmed)}
              </span>
            </a>
          ))}
          {matches.length > MAX_RESULTS ? (
            <span className={styles.searchMore}>+ {matches.length - MAX_RESULTS} resultados adicionais</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

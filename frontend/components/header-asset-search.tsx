"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function HeaderAssetSearch() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) return;
    router.push(`/ativos/${normalized}`);
  }

  return (
    <form className="header-asset-search" onSubmit={submit} role="search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="m20 20-4.35-4.35" />
      </svg>
      <input
        value={ticker}
        onChange={(event) => setTicker(event.target.value)}
        placeholder="Buscar ticker"
        aria-label="Buscar ticker"
        autoComplete="off"
        maxLength={16}
      />
      <button type="submit" className="sr-only">Abrir ativo</button>
    </form>
  );
}

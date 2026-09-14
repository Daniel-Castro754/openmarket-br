"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AssetSearch() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized) {
      router.push(`/ativos/${normalized}`);
    }
  }

  return (
    <form className="asset-search home-v2-search" onSubmit={submit} role="search">
      <label htmlFor="home-asset-search">Buscar empresa ou ticker</label>
      <div className="asset-search-row home-v2-search-row">
        <span className="home-v2-search-icon" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="6" />
            <path d="m20 20-4.35-4.35" />
          </svg>
        </span>
        <input
          id="home-asset-search"
          value={ticker}
          onChange={(event) => setTicker(event.target.value)}
          placeholder="Ex.: PETR4, VALE3, ITUB4"
          aria-label="Buscar empresa ou ticker"
          autoComplete="off"
          maxLength={16}
        />
        <button type="submit">Pesquisar</button>
      </div>
      <small>Digite o ticker de uma empresa já sincronizada no OpenMarket BR.</small>
    </form>
  );
}

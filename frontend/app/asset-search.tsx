"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AssetSearch() {
  const router = useRouter();
  const [ticker, setTicker] = useState("PETR4");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized) {
      router.push(`/ativos/${normalized}`);
    }
  }

  return (
    <form className="asset-search" onSubmit={submit}>
      <label htmlFor="ticker">Pesquisar ativo</label>
      <div className="asset-search-row">
        <input
          id="ticker"
          value={ticker}
          onChange={(event) => setTicker(event.target.value)}
          placeholder="PETR4"
          autoComplete="off"
          maxLength={16}
        />
        <button type="submit">Abrir ativo</button>
      </div>
      <small>O visualizador usa os dados já sincronizados no OpenMarket.</small>
    </form>
  );
}

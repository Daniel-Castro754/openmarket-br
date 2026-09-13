"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function HeaderAssetSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ticker, setTicker] = useState("");

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "/") return;
      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) return;
    setTicker("");
    router.push(`/ativos/${normalized}`);
  }

  return (
    <form className="header-asset-search" onSubmit={submit} role="search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="m20 20-4.35-4.35" />
      </svg>
      <input
        ref={inputRef}
        value={ticker}
        onChange={(event) => setTicker(event.target.value)}
        placeholder="Ir para ticker"
        aria-label="Ir para ticker"
        autoComplete="off"
        maxLength={16}
      />
      <kbd className="header-search-shortcut" aria-hidden="true">/</kbd>
      <button type="submit" className="sr-only">Abrir ativo</button>
    </form>
  );
}

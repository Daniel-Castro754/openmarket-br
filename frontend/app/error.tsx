"use client";

import Link from "next/link";
import { useEffect } from "react";

import styles from "./error-state.module.css";

function looksLikeApiUnavailable(error: Error & { digest?: string }) {
  const message = error.message.toLowerCase();
  return message.includes("fetch failed")
    || message.includes("econnrefused")
    || message.includes("openmarket api returned");
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const apiUnavailable = looksLikeApiUnavailable(error);

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <span className={styles.kicker}>
          {apiUnavailable ? "SERVIÇO DE DADOS" : "ERRO DE APLICAÇÃO"}
        </span>
        <h1>
          {apiUnavailable
            ? "A API do OpenMarket não está disponível."
            : "Não foi possível carregar esta página."}
        </h1>
        <p>
          {apiUnavailable
            ? "A interface continua funcionando, mas esta tela depende da API local para consultar os dados persistidos."
            : "Tente carregar novamente. Se o problema continuar, verifique o terminal de desenvolvimento."}
        </p>

        {apiUnavailable && process.env.NODE_ENV === "development" ? (
          <div className={styles.devHint}>
            <strong>Ambiente local</strong>
            <span>Suba PostgreSQL e API antes de abrir as telas de dados:</span>
            <code>docker compose up --build -d</code>
            <code>docker compose run --rm api alembic upgrade head</code>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button type="button" onClick={() => reset()}>
            Tentar novamente
          </button>
          <Link href="/">Voltar ao início</Link>
        </div>
      </section>
    </main>
  );
}

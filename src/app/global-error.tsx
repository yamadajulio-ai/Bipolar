"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="mx-auto max-w-md px-6 text-center">
          <h1 className="mb-4 text-2xl font-bold">Algo deu errado</h1>
          <p className="mb-6 text-muted">
            Ocorreu um erro inesperado. Nosso time foi notificado.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-6 py-3 font-medium text-on-primary hover:bg-primary-dark"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}

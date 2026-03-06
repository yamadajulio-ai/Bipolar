"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
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
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="mx-auto max-w-md px-6 text-center">
        <h2 className="mb-4 text-xl font-bold">Algo deu errado</h2>
        <p className="mb-6 text-muted">
          Ocorreu um erro inesperado. Nosso time foi notificado.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-green-700 px-6 py-3 font-medium text-white hover:bg-green-600"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

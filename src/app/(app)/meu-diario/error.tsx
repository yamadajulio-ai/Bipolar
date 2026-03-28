"use client";

export default function MeuDiarioError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Algo deu errado
        </h2>
        <p className="text-sm text-muted">
          Não conseguimos carregar seu diário. Seus dados estão seguros.
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <pre className="text-xs text-left bg-surface-alt dark:bg-surface-raised p-2 rounded overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full rounded-[var(--radius-card)] bg-primary text-white py-3 font-medium hover:bg-primary-dark transition-colors"
          >
            Tentar novamente
          </button>
          <a
            href="/sos"
            className="block w-full rounded-[var(--radius-card)] bg-danger text-on-danger py-3 font-medium hover:bg-danger/90 transition-colors"
          >
            SOS — Preciso de ajuda
          </a>
        </div>
      </div>
    </div>
  );
}

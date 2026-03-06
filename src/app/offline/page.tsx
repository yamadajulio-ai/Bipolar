"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-sm text-center">
        <svg
          className="mx-auto mb-4 h-12 w-12 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>

        <h1 className="mb-2 text-xl font-bold text-foreground">Sem conexão</h1>
        <p className="mb-6 text-sm text-muted">
          Verifique sua internet e tente novamente. Seus dados recentes podem
          estar disponíveis no cache do app.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mb-8 rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
        >
          Tentar novamente
        </button>

        <div className="border-t border-border pt-6">
          <p className="mb-1 text-xs font-medium text-foreground">
            Precisa de ajuda agora?
          </p>
          <p className="text-sm text-muted">
            CVV — Ligue{" "}
            <a href="tel:188" className="font-bold text-primary underline">
              188
            </a>{" "}
            (24h, gratuito)
          </p>
        </div>
      </div>
    </div>
  );
}

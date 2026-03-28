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
          className="mb-6 rounded-lg bg-primary px-6 py-2 min-h-[44px] font-medium text-white hover:bg-primary-dark"
        >
          Tentar novamente
        </button>

        <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-left">
          <p className="text-xs font-medium text-foreground mb-2">Disponível offline:</p>
          <ul className="space-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-2">
              <span className="text-green-500">●</span>
              Exercícios de respiração e aterramento
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">●</span>
              Sons relaxantes
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">●</span>
              Páginas visitadas recentemente (cache)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">●</span>
              SOS — contatos de emergência
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/sos" aria-label="SOS — Preciso de ajuda agora" className="rounded-md bg-red-600 px-3 py-1.5 min-h-[44px] inline-flex items-center text-xs font-medium text-on-danger no-underline">
              SOS
            </a>
            <a href="/exercicios/respiracao/caixa" className="rounded-md border border-border px-3 py-1.5 min-h-[44px] inline-flex items-center text-xs font-medium text-foreground no-underline hover:bg-surface-alt">
              Respiração
            </a>
            <a href="/sons" className="rounded-md border border-border px-3 py-1.5 min-h-[44px] inline-flex items-center text-xs font-medium text-foreground no-underline hover:bg-surface-alt">
              Sons
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <p className="mb-1 text-xs font-medium text-foreground">
            Precisa de ajuda agora?
          </p>
          <p className="text-sm text-muted">
            CVV — Ligue{" "}
            <a href="tel:188" aria-label="Ligar CVV 188 — apoio emocional 24 horas" className="font-bold text-primary underline">
              188
            </a>{" "}
            (24h, gratuito)
          </p>
        </div>
      </div>
    </div>
  );
}

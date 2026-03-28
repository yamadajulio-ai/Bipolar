import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">
        A página que você procura não existe ou foi movida.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:opacity-90"
        >
          Ir para o início
        </Link>
        <Link
          href="/sos"
          className="rounded-lg border border-danger-border px-4 py-2 text-sm font-medium text-danger-fg no-underline hover:bg-danger-bg-subtle"
        >
          SOS — Preciso de ajuda
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted">
        Em crise? Ligue CVV <strong>188</strong> · SAMU <strong>192</strong>
      </p>
    </div>
  );
}

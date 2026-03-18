import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-[#ecf1ee]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 rounded-2xl border border-[#d6deda] bg-[#ecf1ee]/60 p-3 text-center text-sm text-[#3d5c52]">
          <strong>Em crise ou risco imediato?</strong> Ligue agora: CVV{" "}
          <strong>188</strong> · SAMU <strong>192</strong> · ou procure uma{" "}
          <strong>UPA 24h</strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <p>&copy; {new Date().getFullYear()} Suporte Bipolar. Conteúdo educacional — não substitui tratamento médico ou psicológico.</p>
          <div className="flex gap-4">
            <Link href="/privacidade" className="hover:text-foreground no-underline">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-foreground no-underline">
              Termos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

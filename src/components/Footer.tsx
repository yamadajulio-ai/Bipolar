import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-[#f5ebe0]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 rounded-2xl border border-[#ffe0b2] bg-[#fff3e0]/60 p-3 text-center text-sm text-[#6d4c41]">
          <strong>Em crise ou risco imediato?</strong> Ligue agora: CVV{" "}
          <strong>188</strong> · SAMU <strong>192</strong> · UPA{" "}
          <strong>24h</strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#b08968]">
          <p>&copy; {new Date().getFullYear()} Rede Bipolar. Conteúdo educacional — não substitui tratamento médico ou psicológico.</p>
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

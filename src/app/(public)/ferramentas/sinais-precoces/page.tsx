import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EarlySignsChecklist } from "./EarlySignsChecklist";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Checklist de Sinais Precoces de Episódio Bipolar — Suporte Bipolar",
  description:
    "Identifique sinais precoces de mania e depressão no transtorno bipolar. Checklist interativo baseado em protocolos clínicos. Gratuito e printável.",
  alternates: { canonical: "https://suportebipolar.com/ferramentas/sinais-precoces" },
  openGraph: {
    title: "Checklist de Sinais Precoces — Suporte Bipolar",
    description: "Checklist interativo para identificar sinais precoces de episódio bipolar.",
    url: "https://suportebipolar.com/ferramentas/sinais-precoces",
    type: "website",
  },
};

export default function SinaisPrecocesPage() {
  return (
    <>
      <Header isLoggedIn={false} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Checklist de Sinais Precoces
        </h1>
        <p className="text-sm text-muted mb-2 leading-relaxed">
          Reconhecer os primeiros sinais de um episódio de humor é uma das habilidades mais importantes
          no manejo do transtorno bipolar. Esta lista é baseada em sinais comumente relatados
          por pacientes e descritos na literatura clínica.
        </p>
        <p className="text-xs text-muted mb-8 italic">
          Marque os sinais que você percebeu nos últimos dias. Isso não é diagnóstico — é uma ferramenta
          de auto-observação para levar ao seu profissional.
        </p>

        <EarlySignsChecklist />

        <section className="mt-12 space-y-6">
          <h2 className="text-lg font-bold">Como usar esta checklist</h2>
          <ul className="text-sm text-muted space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              Revise os sinais periodicamente (sugestão: toda semana)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              Marque os que você percebeu nos últimos 3-5 dias
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              Se vários sinais de uma mesma categoria estiverem presentes, converse com seu profissional
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">4.</span>
              Use o botão &quot;Imprimir&quot; para levar à consulta
            </li>
          </ul>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-foreground">
              O <strong>Suporte Bipolar</strong> monitora esses sinais automaticamente com base nos seus
              registros diários e gera alertas quando detecta mudanças.
            </p>
            <a
              href="/cadastro"
              className="mt-3 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
            >
              Criar conta gratuita
            </a>
          </div>
        </section>

        <p className="mt-8 text-[10px] text-muted italic">
          Ferramenta educacional — não substitui avaliação profissional. Baseado em protocolos IPSRT e literatura clínica sobre transtorno bipolar.
        </p>
      </main>
      <Footer />
    </>
  );
}

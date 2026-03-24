import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConsultationPrep } from "./ConsultationPrep";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Guia de Preparação para Consulta Psiquiátrica — Suporte Bipolar",
  description:
    "Prepare sua consulta com o psiquiatra: template estruturado com humor, sono, medicação, efeitos colaterais e dúvidas. Gratuito e printável.",
  alternates: { canonical: "https://suportebipolar.com/ferramentas/preparar-consulta" },
  openGraph: {
    title: "Preparação para Consulta — Suporte Bipolar",
    description: "Template estruturado para levar informações organizadas ao psiquiatra.",
    url: "https://suportebipolar.com/ferramentas/preparar-consulta",
    type: "website",
  },
};

export default function PrepararConsultaPage() {
  return (
    <>
      <Header isLoggedIn={false} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Guia de Preparação para Consulta
        </h1>
        <p className="text-sm text-muted mb-2 leading-relaxed">
          Consultas psiquiátricas costumam ser curtas (15-30 minutos). Chegar preparado ajuda a
          aproveitar melhor o tempo e garantir que nada importante seja esquecido.
        </p>
        <p className="text-xs text-muted mb-8 italic">
          Preencha o formulário abaixo antes da consulta e imprima ou mostre no celular.
        </p>

        <ConsultationPrep />

        <section className="mt-12 space-y-6">
          <h2 className="text-lg font-bold">Dicas para a consulta</h2>
          <ul className="text-sm text-muted space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Seja honesto sobre a medicação — se esqueceu doses ou parou por conta própria, é importante relatar
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Traga informações sobre sono e humor das últimas 2-4 semanas
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Anote efeitos colaterais com detalhes: quando começou, intensidade, se afeta o dia a dia
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Se possível, leve um familiar que conviva com você — eles podem ter observações valiosas
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Pergunte sobre os próximos passos e quando agendar a próxima consulta
            </li>
          </ul>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-foreground">
              Com o <strong>Suporte Bipolar</strong>, você gera relatórios automáticos com dados de
              humor, sono, escalas validadas (ASRM, PHQ-9, FAST) e pode compartilhar via Acesso Profissional.
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
          Ferramenta educacional — não substitui avaliação profissional.
        </p>
      </main>
      <Footer />
    </>
  );
}

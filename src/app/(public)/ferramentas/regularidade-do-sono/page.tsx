import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JetLagCalculator } from "./JetLagCalculator";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Regularidade do Sono — Calculadora de Social Jet Lag — Suporte Bipolar",
  description:
    "Calcule seu social jet lag: a diferença entre seu relógio biológico nos dias úteis e fins de semana. Ferramenta gratuita para pessoas com transtorno bipolar.",
  alternates: { canonical: "https://suportebipolar.com/ferramentas/regularidade-do-sono" },
  openGraph: {
    title: "Regularidade do Sono — Suporte Bipolar",
    description: "Descubra quanto o seu horário de sono muda entre dias úteis e fins de semana.",
    url: "https://suportebipolar.com/ferramentas/regularidade-do-sono",
    type: "website",
  },
};

export default function JetLagPage() {
  return (
    <>
      <Header isLoggedIn={false} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Calculadora de Social Jet Lag
        </h1>
        <p className="text-sm text-muted mb-8 leading-relaxed">
          O <strong>social jet lag</strong> é a diferença entre seu relógio biológico nos dias úteis e nos fins de semana.
          Para pessoas com transtorno bipolar, essa irregularidade no sono pode desencadear episódios de humor.
          Estudos mostram que um social jet lag acima de 1 hora já está associado a pior qualidade de sono e instabilidade.
        </p>

        <JetLagCalculator />

        <section className="mt-12 space-y-6">
          <h2 className="text-lg font-bold">O que é social jet lag?</h2>
          <p className="text-sm text-muted leading-relaxed">
            O conceito foi proposto pelo pesquisador Till Roenneberg em 2006. Ele mede a diferença
            entre o ponto médio do sono (midpoint) nos dias úteis e nos fins de semana. Por exemplo,
            se você dorme das 23h às 7h durante a semana (midpoint: 3h) e das 1h às 10h no fim de
            semana (midpoint: 5h30), seu social jet lag é de <strong>2h30</strong>.
          </p>

          <h2 className="text-lg font-bold">Por que isso importa para bipolar?</h2>
          <p className="text-sm text-muted leading-relaxed">
            A Terapia Interpessoal e de Ritmos Sociais (IPSRT), um dos tratamentos validados para
            transtorno bipolar, enfatiza a importância de manter horários regulares de sono e
            atividades. Irregularidades no ritmo circadiano podem funcionar como gatilho para
            episódios maníacos ou depressivos.
          </p>

          <h2 className="text-lg font-bold">Como reduzir o social jet lag?</h2>
          <ul className="text-sm text-muted space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Tente manter o mesmo horário de acordar nos dias úteis e fins de semana (variação máxima de 1h)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Evite compensar sono perdido dormindo muito mais no fim de semana
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Exposição à luz natural pela manhã ajuda a regular o relógio biológico
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Converse com seu profissional sobre estratégias de higiene do sono
            </li>
          </ul>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-6">
            <p className="text-sm text-foreground">
              Quer acompanhar seu social jet lag automaticamente?{" "}
              O <strong>Suporte Bipolar</strong> calcula isso diariamente com base nos seus registros de sono.
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
          Ferramenta educacional — não substitui avaliação profissional. Baseado em Roenneberg et al. (2006) e protocolos IPSRT.
        </p>
      </main>
      <Footer />
    </>
  );
}

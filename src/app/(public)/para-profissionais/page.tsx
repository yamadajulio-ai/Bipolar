import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Para Profissionais de Saúde — Suporte Bipolar",
  description:
    "Acesse dados estruturados dos seus pacientes com transtorno bipolar: humor, sono, ASRM, PHQ-9, FAST, eventos de vida. Gratuito e seguro.",
  alternates: { canonical: "https://suportebipolar.com/para-profissionais" },
  openGraph: {
    title: "Para Profissionais de Saúde — Suporte Bipolar",
    description: "Dados estruturados dos seus pacientes: humor, sono, escalas validadas, eventos de vida.",
    url: "https://suportebipolar.com/para-profissionais",
    type: "website",
  },
};

const DATA_POINTS = [
  { icon: "🌡️", label: "Termômetro de humor", desc: "Posição 0-100 entre depressão e mania, zonas clínicas, features mistas" },
  { icon: "🌙", label: "Padrões de sono", desc: "Duração, regularidade, variabilidade, social jet lag, HRV e FC" },
  { icon: "📊", label: "ASRM + PHQ-9", desc: "Escalas validadas preenchidas semanalmente pelo paciente" },
  { icon: "⚡", label: "FAST (Funcionamento)", desc: "Avaliação de funcionamento em 6 domínios: trabalho, social, autocuidado, finanças, cognição, lazer" },
  { icon: "📅", label: "Life Chart", desc: "Eventos significativos: mudança de medicação, estressores, viagens, hospitalizações" },
  { icon: "🔔", label: "Sinais de alerta", desc: "Score de risco (0-100), fatores contribuintes, predição de episódios" },
  { icon: "🆘", label: "Eventos SOS", desc: "Registro de crises: quando o paciente acionou ajuda de emergência" },
  { icon: "💊", label: "Adesão à medicação", desc: "Percentual de dias com medicação tomada nos últimos 30 dias" },
];

const STEPS = [
  { number: "1", title: "Paciente cria um link", desc: "Na área de Conta, o paciente gera um link de Acesso Profissional protegido por PIN" },
  { number: "2", title: "Você recebe o link + PIN", desc: "O paciente compartilha o link e o PIN de 6 dígitos diretamente com você" },
  { number: "3", title: "Acessa o dashboard", desc: "Visualize todos os dados clínicos do paciente em formato estruturado, pronto para consulta" },
];

export default function ParaProfissionaisPage() {
  return (
    <>
      <Header isLoggedIn={false} />
      <main className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <section className="text-center mb-16">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Dados clínicos estruturados dos seus pacientes
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto mb-6">
            O Suporte Bipolar é uma ferramenta gratuita que seus pacientes podem usar para registrar
            humor, sono, rotina e escalas validadas. Você acessa os dados via dashboard seguro.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cadastro"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark no-underline"
            >
              Experimentar como paciente
            </Link>
            <a
              href="#como-funciona"
              className="rounded-lg border border-primary px-6 py-3 font-medium text-primary hover:bg-primary/5 no-underline"
            >
              Como funciona
            </a>
          </div>
        </section>

        {/* What data you receive */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">O que você visualiza</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DATA_POINTS.map((d) => (
              <div key={d.label} className="rounded-lg border border-border p-4 bg-surface">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{d.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{d.label}</h3>
                    <p className="text-xs text-muted mt-1">{d.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="como-funciona" className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Como funciona o Acesso Profissional</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary mb-4">
                  {s.number}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-xs text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="mb-16 rounded-lg border border-border bg-surface-alt p-6">
          <h2 className="text-lg font-bold text-center mb-4">Segurança e privacidade</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted">
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Acesso protegido por <strong>token + PIN de 6 dígitos</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Link <strong>expirável</strong> (configurável pelo paciente)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>Somente leitura</strong> — profissional não altera dados</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>LGPD</strong> — consentimento explícito do paciente</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Bloqueio automático após <strong>tentativas de PIN incorretas</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Paciente pode <strong>revogar acesso</strong> a qualquer momento</span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center mb-16">
          <h2 className="text-xl font-bold mb-2">100% gratuito</h2>
          <p className="text-sm text-muted mb-6">
            O Suporte Bipolar não tem plano pago. Todas as funcionalidades estão disponíveis
            gratuitamente para pacientes e profissionais.
          </p>
          <p className="text-sm text-muted mb-6">
            Peça ao seu paciente para criar uma conta em{" "}
            <Link href="/cadastro" className="text-primary underline">suportebipolar.com</Link>{" "}
            e gerar um link de Acesso Profissional na área de Conta.
          </p>
        </section>

        {/* Disclaimer */}
        <section className="text-center">
          <p className="text-xs text-muted italic">
            O Suporte Bipolar é uma ferramenta de acompanhamento e auto-organização.
            Não substitui avaliação, diagnóstico ou tratamento por profissional de saúde.
            Baseado em protocolos IPSRT e pesquisas do PROMAN/USP.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

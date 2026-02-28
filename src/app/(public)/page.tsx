import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f0fdf4 0%, white 100%)" }}>
          <div className="pointer-events-none absolute top-10 left-[10%] h-40 w-40 rounded-full bg-[#86efac] opacity-20 blur-3xl" />
          <div className="pointer-events-none absolute top-20 right-[8%] h-32 w-32 rounded-full bg-[#4ade80] opacity-15 blur-3xl" />

          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-10 pt-12 text-center md:pt-16">
            <div className="mb-8 flex items-center justify-center">
              <div className="relative flex h-32 w-40 items-center justify-center">
                <div className="absolute bottom-4 left-3 h-14 w-16 rotate-[12deg] rounded-b-full rounded-tr-full bg-[#d4a574] opacity-50" />
                <div className="absolute bottom-4 right-3 h-14 w-16 -rotate-[12deg] rounded-b-full rounded-tl-full bg-[#a1887f] opacity-50" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="h-7 w-7 rounded-full bg-[#4ade80]" />
                  <div className="-mt-1 ml-4 h-5 w-5 rounded-full bg-[#22c55e] opacity-80" />
                  <div className="-ml-3 -mt-2 h-5 w-5 rounded-full bg-[#22c55e] opacity-80" />
                  <div className="h-10 w-1 rounded-full bg-[#15803d]" />
                </div>
              </div>
            </div>

            <h1 className="mb-4 text-3xl font-bold leading-tight text-[#14532d] md:text-4xl">
              Seu painel de estabilidade
            </h1>
            <p className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-[#6b7280]">
              Tudo que uma pessoa com Transtorno Afetivo Bipolar tipo 1 precisa em um
              só lugar: rotina, sono, humor, finanças e corpo. Feito por quem entende.
            </p>

            <div className="mx-auto mb-8 max-w-md rounded-2xl border border-[#fde68a] bg-[#fef3c7] px-5 py-3 text-sm text-[#92400e]">
              Conteúdo educacional — não substitui seu profissional de saúde
            </div>

            <div className="flex gap-3">
              <Link
                href="/cadastro"
                className="rounded-xl bg-[#15803d] px-7 py-3 text-sm font-medium no-underline shadow-md transition-colors hover:bg-[#166534]"
                style={{ color: "#fff" }}
              >
                Criar conta gratuita
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-[#86efac] bg-white px-7 py-3 text-sm font-medium text-[#15803d] no-underline transition-colors hover:bg-[#f0fdf4]"
              >
                Entrar
              </Link>
            </div>
          </div>
        </section>

        {/* Pilares — por que cada ferramenta importa */}
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="mb-2 text-center text-2xl font-semibold text-[#14532d]">
            Os 4 pilares do seu cuidado
          </h2>
          <p className="mx-auto mb-12 max-w-lg text-center text-sm text-[#6b7280]">
            Cada área é um ponto crítico para a estabilidade no TAB tipo 1. Aqui você monitora todas.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Rotina */}
            <div className="flex gap-4 rounded-2xl border border-[#f0f0f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <svg className="h-8 w-8" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#14532d]">Rotina e Google Agenda</h3>
                <p className="text-sm leading-relaxed text-[#6b7280]">
                  Regularidade protege contra episódios. Planeje sua semana com blocos de atividades,
                  âncoras de sono e sincronize tudo com o Google Calendar.
                </p>
              </div>
            </div>
            {/* Financas */}
            <div className="flex gap-4 rounded-2xl border border-[#f0f0f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                <Image src="/mobills-logo.png" alt="Mobills" width={56} height={56} className="object-contain" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#14532d]">Controle financeiro e Mobills</h3>
                <p className="text-sm leading-relaxed text-[#6b7280]">
                  Gastos impulsivos são um dos primeiros sinais de mania. Importe do Mobills
                  e veja seus padrões de gasto cruzados com humor e energia.
                </p>
              </div>
            </div>
            {/* Corpo */}
            <div className="flex gap-4 rounded-2xl border border-[#f0f0f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.18 0-.36-.02-.53-.06.018-.18.04-.36.04-.55 0-1.12.535-2.22 1.235-3.02C13.666 1.66 14.98 1 16.12 1c.18 0 .36.01.53.02-.01.14-.01.28-.01.41h-.274zm3.44 5.89c-.16.09-2.61 1.53-2.585 4.56.03 3.6 3.14 4.8 3.17 4.81-.02.08-.5 1.7-1.63 3.36-.98 1.45-2 2.9-3.6 2.93-1.57.03-2.08-.94-3.88-.94s-2.39.91-3.87.97c-1.55.06-2.73-1.57-3.72-3.01C1.6 17.18.27 12.84 2.44 9.73c1.07-1.54 2.99-2.52 5.07-2.55 1.52-.03 2.95 1.03 3.88 1.03.93 0 2.67-1.27 4.5-1.08.77.03 2.92.31 4.3 2.33-.11.07-2.56 1.51-2.54 4.49l-.36-.18z" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#14532d]">Sono e corpo via Apple Health</h3>
                <p className="text-sm leading-relaxed text-[#6b7280]">
                  Alterações no sono precedem crises em até 72h. Dados de HRV, sono e atividade
                  física entram automaticamente via Health Auto Export.
                </p>
              </div>
            </div>
            {/* Humor */}
            <div className="flex gap-4 rounded-2xl border border-[#f0f0f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl" style={{ background: "#fef3c7" }}>
                <span className="text-2xl">📝</span>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#14532d]">Check-in de humor em 30s</h3>
                <p className="text-sm leading-relaxed text-[#6b7280]">
                  Registre humor, energia e medicação diariamente. O sistema detecta padrões e
                  avisa quando algo foge do normal — antes que você perceba.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mais ferramentas */}
        <section className="bg-[#f9fafb] px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-2 text-center text-2xl font-semibold text-[#14532d]">
              E tem mais
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-center text-sm text-[#6b7280]">
              Tudo pensado para o dia a dia de quem vive com bipolaridade, sem pressa e sem julgamento.
            </p>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: "📊",
                  title: "Insights e tendências",
                  desc: "Gráficos de humor, sono e energia ao longo do tempo. Identifique ciclos e compartilhe com seu médico.",
                  bg: "#dbeafe",
                },
                {
                  icon: "📖",
                  title: "Biblioteca educacional",
                  desc: "Conteúdos confiáveis sobre TAB tipo 1, sinais precoces, sono e direitos do paciente.",
                  bg: "#fce7f3",
                },
                {
                  icon: "🫁",
                  title: "Respiração e aterramento",
                  desc: "Exercícios guiados para ansiedade e insônia. Visuais calmos, sem pressão.",
                  bg: "#e0e7ff",
                },
                {
                  icon: "💛",
                  title: "Apoio para famílias",
                  desc: "Guia prático para familiares: como apoiar, limites saudáveis e quando buscar ajuda.",
                  bg: "#fef9c3",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                    style={{ background: feature.bg }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 font-semibold text-[#14532d]">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#6b7280]">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust & Safety */}
        <section className="bg-[#f0fdf4] px-4 py-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-xl font-semibold text-[#14532d]">
              Segurança e privacidade em primeiro lugar
            </h2>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-[#374151]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow-sm">🔒</span>
                <span>Dados protegidos (LGPD)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow-sm">🚫</span>
                <span>Sem gamificação</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow-sm">🤖</span>
                <span>Sem IA ou algoritmos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow-sm">💜</span>
                <span>100% gratuito</span>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f0fdf4 0%, white 100%)" }}>
          {/* Blobs decorativos */}
          <div className="pointer-events-none absolute top-10 left-[10%] h-40 w-40 rounded-full bg-[#86efac] opacity-20 blur-3xl" />
          <div className="pointer-events-none absolute top-20 right-[8%] h-32 w-32 rounded-full bg-[#4ade80] opacity-15 blur-3xl" />

          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-10 pt-12 text-center md:pt-16">
            {/* Ícone: mãos segurando broto */}
            <div className="mb-8 flex items-center justify-center">
              <div className="relative flex h-32 w-40 items-center justify-center">
                {/* Mão esquerda */}
                <div className="absolute bottom-4 left-3 h-14 w-16 rotate-[12deg] rounded-b-full rounded-tr-full bg-[#d4a574] opacity-50" />
                {/* Mão direita */}
                <div className="absolute bottom-4 right-3 h-14 w-16 -rotate-[12deg] rounded-b-full rounded-tl-full bg-[#a1887f] opacity-50" />
                {/* Broto */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="h-7 w-7 rounded-full bg-[#4ade80]" />
                  <div className="-mt-1 ml-4 h-5 w-5 rounded-full bg-[#22c55e] opacity-80" />
                  <div className="-ml-3 -mt-2 h-5 w-5 rounded-full bg-[#22c55e] opacity-80" />
                  <div className="h-10 w-1 rounded-full bg-[#15803d]" />
                </div>
              </div>
            </div>

            <h1 className="mb-4 text-3xl font-bold leading-tight text-[#14532d] md:text-4xl">
              Cultive sua estabilidade
            </h1>
            <p className="mx-auto mb-6 max-w-xl text-base leading-relaxed text-[#6b7280]">
              Cada dia é uma semente. Ferramentas de cuidado e educação para
              quem convive com Transtorno Afetivo Bipolar tipo 1 e suas famílias.
            </p>

            {/* Disclaimer */}
            <div className="mx-auto mb-8 max-w-md rounded-2xl border border-[#fde68a] bg-[#fef3c7] px-5 py-3 text-sm text-[#92400e]">
              Conteúdo educacional — não substitui seu profissional de saúde
            </div>

            {/* CTAs */}
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

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-2 text-center text-2xl font-semibold text-[#14532d]">
            O que você encontra aqui
          </h2>
          <p className="mx-auto mb-10 max-w-lg text-center text-sm text-[#6b7280]">
            Tudo pensado para o seu dia a dia, no seu ritmo, sem pressa e sem julgamento.
          </p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "📅",
                title: "Calendário de Estabilidade",
                desc: "Planeje sua semana com blocos de atividades. Âncoras protegem sua rotina, alertas gentis cuidam do seu sono.",
                bg: "#dcfce7",
              },
              {
                icon: "📝",
                title: "Check-in Rápido",
                desc: "30 segundos para registrar como você está. Humor, energia, sono — tudo num só lugar.",
                bg: "#fef3c7",
              },
              {
                icon: "📊",
                title: "Insights de Estabilidade",
                desc: "Veja padrões de sono, regularidade de âncoras e carga de energia. Sem julgamento, com clareza.",
                bg: "#dbeafe",
              },
              {
                icon: "📖",
                title: "Biblioteca Educacional",
                desc: "Conteúdos confiáveis sobre TAB tipo 1, sono, sinais precoces e direitos do paciente.",
                bg: "#fce7f3",
              },
              {
                icon: "🫁",
                title: "Respiração e Aterramento",
                desc: "Exercícios guiados para momentos de ansiedade ou insônia. Visuais calmos, sem pressão.",
                bg: "#e0e7ff",
              },
              {
                icon: "💛",
                title: "Apoio para Famílias",
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

import type { Metadata } from "next";
import Link from "next/link";
import { ComecarViewContent } from "./ComecarViewContent";

export const metadata: Metadata = {
  title: "Comece agora — Suporte Bipolar",
  description:
    "Acompanhe humor, sono e energia com check-ins rápidos e dados automáticos. 100% gratuito, instala direto do navegador.",
  openGraph: {
    title: "Comece agora — Suporte Bipolar",
    description:
      "Acompanhe humor, sono e energia com check-ins rápidos e dados automáticos. 100% gratuito.",
    url: "https://suportebipolar.com/comecar",
    images: [
      {
        url: "https://suportebipolar.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Suporte Bipolar",
      },
    ],
  },
  robots: { index: false, follow: false },
};

/* ── SVG icons ─────────────────────────────────────────────────────── */

function IconCheck() {
  return (
    <svg className="h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

/* ================================================================= */
export default function ComecarPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ComecarViewContent />

      {/* ─── HEADER MINIMAL ──────────────────────────────────── */}
      <header className="border-b border-border bg-white/80 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground no-underline">
            <svg viewBox="0 0 32 32" className="h-7 w-7 text-primary" fill="currentColor">
              <circle cx="16" cy="10" r="3" />
              <circle cx="8" cy="16" r="2.5" />
              <circle cx="24" cy="16" r="2.5" />
              <circle cx="10" cy="24" r="2" />
              <circle cx="22" cy="24" r="2" />
              <circle cx="16" cy="20" r="2.5" />
              <line x1="16" y1="10" x2="8" y2="16" stroke="currentColor" strokeWidth="1.2" />
              <line x1="16" y1="10" x2="24" y2="16" stroke="currentColor" strokeWidth="1.2" />
              <line x1="8" y1="16" x2="10" y2="24" stroke="currentColor" strokeWidth="1.2" />
              <line x1="24" y1="16" x2="22" y2="24" stroke="currentColor" strokeWidth="1.2" />
              <line x1="8" y1="16" x2="16" y2="20" stroke="currentColor" strokeWidth="1.2" />
              <line x1="24" y1="16" x2="16" y2="20" stroke="currentColor" strokeWidth="1.2" />
              <line x1="10" y1="24" x2="16" y2="20" stroke="currentColor" strokeWidth="1.2" />
              <line x1="22" y1="24" x2="16" y2="20" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-base font-semibold">Suporte Bipolar</span>
          </Link>
          <Link
            href="/cadastro"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline transition-colors hover:bg-primary-dark"
          >
            Criar conta
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ─── 1. HERO ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-surface">
          <div className="pointer-events-none absolute -top-20 right-[5%] h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto max-w-2xl px-5 pb-12 pt-14 text-center md:pb-16 md:pt-20">
            <p className="mb-4 text-sm font-medium text-primary">
              100% gratuito · instala direto do navegador
            </p>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
              Acompanhe humor, sono e energia.{" "}
              <span className="text-primary">Veja padrões ao longo do tempo.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              A maior parte entra sozinha do relógio ou pulseira. Você faz um check-in
              rápido e o app organiza tudo em visualizações simples.
            </p>

            <Link
              href="/cadastro"
              className="mt-8 inline-block w-full rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white no-underline shadow-md transition-all hover:bg-primary-dark hover:shadow-lg sm:w-auto"
            >
              Criar minha conta gratuita
            </Link>

            <p className="mt-3 text-xs text-muted">
              Sem cartão de crédito · sem anúncios · sem plano premium
            </p>
          </div>
        </section>

        {/* ─── 2. BENEFÍCIOS ──────────────────────────────────── */}
        <section className="px-5 py-14 md:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              O que o app faz por você
            </h2>

            <div className="mt-10 flex flex-col gap-6">
              {[
                {
                  title: "Check-in rápido de humor e energia",
                  desc: "Dois toques por dia. O app acompanha a tendência e mostra quando algo muda.",
                },
                {
                  title: "Sono e sinais do corpo automáticos",
                  desc: "Conecte seu relógio ou pulseira e os dados entram sozinhos — sono, frequência cardíaca, HRV e passos.",
                },
                {
                  title: "Insights sobre seus padrões",
                  desc: "Mapas de calor, termômetro de humor, regularidade do sono e sinais de mudança — tudo visual e claro.",
                },
                {
                  title: "Rotina integrada com Google Agenda",
                  desc: "Sua agenda entra automaticamente. O app avalia regularidade da rotina social, um dos pilares da estabilidade.",
                },
                {
                  title: "Compartilhe com seu profissional de saúde",
                  desc: "Gere um link com PIN, somente leitura. O profissional vê o painel completo sem precisar de conta.",
                },
                {
                  title: "Apoio em momentos difíceis",
                  desc: "Acesso rápido ao CVV 188, SAMU 192, contatos de confiança, respiração guiada e grounding.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-0.5">
                    <IconCheck />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 3. COMO INSTALAR ──────────────────────────────── */}
        <section className="bg-surface-alt px-5 py-14 md:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Como instalar no celular
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
              Funciona como um aplicativo, mas instala direto do navegador — sem App Store, sem Play Store.
            </p>

            <div className="mt-10 grid gap-8 md:grid-cols-2">
              {/* iPhone */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconPhone />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">iPhone</h3>
                </div>
                <ol className="flex flex-col gap-3 text-sm text-muted">
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                    <span>Abra <strong className="text-foreground">suportebipolar.com</strong> no <strong className="text-foreground">Safari</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                    <span>Toque no botão <strong className="text-foreground">Compartilhar</strong> (quadrado com seta para cima)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                    <span>Escolha <strong className="text-foreground">&quot;Adicionar à Tela de Início&quot;</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
                    <span>Toque em <strong className="text-foreground">Adicionar</strong> — pronto!</span>
                  </li>
                </ol>
              </div>

              {/* Android */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconPhone />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Android</h3>
                </div>
                <ol className="flex flex-col gap-3 text-sm text-muted">
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                    <span>Abra <strong className="text-foreground">suportebipolar.com</strong> no <strong className="text-foreground">Chrome</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                    <span>O Chrome mostra um banner <strong className="text-foreground">&quot;Instalar aplicativo&quot;</strong> automaticamente</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                    <span>Toque em <strong className="text-foreground">Instalar</strong> — pronto!</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
                    <span>Se o banner não aparecer: toque nos <strong className="text-foreground">3 pontinhos</strong> → <strong className="text-foreground">&quot;Instalar aplicativo&quot;</strong></span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. CONFIANÇA ──────────────────────────────────── */}
        <section className="px-5 py-14 md:py-16">
          <div className="mx-auto max-w-2xl">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: <IconShield />,
                  title: "Privacidade real",
                  desc: "Dados criptografados, alinhado à LGPD. Você pode excluir tudo a qualquer momento.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                    </svg>
                  ),
                  title: "Base clínica",
                  desc: "Instrumentos validados internacionalmente, usados na prática clínica.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                  ),
                  title: "100% gratuito",
                  desc: "Sem anúncios, sem plano premium. Todas as funcionalidades para todos.",
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. FAQ CURTO ──────────────────────────────────── */}
        <section className="bg-surface-alt px-5 py-14 md:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Perguntas frequentes
            </h2>

            <div className="mt-10 flex flex-col gap-4">
              {[
                {
                  q: "Preciso de diagnóstico para usar?",
                  a: "Não. O app pode ser útil para quem quer organizar informações do dia a dia e acompanhar padrões ao longo do tempo.",
                },
                {
                  q: "Funciona no iPhone e no Android?",
                  a: "Sim. Funciona como um aplicativo instalável direto do navegador. No iPhone, use o Safari. No Android, o Chrome oferece instalação automática.",
                },
                {
                  q: "Preciso de relógio ou pulseira?",
                  a: "Não é obrigatório. Mas com relógio ou pulseira inteligente, sono e sinais do corpo entram automaticamente.",
                },
                {
                  q: "Meu profissional de saúde consegue acompanhar?",
                  a: "Sim. Você gera um link com PIN, somente leitura, sem exigir conta do profissional.",
                },
                {
                  q: "É realmente gratuito?",
                  a: "Sim. Sem anúncios, sem plano premium, sem pegadinhas. Todas as funcionalidades estão disponíveis para todos.",
                },
              ].map((faq) => (
                <details key={faq.q} className="group rounded-xl border border-border bg-surface overflow-hidden">
                  <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden list-none">
                    {faq.q}
                    <span className="ml-4 shrink-0 text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-6 pb-4 text-sm leading-relaxed text-muted">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 6. CTA FINAL ──────────────────────────────────── */}
        <section className="bg-primary px-5 py-14 md:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Comece a acompanhar seus padrões
            </h2>
            <p className="mt-3 text-white/80">
              Crie sua conta gratuita e veja seu painel em poucos minutos.
            </p>
            <Link
              href="/cadastro"
              className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary no-underline shadow-md transition-all hover:bg-white/90 hover:shadow-lg"
            >
              Criar minha conta gratuita
            </Link>
            <p className="mt-3 text-xs text-white/60">
              Sem cartão de crédito · sem anúncios · sem plano premium
            </p>
          </div>
        </section>

        {/* ─── DISCLAIMER ────────────────────────────────────── */}
        <section className="border-t border-border bg-background px-5 py-8">
          <div className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-muted">
            <p>
              O Suporte Bipolar é uma ferramenta digital de apoio à rotina e ao autocuidado.
              Não realiza diagnósticos, não prescreve medicação e não substitui
              acompanhamento profissional de saúde.
            </p>
            <p className="mt-2">
              Em crise ou emergência, ligue para o <strong className="text-foreground">CVV 188</strong> (24h, gratuito)
              ou <strong className="text-foreground">SAMU 192</strong>.
            </p>
            <div className="mt-4 flex items-center justify-center gap-4 text-muted">
              <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
              <span>·</span>
              <Link href="/termos" className="hover:text-foreground">Termos de Uso</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

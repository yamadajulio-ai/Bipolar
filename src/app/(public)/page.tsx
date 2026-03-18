import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

/* ── tiny SVG icon helpers (inline, no deps) ─────────────────────── */
function IconCheck() {
  return (
    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function IconNum({ n }: { n: number }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
      {n}
    </span>
  );
}

/* ── heatmap color helper ────────────────────────────────────────── */
const heatColors = ["bg-red-300", "bg-amber-300", "bg-emerald-300", "bg-emerald-400", "bg-emerald-300", "bg-amber-300", "bg-emerald-400"];
function heatColor(i: number) {
  return heatColors[i % heatColors.length];
}

/* ================================================================= */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">

        {/* ─── 1. HERO ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-surface">
          <div className="pointer-events-none absolute -top-20 right-[5%] h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-[10%] h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto max-w-3xl px-5 pb-12 pt-14 text-center md:pb-16 md:pt-20">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
              Acompanhe seus padrões.{" "}
              <span className="text-primary">Perceba mudanças cedo.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              Registre humor, sono e energia em 30&nbsp;segundos. Receba insights
              sobre seus padrões e compartilhe com seu profissional de saúde.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/cadastro"
                className="w-full rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white no-underline shadow-md transition-colors hover:bg-primary-dark sm:w-auto"
              >
                Começar gratuitamente
              </Link>
            </div>

            <p className="mt-3 text-xs text-muted">
              Gratuito, sem anúncios · Leva 30&nbsp;segundos
            </p>

            <p className="mt-10 text-xs text-muted/70">
              Conteúdo educacional — não substitui avaliação profissional.
            </p>
          </div>
        </section>

        {/* ─── 2. COMO FUNCIONA ────────────────────────────────── */}
        <section className="px-5 py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Como funciona
            </h2>

            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <IconNum n={1} />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  Registre em 30&nbsp;segundos
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Humor, energia, ansiedade, sono e medicação. Todo dia, no seu ritmo.
                </p>
              </div>
              {/* Step 2 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <IconNum n={2} />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  Veja seus padrões
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  O app cruza seus dados e mostra tendências, correlações e mudanças
                  que merecem atenção.
                </p>
              </div>
              {/* Step 3 */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <IconNum n={3} />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  Compartilhe com seu profissional
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Gere um link seguro para seu psiquiatra ou terapeuta acompanhar
                  sua evolução.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3. INSIGHTS — FEATURE HERO ──────────────────────── */}
        <section className="bg-foreground/[0.03] px-5 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                Seus padrões, visíveis
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
                O app resume seus registros, cruza sinais e destaca mudanças que
                merecem atenção — sem fazer promessas diagnósticas.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {/* Termômetro */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Termômetro de humor
                </p>
                <div className="mt-4 flex items-end gap-4">
                  <div className="flex w-8 flex-col gap-0.5 overflow-hidden rounded-lg">
                    <div className="h-5 bg-red-400" />
                    <div className="h-5 bg-amber-400" />
                    <div className="relative h-6 bg-emerald-400">
                      <div className="absolute -right-3 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-foreground" />
                    </div>
                    <div className="h-5 bg-sky-400" />
                    <div className="h-5 bg-blue-400" />
                  </div>
                  <div>
                    <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Eutimia
                    </span>
                    <p className="mt-1 text-xs text-muted">Instabilidade: baixa</p>
                  </div>
                </div>
              </div>

              {/* Heatmap sono */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Padrão de sono — 30&nbsp;noites
                </p>
                <div className="mt-4 grid grid-cols-7 gap-1">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} className={`h-4 w-4 rounded-sm ${heatColor(i)}`} />
                  ))}
                </div>
                <div className="mt-3 flex gap-3 text-[10px] text-muted">
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-300" />&lt;&nbsp;5h</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-300" />5-7h</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-300" />7-9h</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />&gt;&nbsp;9h</span>
                </div>
              </div>

              {/* Previsão de episódios */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Previsão de episódios
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4a7c59" strokeWidth="2.5"
                        strokeDasharray="25 75" strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-xs font-bold text-foreground">Baixo</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Risco baixo</p>
                    <p className="text-xs text-muted">Baseado em 14 dias de dados</p>
                  </div>
                </div>
              </div>

              {/* Narrativa IA */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Resumo com IA <span className="ml-1">✨</span>
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted/80">
                  &ldquo;Nas últimas duas semanas, seu humor manteve-se estável na
                  faixa de eutimia. O sono apresentou leve irregularidade nas
                  noites de quinta e sexta, possivelmente associada a...&rdquo;
                </p>
                <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary">
                  Gerado por IA responsável
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. O QUE VOCÊ ACOMPANHA ────────────────────────── */}
        <section className="bg-surface px-5 py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              O que você acompanha
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: (
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  ),
                  title: "Humor e energia",
                  desc: "Check-in diário com humor, energia, ansiedade, irritabilidade e medicação. Leva 30 segundos.",
                },
                {
                  icon: (
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  ),
                  title: "Sono e corpo",
                  desc: "Duração, regularidade e qualidade do sono. Dados de saúde via Apple Watch ou pulseira Android.",
                },
                {
                  icon: (
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  ),
                  title: "Rotina e compromissos",
                  desc: "Seus eventos do Google Calendar integrados ao seu plano de estabilidade.",
                },
                {
                  icon: (
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                  ),
                  title: "Finanças",
                  desc: "Padrões de gasto cruzados com humor. Gastos impulsivos podem ser um sinal precoce de mudança.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-background/50 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    {item.icon}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. BASE CLÍNICA ─────────────────────────────────── */}
        <section className="px-5 py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Base clínica e científica
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted md:text-base">
              Desenvolvido a partir de protocolos reconhecidos e pesquisas brasileiras.
            </p>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {[
                {
                  title: "Baseado em IPSRT",
                  desc: "Terapia de Ritmos Sociais e Interpessoais, protocolo de referência para bipolaridade.",
                },
                {
                  title: "Avaliações validadas",
                  desc: "ASRM para mania, PHQ-9 para depressão e FAST para funcionalidade — instrumentos usados na prática clínica.",
                },
                {
                  title: "Acesso profissional",
                  desc: "Seu psiquiatra ou terapeuta pode acompanhar seus dados por um link seguro e privado, sem criar conta.",
                },
                {
                  title: "Pesquisas USP",
                  desc: "Inspirado em estudos do PROMAN, programa de referência em transtornos de humor da Universidade de São Paulo.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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

        {/* ─── 6. SEGURANÇA E CRISE ────────────────────────────── */}
        <section className="bg-surface px-5 py-14 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              Para os momentos difíceis
            </h2>
            <p className="mt-3 text-sm italic text-muted md:text-base">
              Porque estabilidade também é ter para onde ir quando precisa.
            </p>

            <div className="mt-10 grid gap-6 text-left sm:grid-cols-2">
              {[
                {
                  emoji: "📞",
                  title: "Contatos de emergência",
                  desc: "Acesse CVV 188, SAMU 192 e seus contatos pessoais com um toque.",
                },
                {
                  emoji: "📋",
                  title: "Plano de crise pessoal",
                  desc: "Defina com antecedência o que fazer e quem ligar em momentos de crise.",
                },
                {
                  emoji: "🌬️",
                  title: "Respiração e aterramento",
                  desc: "Exercícios guiados para ansiedade, insônia e momentos de tensão.",
                },
                {
                  emoji: "🔔",
                  title: "Alerta automático",
                  desc: "O app identifica sinais de risco nos seus check-ins e oferece recursos de apoio.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl bg-background p-5">
                  <span className="text-xl">{item.emoji}</span>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. TRUST BAR ────────────────────────────────────── */}
        <section className="bg-primary/5 px-5 py-10">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {[
              { icon: "🔒", label: "LGPD + criptografia AES-256" },
              { icon: "💚", label: "100% gratuito, sem anúncios" },
              { icon: "📱", label: "Funciona offline (PWA)" },
              { icon: "🧠", label: "IA responsável e transparente" },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-base shadow-sm">
                  {badge.icon}
                </span>
                <span className="text-sm font-medium text-foreground">{badge.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 8. FAQ ──────────────────────────────────────────── */}
        <section className="px-5 py-14 md:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Perguntas frequentes
            </h2>

            <div className="mt-10 flex flex-col gap-4">
              {[
                {
                  q: "O que é o Suporte Bipolar?",
                  a: "É um app web gratuito para pessoas com transtorno bipolar acompanharem humor, sono, energia, rotina e finanças. Ele identifica padrões nos seus dados e gera insights que você pode compartilhar com seu profissional de saúde.",
                },
                {
                  q: "Preciso de diagnóstico para usar?",
                  a: "Não. O app é útil para qualquer pessoa investigando ou já diagnosticada com transtorno bipolar. Ele não faz diagnósticos — isso é papel do seu profissional de saúde.",
                },
                {
                  q: "Meus dados estão seguros?",
                  a: "Sim. Os dados são protegidos por criptografia AES-256, seguem a LGPD e nunca são vendidos ou compartilhados. Você pode excluir sua conta e todos os dados a qualquer momento.",
                },
                {
                  q: "Como funciona a IA no app?",
                  a: "A IA gera resumos narrativos dos seus registros, cruzando humor, sono e rotina. Ela nunca faz diagnósticos ou promessas clínicas — apenas organiza seus dados de forma acessível.",
                },
                {
                  q: "Funciona no Android?",
                  a: "Sim. O Suporte Bipolar é um app web (PWA) que funciona em qualquer navegador. No Android, a integração com dados de saúde é feita via Health Connect.",
                },
                {
                  q: "Preciso pagar alguma coisa?",
                  a: "Não. O app é 100% gratuito, sem anúncios e sem plano premium. Todas as funcionalidades estão disponíveis para todos.",
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

        {/* ─── 9. CTA FINAL ────────────────────────────────────── */}
        <section className="bg-primary px-5 py-14 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Comece a acompanhar seus padrões hoje
            </h2>
            <p className="mt-3 text-white/80">
              Gratuito, privado e feito para o seu dia a dia.
            </p>
            <Link
              href="/cadastro"
              className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary no-underline shadow-md transition-colors hover:bg-white/90"
            >
              Criar minha conta
            </Link>
            <p className="mt-3 text-xs text-white/60">
              Leva 30&nbsp;segundos. Sem cartão de crédito.
            </p>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

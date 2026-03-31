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

function IconMood() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function IconHeart() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

/* ── mapa de calor — color helper ─────────────────────────────────── */
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
            <p className="mb-4 text-sm font-medium text-primary">
              Para pessoas com transtorno bipolar
            </p>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
              Seus dados organizados.{" "}
              <span className="text-primary">Mudanças percebidas cedo.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              Sono e sinais do corpo entram do relógio ou da pulseira inteligente. Sua rotina entra da agenda.
              Você faz um check-in rápido de humor e energia. O app cruza tudo e
              mostra sinais de estabilidade e mudanças — para que você perceba mais cedo.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/cadastro"
                className="w-full rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white no-underline shadow-md transition-all hover:bg-primary-dark hover:shadow-lg sm:w-auto"
              >
                Criar conta gratuita
              </Link>
              <Link
                href="/login"
                className="w-full rounded-xl border border-border bg-surface px-8 py-4 text-base font-semibold text-foreground no-underline transition-colors hover:bg-surface-alt sm:w-auto"
              >
                Entrar
              </Link>
            </div>

            <p className="mt-3 text-xs text-muted">
              100% gratuito · sem anúncios · sem plano premium
            </p>

            <p className="mt-8 rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-xs text-muted inline-block">
              Conteúdo educacional — não substitui avaliação profissional
            </p>
          </div>
        </section>

        {/* ─── 2. AUTOMAÇÃO — O QUE ENTRA SOZINHO ────────────── */}
        <section className="px-5 py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              A maior parte entra sozinha
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted md:text-base">
              Você não precisa preencher tudo na mão. O app importa sono, sinais do corpo,
              rotina e finanças. Manual fica só o que sensor nenhum entende: humor e energia.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Apple Health */}
              <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 shadow-md">
                  <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">Apple Health</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Sono, frequência cardíaca, variabilidade cardíaca e passos
                </p>
              </div>

              {/* Health Connect */}
              <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">Health Connect</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Galaxy Watch, Xiaomi Band, Garmin e outros
                </p>
              </div>

              {/* Google Calendar */}
              <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700">
                  <svg className="h-7 w-7" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#4285F4" strokeWidth="1.5" />
                    <path d="M3 9h18M9 3v18" stroke="#4285F4" strokeWidth="1" opacity="0.3" />
                    <rect x="11" y="11" width="4" height="4" rx="0.5" fill="#EA4335" />
                    <rect x="11" y="5" width="4" height="4" rx="0.5" fill="#4285F4" />
                    <rect x="5" y="11" width="4" height="4" rx="0.5" fill="#FBBC04" />
                    <rect x="5" y="5" width="4" height="4" rx="0.5" fill="#34A853" />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">Google Agenda</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Compromissos integrados à sua rotina
                </p>
              </div>

              {/* Financeiro */}
              <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">Controle financeiro</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Importe do Mobills ou CSV. Gastos cruzados com humor
                </p>
              </div>
            </div>

            {/* Wearables */}
            <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-5">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {[
                  "Apple Watch",
                  "Xiaomi Smart Band",
                  "Galaxy Watch",
                  "Galaxy Fit",
                  "Garmin",
                  "Amazfit",
                ].map((device) => (
                  <span key={device} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-foreground">
                    {device}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-muted">
                Funciona com qualquer relógio ou pulseira inteligente que sincronize com Apple Health ou Health Connect.
                Sem relógio? Sem problema — o app funciona com registro manual.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 3. INSIGHTS — FEATURE HERO ──────────────────────── */}
        <section className="bg-foreground/[0.03] px-5 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                Um painel de estabilidade, não um diário
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
                Quando você abre o app, vê indicadores de humor, sono e rotina
                — não uma pilha de formulários.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {/* Termômetro */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Termômetro de humor
                </p>
                <p className="mt-1 text-xs text-muted">
                  Mostra sua faixa atual em 5 zonas
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
                      Estável
                    </span>
                    <p className="mt-1 text-xs text-muted">Instabilidade: baixa</p>
                  </div>
                </div>
              </div>

              {/* Mapa de calor sono */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Mapa de calor do sono
                </p>
                <p className="mt-1 text-xs text-muted">
                  30 ou 90 noites, estilo calendário
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

              {/* Sinais de mudança */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Sinais de mudança
                </p>
                <p className="mt-1 text-xs text-muted">
                  Sua estabilidade atual e os fatores que mais pesaram
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4a7c59" strokeWidth="2.5"
                        strokeDasharray="25 75" strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-xs font-bold text-foreground">Estável</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Poucos sinais de instabilidade</p>
                    <p className="text-xs text-muted">Humor estável, sono regular</p>
                  </div>
                </div>
              </div>

              {/* Resumo com IA */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Resumo com IA sob demanda
                </p>
                <p className="mt-1 text-xs text-muted">
                  Organiza sinais em linguagem clara
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted/80">
                  &ldquo;Nas últimas duas semanas, seu humor manteve-se estável.
                  O sono apresentou leve irregularidade nas noites de quinta e sexta,
                  possivelmente associada a mudança de horário de trabalho...&rdquo;
                </p>
                <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary">
                  Não diagnostica — apenas organiza seus dados
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. COMO FUNCIONA ────────────────────────────────── */}
        <section className="bg-surface px-5 py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Como funciona na prática
            </h2>

            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">1</span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  Conecte suas fontes
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Apple Health, Health Connect, Google Agenda e, se quiser, importação financeira.
                </p>
              </div>
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">2</span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  Faça um check-in curto
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Humor e energia em cerca de 30 segundos. Só o que o relógio ou a pulseira não captam.
                </p>
              </div>
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">3</span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  Veja sinais claros
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Indicadores de estabilidade, ritmo social, resumo sob demanda com IA e acesso para seu profissional.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 5. O QUE O APP FAZ POR VOCÊ ───────────────────── */}
        <section className="px-5 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              O que o app faz por você
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: <IconMood />,
                  title: "Check-in diário",
                  desc: "Humor, energia, ansiedade, irritabilidade, sono e medicação. Tudo em menos de 30 segundos.",
                },
                {
                  icon: <IconMoon />,
                  title: "Sono e ritmo",
                  desc: "Duração, regularidade, qualidade e mapa de calor. Segundo pesquisas, alterações no sono costumam ser um dos primeiros sinais de mudança de fase.",
                },
                {
                  icon: <IconClipboard />,
                  title: "Avaliação semanal",
                  desc: "Escalas validadas usadas na prática clínica, traduzidas para linguagem acessível. Resultados que você entende.",
                },
                {
                  icon: <IconClock />,
                  title: "Ritmo social",
                  desc: "5 horários-âncora do seu dia. Baseado em protocolo de ritmos sociais — regularidade protege contra episódios.",
                },
                {
                  icon: <IconHeart />,
                  title: "Linha do tempo clínica",
                  desc: "Medicação, estressores, viagens, internações e terapia — tudo no mesmo histórico.",
                },
                {
                  icon: <IconLink />,
                  title: "Acesso profissional",
                  desc: "Compartilhe um link com PIN para seu psiquiatra ou terapeuta. Somente leitura, sem criar conta.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 6. CRISE / SOS ────────────────────────────────── */}
        <section className="bg-foreground/[0.03] px-5 py-14 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              Para os momentos difíceis
            </h2>
            <p className="mt-3 text-sm text-muted md:text-base">
              Se a coisa apertar, a ajuda aparece na frente — sem estar escondida em menu.
            </p>

            <div className="mt-10 grid gap-5 text-left sm:grid-cols-2">
              {[
                {
                  icon: <IconShield />,
                  title: "Modo crise automático",
                  desc: "Uma interface mais simples quando aparecem sinais graves. Ação direta, sem distrações.",
                },
                {
                  icon: <IconPhone />,
                  title: "Ajuda imediata",
                  desc: "CVV 188, SAMU 192 e seus contatos pessoais com um toque. Funciona sem login.",
                },
                {
                  icon: <IconClipboard />,
                  title: "Plano de crise",
                  desc: "O que fazer, quem chamar e quais passos seguir. Monte com calma, use na urgência.",
                },
                {
                  icon: <IconHeart />,
                  title: "Respiração e aterramento",
                  desc: "Exercícios guiados 4-7-8, 5-4-3-2-1 e outros para voltar ao básico.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 text-danger">
                    {item.icon}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. BASE CLÍNICA + CONFIANÇA ───────────────────── */}
        <section className="bg-surface px-5 py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Base clínica, privacidade e transparência
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted md:text-base">
              Feito para saúde mental, não para vender atenção.
            </p>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {[
                {
                  icon: <IconCheck />,
                  title: "Baseado em protocolos reais",
                  desc: "Instrumentos usados na prática clínica e validados internacionalmente para humor, depressão e funcionalidade.",
                },
                {
                  icon: <IconBrain />,
                  title: "IA responsável",
                  desc: "Resume e organiza seus dados. Não diagnostica, não prescreve, não substitui cuidado profissional.",
                },
                {
                  icon: <IconLock />,
                  title: "Privacidade real",
                  desc: "Dados criptografados, práticas alinhadas à LGPD. Não vendemos seus dados. Você pode excluir tudo quando quiser.",
                },
                {
                  icon: <IconShield />,
                  title: "100% gratuito",
                  desc: "Sem anúncios, sem plano premium, sem pegadinhas. Todas as funcionalidades para todos.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {item.icon}
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

        {/* ─── 8. FAQ ──────────────────────────────────────────── */}
        <section className="px-5 py-14 md:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
              Perguntas frequentes
            </h2>

            <div className="mt-10 flex flex-col gap-4">
              {[
                {
                  q: "O que entra automaticamente no app?",
                  a: "Sono, sinais do corpo (variabilidade cardíaca, frequência cardíaca, passos), rotina via Google Agenda e, se você quiser, dados financeiros importados do Mobills. Manual fica apenas humor e energia.",
                },
                {
                  q: "Preciso usar relógio ou pulseira para funcionar?",
                  a: "Não. Mas a experiência fica melhor com relógio ou pulseira inteligente. Sem ele, você registra o sono manualmente — o resto funciona igual.",
                },
                {
                  q: "Funciona no iPhone e no Android?",
                  a: "Sim. Disponível como app na App Store e também como site acessível em qualquer navegador.",
                },
                {
                  q: "Meu psiquiatra consegue acompanhar?",
                  a: "Sim. Você gera um link com PIN, somente leitura, sem exigir conta. Seu profissional vê termômetro, sono, avaliações e eventos clínicos.",
                },
                {
                  q: "A IA faz diagnóstico?",
                  a: "Não. Ela organiza sinais e resume seus dados em linguagem clara. Não prescreve, não sugere medicação e não substitui avaliação profissional.",
                },
                {
                  q: "Preciso de diagnóstico para usar?",
                  a: "Não. O app é útil para qualquer pessoa investigando ou já diagnosticada com transtorno bipolar.",
                },
                {
                  q: "É realmente gratuito?",
                  a: "Sim. Sem anúncios, sem plano premium, sem pegadinhas. Todas as funcionalidades estão disponíveis para todos.",
                },
                {
                  q: "Meus dados estão seguros?",
                  a: "Sim. Seus dados são criptografados e tratados conforme a LGPD. Não vendemos seus dados. Compartilhamentos só acontecem com sua autorização ou com fornecedores essenciais do serviço, conforme a Política de Privacidade. Você pode excluir tudo a qualquer momento.",
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
              Menos preenchimento. Mais clareza.
            </h2>
            <p className="mt-3 text-white/80">
              Crie sua conta, conecte seus dados e veja seu painel de estabilidade.
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

      </main>
      <Footer />
    </div>
  );
}

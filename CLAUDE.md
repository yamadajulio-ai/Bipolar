# Suporte Bipolar — Projeto

## Budget
- **Budget total: $10.000 USD** — Priorizar QUALIDADE sempre, sem economizar em soluções.

## Stack
- Next.js 15 (App Router, Server Components)
- TypeScript, Tailwind CSS v4
- Prisma + PostgreSQL (Neon)
- Recharts para gráficos
- Motion for React (v12) — BottomNav animated pill
- Lucide React (v1.7) — icon system via `AppIcon` wrapper
- clsx — conditional className composition
- Deploy: Vercel Pro ($20/mês)
- CDN/WAF: Cloudflare Pro ($20/ano, proxy ON, SSL Full strict)
- Workers: Cloudflare Workers Paid ($5/mês)
- Backup: Cloudflare R2 (bucket `suporte-bipolar-backups`)
- Email: Postmark (transactional, DKIM+Return-Path verified, remetente `contato@suportebipolar.com`)
- Integrações: Apple Health via Health Auto Export (HAE) + Cloudflare Worker proxy + `waitUntil()` background processing
- `@vercel/functions` — `waitUntil()` for deferred background work (HAE import)
- Observabilidade: Sentry (`@sentry/nextjs` v10, source maps, PII scrubbing)
- MCP Servers: Sentry + GitHub (`.mcp.json`)

## Público-alvo
- Brasileiros com transtorno bipolar
- Uso principal via iPhone (mobile-first)
- Idioma: pt-BR

## Timezone — Contrato formal
- **Timezone canônico: `America/Sao_Paulo`** — decisão de produto, não implementação.
- Todo cálculo de data (streaks, cutoffs, cron matching, insights, narrative) usa este fuso explicitamente.
- `localDateStr()` e `localToday()` (em `src/lib/dateUtils.ts`) usam `toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })`.
- `streaks.ts` usa `toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })` no `formatDate()`.
- O servidor roda em UTC (Vercel), então **nunca** usar `getFullYear()/getMonth()/getDate()` para datas user-facing.
- Se o produto expandir para fora do Brasil, este contrato deverá ser revisado para timezone per-user.

## Padrão de Qualidade
- **Meta de auditoria GPT Pro: média 9,5/10 no projeto inteiro.** Toda feature, rota, componente e teste deve atingir esse nível. Se uma auditoria retornar abaixo de 9,5, corrigir os achados até alcançar.
- **Usar TODAS as ferramentas disponíveis no mercado** para atingir 9,5. Se não existir a ferramenta certa, inventar.
- Nenhum P0 ou P1 pode ficar aberto. P2 devem ser resolvidos antes de nova feature.

## Princípios
- Baseado em protocolos IPSRT e pesquisas do PROMAN/USP
- Linguagem clínica cuidadosa — nunca fazer afirmações diagnósticas diretas
- "Não substitui avaliação profissional" em toda comunicação clínica

## Modo de Trabalho
- **Sempre começar pela ordem que faz mais sentido lógico** — não perguntar ao usuário por onde começar. Priorizar: P0 (bugs/segurança) → P1 (UX/copy críticos) → P2 (melhorias) → P3 (polimento).
- Fazer direto, não pedir permissão nem dar instruções.
- **Relatório de bug fix obrigatório**: Quando o usuário relatar um problema do site e o Claude identificar e corrigir, SEMPRE encerrar com um resumo estruturado no formato:
  1. **Problema**: o que o usuário reportou
  2. **Causa**: onde estava o erro no código (arquivo, linha, lógica errada)
  3. **Correção**: o que foi alterado e por quê
  - Um bloco por problema. Usar linguagem direta, sem enrolação.
- **Quando usar GPT Pro**: Auditorias do GPT Pro são úteis para revisão pós-implementação, mas NÃO são gate obrigatório antes de implementar. O Claude pode implementar diretamente e usar GPT Pro depois para validar qualidade.
- **Prompts de auditoria GPT Pro** (quando solicitado): Prompts DEVEM ser **self-contained** — o GPT Pro deve conseguir auditar SEM pedir mais contexto. Incluir código-fonte completo, testes, e contexto de mudanças.
- **NUNCA ignorar NADA das respostas do GPT Pro.** Quando o GPT Pro devolver uma auditoria, o Claude DEVE analisar TODOS os pontos levantados, um por um, sem pular nenhum. Cada achado, cada risco, cada sugestão — mesmo os que parecem menores ou "nice-to-have" — deve ser endereçado: ou implementado, ou justificado por que não se aplica com evidência concreta. Zero tolerância para ignorar pontos. Se o GPT Pro levantou, é porque importa. Tratar cada resposta do GPT Pro como checklist obrigatório onde TODO item precisa de resolução documentada.
- **Auto-análise crítica pós-implementação obrigatória**: Após QUALQUER implementação ou correção, o Claude DEVE fazer análise crítica exaustiva de tudo que acabou de implementar, buscando falhas, bugs, edge cases, inconsistências, problemas de segurança, acessibilidade e integração. Repetir a análise quantas vezes forem necessárias até não encontrar mais falhas. Só considerar o trabalho "feito" quando a última rodada de análise retornar zero problemas. Corrigir cada problema encontrado antes de seguir para a próxima tarefa. Isso é um gate obrigatório — não pode ser pulado.

## Clipboard (Windows)
- **NUNCA usar `type file | clip`** — corrompe caracteres UTF-8 (acentos viram lixo).
- Método correto para copiar texto UTF-8 para o clipboard:
  1. Salvar o conteúdo em arquivo `.txt` com encoding `utf-8-sig` (BOM).
  2. Usar PowerShell: `[System.IO.File]::ReadAllText("path", [System.Text.Encoding]::UTF8) | Set-Clipboard`
  3. Para verificar: usar `chcp 65001` antes de chamar PowerShell, ou setar `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` no script.

## Regras de Dados — Sono
- **Cochilo**: registro < 1h → exibido no histórico (tag "cochilo", roxo) mas **excluído** das métricas
- **Sono real**: registro >= 2h → incluído em todas as métricas (média, regularidade, variabilidade, alertas, correlações)
- **Registro incompleto**: campo `excluded: true` no SleepLog → excluído de métricas/heatmap, visível no histórico (dimmed, tag "excluído"). Toggle via `PATCH /api/sono/excluir`. Registros 1-4.5h mostram tag "incompleto?" como sugestão.
- **totalHours**: span completo bed→wake (inclui tempo acordado). **Não** subtrai awakenings.
- **awakeMinutes**: campo separado com minutos acordados durante o sono (detectados pelo wearable). Exibido no card: "Xmin acordado (relógio)".
- **Faixas de cor do histórico**: <1h roxo (cochilo) | <5h vermelho (crítico) | 5-6h âmbar (abaixo do ideal) | 6-7h neutro | >=7h verde (ideal)
- **Múltiplos ciclos/dia**: SleepLog usa `@@unique([userId, date, bedtime])` — permite múltiplos registros por dia. UI agrupa por data com somatório e exibe cada ciclo individualmente ("Ciclo 1, 2..."). Métricas usam `aggregateSleepByDay()` para somar ciclos antes de calcular médias.
- Todos os registros aparecem no histórico para revisão clínica
- Histórico configurável pelo usuário: 7, 15, 30 noites ou 3 meses (via `?noites=N`)

## Design System — Phase 1 (Foundation + Chrome)
- **Tokens CSS** em `globals.css`: elevation (shadow-card/raised/float), radius (card 18px, panel 24px, pill 999px), surfaces (surface/raised/glass), borders (soft 10%/strong 20%), blur-chrome 18px, halo, halo-stroke
- **Semantic status tokens**: success/warning/danger/info com `-bg-subtle`, `-fg`, `-border` (light+dark+print)
- **on-* tokens**: text colors for solid semantic backgrounds (on-danger, on-success, on-warning, on-info, on-primary)
- **Control border tokens**: `--control-border`, `--control-border-hover`, `--control-border-focus`, `--control-border-danger`
- **Phase 2 foundation tokens**: typography scale (6 sizes), z-index scale (7 layers), motion (3 durations + 4 easings), chart palette (6 series)
- **4 camadas de elevação**: Canvas (background) → Surface (cards) → Raised (glaze overlay) → Float (backdrop-blur nav/header, shadow-float)
- **Card.tsx**: 4 variantes (surface, raised, hero, interactive) com GlazeOverlay + focus-visible lift
- **BottomNav**: floating dock com glassmorphism + `motion.span layoutId="nav-pill"` + `MotionConfig reducedMotion="user"` + `contain:layout_style_paint` + WCAG AA contrast (text-muted inativo, text-primary-dark ativo, 12px labels) + `print:hidden`
- **Header**: glassmorphism chrome + shadow-float + contain hint + `pt-[env(safe-area-inset-top)]` (notch/Dynamic Island), Lucide icons (Sun/MoonStar/LogOut/ShieldAlert), touch targets 44px, `print:hidden`
- **AppIcon**: wrapper padronizado para Lucide icons (sm 16px, md 20px, lg 24px)
- **Regra de radius**: `--radius-card` (18px) para containers/cards, `rounded-lg` (8px) para botões pequenos/interativos, `rounded-md` (6px) para inputs. Zero `rounded-2xl` hardcoded. **Nota**: `@theme inline` NÃO suporta `var()` self-references — usar `rounded-[var(--radius-card)]` diretamente.
- **Dark mode**: 100% tokenizado no app autenticado. Zero `dark:*-gray` hardcoded.
- **Print**: `print:hidden` em Header, Footer, BottomNav, SOSButton, InstallBanner, Alert. Shadows → none, surfaces → white, cores → preto.
- **Acessibilidade**: touch targets ≥44px (96 instâncias em 31 arquivos), aria-hidden em decorativos, prefers-reduced-motion, prefers-reduced-transparency fallback, aria-labelledby linkage correto
- **iOS input zoom**: global CSS `font-size: 16px` em inputs/textarea/select no mobile + FormField `text-base`
- **WCAG AA contraste**: 17 pares críticos verificados matematicamente (sRGB linearization). Todos PASS. Valores-chave: `--muted` light `#587369` (4.52:1+), `--danger` dark `#c05046` (4.69:1), `--on-primary` dark `#ffffff` (4.81:1)
- **CoachMarks**: focus trap + Escape dismiss + auto-focus (WCAG modal compliance)
- **Recharts**: todas as 11 instâncias lazy-loaded via `dynamic(() => import(...), { ssr: false })` com skeleton loaders (~400KB bundle reduction)
- **Landing pages públicas**: ainda Phase 1 legacy (deferred para Phase 2/3)

## iOS App Store — Estratégia B+
- **Abordagem**: Capacitor 8 com WebView + Vercel backend + pilares nativos reais
- **GPT Pro audit scores**: R1 4.5 → R2 7.4 → R3 8.2/10
- **Pilares nativos**: Face ID/Keychain, APNs + Local Notifications, offline de crise, deep links + share, Sign in with Apple (nonce + refresh token criptografado)
- **server.url**: GPT Pro R3 recomenda remover para release (shell local + API remota). Capacitor docs: `server.url` é para dev, não produção. **BLOQUEADOR de submissão.**
- **Conta Apple Developer**: individual (Julio Cesar de Sousa Yamada), Enrollment ID 5J4DNRWRS2. GPT Pro R3 alerta: Guideline 5.1.1(ix) exige legal entity para apps de saúde com dados sensíveis. **Considerar migração para organização.**
- **Mac Mini M4**: configurado (Node.js, VS Code, Claude Code). Setup script: `scripts/ios-setup.sh`. Guia enviado por email (2026-03-28).
- **Review risks**: Guideline 4.2 (mitigado por 9 pilares nativos), 1.4.1 (copy de suporte), 5.1.1(ix) (conta individual), demo account
- **Review Notes**: `docs/app-store-review-notes.md`
- **Sign in with Apple**: nativo (Capacitor plugin) + **web OAuth** (form_post callback). Service ID `com.suportebipolar.web`, App ID `com.suportebipolar.app`. Dual audience JWT verification, sameSite:none state cookie, nonce replay protection, refresh token AES-256-GCM, revogação na exclusão de conta
- **Privacy**: trackers bloqueados no WebView (`"Capacitor" in window`), privacyMode default ON, PrivacyInfo.xcprivacy, notificações genéricas no lock screen
- **App Store code readiness audit (2026-03-28)**: 8.7/10 CODE READY. 9 native pillars pass Guideline 4.2. Security 9.75/10. Clinical safety 9.9/10. Performance improved (recharts lazy-load).
- **Pendentes para TestFlight** (requer Mac Mini): `npx cap add ios`, PrivacyInfo.xcprivacy, substituir TEAM_ID `7MQYXX5DRU` no AASA, configurar entitlements no Xcode, testar plugin Apple v7/Cap v8 em device real

## AI Narrative — Modelo
- **Modelo atual**: GPT-5.4 via OpenAI Responses API (migrado de Claude Sonnet 4)
- **Structured Outputs**: JSON Schema nativo + Zod pós-parse + forbidden patterns (17 regras)
- **High-risk (v2.1)**: riskLevel "atencao_alta" → LLM com safety prefix extra + template como fallback se guardrails falharem
- **store: false** (LGPD: sem persistência na OpenAI)
- **Env var**: `OPENAI_NARRATIVE_MODEL` (default: gpt-5.4, permite canário com gpt-5.2)

## Domínios
- **Produção**: suportebipolar.com (Vercel Pro + Cloudflare Pro, proxy ON, SSL Full strict)
- **Legacy**: redebipolar.com (ainda ativo)
- **HAE Worker**: hae-proxy on Cloudflare Workers Paid → suportebipolar.com/api/integrations/health-export (POST responds instantly via `waitUntil()`, heavy DB ops run in background)
- **Backups**: Cloudflare R2 bucket `suporte-bipolar-backups` (ENAM, Standard)
- **Email**: Postmark (Server ID 18583576, DKIM verified, Return-Path verified). Password reset via `src/lib/email.ts`. 100 emails/mês (Free tier).
- **Neon DB**: sa-east-1 (São Paulo), PostgreSQL 17.8, 51 tabelas, pooler endpoint. PITR 7d. Restore drill: `scripts/restore-drill.mjs` (11 checks PASS). Backup script: `scripts/backup-db.sh` (pg_dump → R2).

## Insights — Arquitetura
- Página: `src/app/(app)/insights/page.tsx` (Server Component)
- Motor de cálculo: `src/lib/insights/computeInsights.ts`
- Gráfico: `src/components/planner/InsightsCharts.tsx` (Client Component)
- Seletor de período: `src/components/insights/NightHistorySelector.tsx` (Client Component)
- Dados buscados: 90 dias de sono (histórico), 30 dias de humor/planner (insights)
- Timezone: America/Sao_Paulo
- Mixed state risk boost: forte +3, provável +2 no risk score (ISBD: maior risco suicida)
- **Rotina/Ritmo removido** — feature descontinuada, DailyRhythm não é mais utilizado nos cálculos
- **Stability Score**: pesos 35/30/20/15 (sono/medicação/humor/estabilidade)
- **Sleep composite**: regularidade 30%, duração 30%, qualidade 25%, HRV 15% (sub-pesos redistribuídos se dado ausente)

## Security — Arquitetura
- **CSRF**: 2 camadas — Sec-Fetch-Site/Origin (middleware) + double-submit cookie (`__Host-csrf` + `X-CSRF-Token` header via `CsrfProvider` global interceptor). `checkCsrf()` corretamente `await`-ed no middleware (P0 fix 2026-03-28). 4 pontos de rejeição com `console.warn("[CSRF]")` structured logging.
- **CSP**: enforced (não report-only) — `Content-Security-Policy` no `next.config.ts`
- **Permissions-Policy**: `camera=(), geolocation=()` — microphone liberado (necessário para SOS voice mode)
- **Step-up auth**: ações sensíveis (delete account, export) exigem re-confirmação de senha (email users) ou sessão recente <5min (Google/Apple OAuth)
- **Session**: idle 7d + absolute 30d + sliding refresh 1h, iron-session encrypted, `Clear-Site-Data` no logout, session rotation no login (anti-fixation)
- **Rate limiting**: DB-backed atômico (`$transaction`), per-endpoint, windowMs em milissegundos (não segundos). **100% de rotas com rate limit** (cobertura completa após hardening 2026-03-28). Integration GET endpoints: 30 req/min per API key.
- **LGPD Consent Gates**: todas as rotas de escrita E leitura de dados de saúde verificam consent ativo (`health_data` ou `journal_data`). 13+ endpoints protegidos incl. integration GET/POST. Integration endpoints usam `integration.userId` (key owner). Ordem padrão: auth → rate limit → consent → body parse.
- **getClientIp()**: utility padronizada (`cf-connecting-ip` → `x-forwarded-for[0]` → `x-real-ip` → `"unknown"`). Todas as rotas usam — zero raw `x-forwarded-for` parsing.
- **Password reset tokens**: SHA-256 hash no DB, raw token só no e-mail. Orphan cleanup on account deletion (keyed by email, not userId — sem FK cascade). Cron purge tokens >7 dias (used/expired).
- **Password hashing**: argon2id padrão. bcrypt→argon2id transparent rehash on successful login (auto-upgrade legado, non-blocking com Sentry fallback).
- **Anti-enumeration**: cadastro returns identical 201 for duplicate emails; forgot-password returns 200 mesmo se sendEmail falhar (try/catch com Sentry); timing equalized (argon2 always runs).
- **SESSION_SECRET**: min 32 chars + entropy check (min 8 unique chars) enforced em `getCsrfKey()`.
- **OAuth refresh tokens**: AES-256-GCM (Google + Apple), revogação na exclusão de conta
- **Apple Sign-In**: nonce replay protection (NonceMismatchError propaga imediatamente fora do key rotation loop)
- **Cron purge**: `$transaction` atômico para AccessLog (90d) + RateLimit (expired) + PasswordResetToken (7d)
- **Sentry**: `@sentry/nextjs` v10.42, `instrumentation.ts` (server+edge), `global-error.tsx`, source maps via `SENTRY_AUTH_TOKEN`, org `yamada-ai` / project `rede-bipolar`. PII: replays OFF, request data filtered, URL redaction, breadcrumb whitelist, exception message scrubbing (Prisma/PHI)
- **Error messages**: 100% pt-BR em todas as rotas (zero English leaking)

## SafetyNudge — Arquitetura
- Componente: `src/components/insights/SafetyNudge.tsx`
- Triggers: PHQ-9 item 9 ≥ 1, riskLevel `atencao_alta`, mixed state (forte/provável), ≥3 noites curtas, ≥2 mania signs
- 3 níveis: `emergencia` (SAMU 192), `atencao` (CVV 188), `cuidado` (CAPS/UBS)
- Rota sem profissional: orientação CAPS/UBS/UPA em todos os níveis
- Crisis mode no /hoje: UI simplificada para emergencia + mixed forte

## Avaliação Semanal — Arquitetura
- Página: `src/app/(app)/avaliacao-semanal/page.tsx` (Client Component, wizard 4 etapas)
- API: `src/app/api/avaliacao-semanal/route.ts` (GET histórico + POST upsert)
- Escalas: ASRM (mania, 5 itens 0-4, total 0-20), PHQ-9 (depressão, 9 itens 0-3, total 0-27), FAST Short (funcionamento, 6 domínios 1-5)
- Constantes: `src/lib/constants.ts` (ASRM_ITEMS, PHQ9_ITEMS, PHQ9_FREQUENCY_OPTIONS, FAST_SHORT_ITEMS)
- **1 registro por semana** (unique: userId + date domingo), upsert sobrescreve se mesmo domingo
- **Proteção de sobrescrita**: ao abrir a página, verifica se já existe avaliação da semana → mostra alerta com opções "Editar respostas anteriores" (pré-preenche) ou "Começar do zero"
- Limiares clínicos: ASRM ≥ 6 (possível hipomania), PHQ-9 ≥ 10 (moderado), PHQ-9 Item 9 ≥ 1 (SafetyNudge)
- PHQ-9 Item 9 isolado no campo `phq9Item9` para safety checks
- Consent gate: scope `assessments` ou legacy `health_data`
- Rate limit: 60 reads/60s, 30 writes/60s por user
- Usado em: AI Narrative (últimas 2), Dashboard Profissional (últimas 12), Relatório Mensal (médias), Export Clínico (completo)

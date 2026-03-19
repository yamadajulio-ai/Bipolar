# Suporte Bipolar — Relatório Completo para Auditoria GPT PRO

> Atualizado em: 19/03/2026
> Domínio: https://suportebipolar.com (produção) | https://redebipolar.com (legacy)

---

## 1. Visão Geral

**Nome:** Suporte Bipolar (rebrand de "Rede Bipolar" em 13/03/2026)
**URL Produção:** https://suportebipolar.com
**URL Legacy:** https://redebipolar.com
**Repositório:** github.com/yamadajulio-ai/Bipolar
**Público-alvo:** Brasileiros com transtorno bipolar (mobile-first, iPhone)
**Idioma:** pt-BR
**Princípios:** IPSRT, PROMAN/USP, linguagem clínica cuidadosa
**Budget:** $10.000 USD — prioridade máxima em qualidade

## 2. Stack Técnica

| Tecnologia | Versão |
|-----------|--------|
| Next.js | 15 (App Router, Server Components) |
| React | 19 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| Prisma + PostgreSQL | Neon (^6.19.2) |
| Recharts | ^3.7.0 |
| Sentry | ^10.42.0 |
| iron-session | ^8.0.4 |
| bcryptjs | ^3.0.3 |
| Zod | ^4.3.6 |
| OpenAI SDK | ^5 (Responses API, Structured Outputs) |
| web-push | ^3 (VAPID, Web Push API) |
| Vitest | ^4.0.18 (704 testes, 8 suites) |
| Deploy | Vercel (auto-deploy on push to main) |
| DNS/CDN | Cloudflare (proxy OFF, DNS only) |
| Package Manager | pnpm |

## 3. Paleta de Cores (CSS Variables)

```css
--background: #f4f1ec;    /* creme suave */
--foreground: #2d3b36;    /* verde escuro */
--primary: #527a6e;       /* teal */
--primary-light: #7da399; /* teal claro */
--primary-dark: #3d5c52;  /* teal escuro */
--surface: #ffffff;       /* branco */
--surface-alt: #ecf1ee;   /* cinza-verde */
--border: #d6deda;        /* borda suave */
--muted: #5f7a70;         /* texto secundário */
--success: #4a7c59;       /* verde sucesso */
--warning: #c4842d;       /* laranja alerta */
--danger: #b53325;        /* vermelho perigo */
--info: #527a6e;          /* teal info */
```

## 4. Estrutura de Páginas (46 rotas)

### Páginas Públicas (4)
| Rota | Descrição |
|------|-----------|
| `/` | Landing page com hero, features e CTAs |
| `/escolher-visual` | Seletor de tema visual |
| `/termos` | Termos de uso |
| `/privacidade` | Política de privacidade (LGPD) |

### Autenticação (2)
| Rota | Descrição |
|------|-----------|
| `/login` | Login email/senha + Google OAuth |
| `/cadastro` | Registro com age gate 18+ e consent LGPD |

### Dashboard & Navegação (3)
| Rota | Descrição |
|------|-----------|
| `/hoje` | Dashboard: status do dia, ações rápidas (check-in/sono), resumo (humor/energia/medicação/streak), dados do corpo (passos/HRV/FC 7d), próximas atividades, alertas contextuais, notícias (PubMed + Google News), gráfico 7d, card integrações pendentes |
| `/mais` | Hub de navegação — 5 seções: Registros, Avaliações, Bem-estar, Aprendizado, Configurações |
| `/offline` | Fallback offline com CVV 188 |

### Registros Diários (7)
| Rota | Descrição |
|------|-----------|
| `/checkin` | Check-in rápido (humor 1-5, energia, ansiedade, irritabilidade, sono, medicação "Já tomei"/"Não tomei"/"Ainda não", 15 sinais de alerta ISBD/STEP-BD) |
| `/diario` | Histórico do diário de humor |
| `/diario/novo` | Novo registro de diário |
| `/sono` | Histórico de sono |
| `/sono/novo` | Novo registro de sono (hora dormir/acordar, qualidade 0-100, rotina pré-sono) |
| `/rotina` | Histórico de âncoras diárias |
| `/rotina/novo` | Registro de âncoras IPSRT (acordar, 1º contato, atividade principal, jantar, dormir) |

### Tendências & Insights (6)
| Rota | Descrição |
|------|-----------|
| `/diario/tendencias` | Gráficos de humor/sono, distribuição, alertas |
| `/sono/tendencias` | Análise de sono (média, qualidade, variância) |
| `/rotina/tendencias` | Regularidade de ritmo (SRM-like) |
| `/insights` | **Painel principal:** Termômetro Humor (M/D dual-score EWMA), Social Jet Lag, SRM Window Score, Ciclagem Rápida (DSM-5), Predição de Episódio, Heatmap 90d, Warning Signs, Histórico de sono (7/15/30/90 noites) com exclusão de registros incompletos |
| `/circadiano` | Análise circadiana (cronótipo, midpoint, dark therapy) |
| `/cognitivo` | Microtarefas cognitivas (tempo de reação, digit span) |

### Avaliações Clínicas (4)
| Rota | Descrição |
|------|-----------|
| `/avaliacao-semanal` | Wizard 4 steps: ASRM (5 items, 0-4) + PHQ-9 (9 items, item 9 safety flow) + FAST short (6 domínios) |
| `/life-chart` | Eventos significativos NIMH (7 tipos: med_change, stressor, travel, hospitalization, therapy, menstrual, other) |
| `/funcionamento` | FAST short (6 domínios, 1-5) |
| `/relatorio` | Relatório mensal: ASRM/PHQ-9/FAST médias + eventos significativos + tendências |

### Bem-estar (4)
| Rota | Descrição |
|------|-----------|
| `/exercicios` | Lista de exercícios |
| `/exercicios/respiracao/[tipo]` | Respiração guiada (4-7-8, box, diafragmática) |
| `/exercicios/aterramento/[tipo]` | Aterramento guiado (5 sentidos, body scan muscular) |
| `/sons` | Player de sons ambiente |

### Emergência (3)
| Rota | Descrição |
|------|-----------|
| `/sos` | SOS: respiração rápida, grounding guiado, contatos de crise, CVV 188/192, logging de ações |
| `/plano-de-crise` | Visualizar plano de crise |
| `/plano-de-crise/editar` | Editar plano de crise (contatos, medicações, hospital, coping) |

### Planejamento (1)
| Rota | Descrição |
|------|-----------|
| `/planejador` | Calendário semanal IPSRT: blocos ANCHOR/FLEX/RISK, energia (0-10), estimulação (LOW/MED/HIGH), recorrência, exceções, sync Google Calendar bidirecional |

### Educação (5)
| Rota | Descrição |
|------|-----------|
| `/conteudos` | Biblioteca de artigos educacionais |
| `/conteudos/[slug]` | Artigo individual |
| `/cursos` | Cursos estruturados com progresso |
| `/cursos/[cursoSlug]` | Overview do curso |
| `/cursos/[cursoSlug]/[aulaSlug]` | Aula individual |

### Financeiro (1)
| Rota | Descrição |
|------|-----------|
| `/financeiro` | Tracking financeiro: manual + import Mobills CSV/XLSX, categorias fixed/variable, anomalias (spending_spike, frequency_spike, sustained_increase), correlação humor-gasto Spearman, transações noturnas, 12 meses histórico, feedback de alertas |

### Configurações & Perfil (6)
| Rota | Descrição |
|------|-----------|
| `/conta` | Conta (LGPD: export JSON, deletar conta) |
| `/conta/lembretes` | Lembretes configuráveis (acordar, sono, diário, respiração) |
| `/perfil` | Perfil socioeconômico (5 perguntas → recomendações CAPS/SUS/CRAS) |
| `/integracoes` | Google Calendar + Apple Health (HAE) + Mobills |
| `/acesso-profissional` | Gerar/revogar token+PIN para profissional |
| `/noticias` | Feed de notícias científicas (PubMed + Google News) |

### Admin (6)
| Rota | Descrição |
|------|-----------|
| `/admin` | Admin dashboard (métricas, overview) |
| `/admin/users` | Gestão de usuários |
| `/admin/clinical` | Dados clínicos |
| `/admin/compliance` | LGPD compliance |
| `/admin/safety` | Safety monitoring |
| `/admin/audit` | Audit trail |

### Outras (3)
| Rota | Descrição |
|------|-----------|
| `/familias` | Guia para famílias/cuidadores |
| `/como-usar` | Tutorial de uso |
| `/profissional/[token]` | Dashboard read-only para profissional (dados brutos + insights + SOS + weekly assessments + life chart + functioning) |

## 5. APIs (50+ endpoints)

### Autenticação (10)
- `POST /api/auth/login` — Login com rate limiting
- `POST /api/auth/cadastro` — Registro com age gate + consent
- `POST /api/auth/logout` — Logout + session destroy
- `POST /api/auth/google-login` — Login via Google
- `GET /api/auth/google-login/callback` — Callback login Google
- `POST /api/auth/google/route` — Refresh token Google
- `GET /api/auth/google/callback` — Callback Google Calendar OAuth
- `POST /api/auth/google/disconnect` — Desconectar Google
- `GET /api/auth/export` — Export LGPD (JSON completo)
- `POST /api/auth/excluir-conta` — Deletar conta (cascade + session destroy)

### Dados de Saúde (14)
- `GET/POST /api/diario` — CRUD diário de humor
- `GET/POST /api/diario/tendencias` — Tendências do diário
- `GET/POST /api/sono` — CRUD sono (suporta ?days=N, default 90)
- `PATCH /api/sono/excluir` — Toggle excluded flag em SleepLog
- `GET/POST /api/sono/tendencias` — Tendências de sono
- `GET/POST /api/rotina` — Ritmo circadiano
- `GET/POST /api/rotina/tendencias` — Regularidade de ritmo
- `POST /api/sos` — Eventos SOS (opened, called_188, called_192, called_contact, breathing, grounding)
- `GET/POST /api/avaliacao-semanal` — ASRM + PHQ-9 + FAST
- `GET/POST /api/life-chart` — Life Chart events
- `DELETE /api/life-chart/[id]` — Deletar evento
- `GET/POST /api/funcionamento` — FAST (6 domínios)
- `POST /api/exercicios` — Log sessão exercício

### Planejamento (6)
- `GET/POST /api/planner/blocks` — Blocos do planejador (com expansão recorrência)
- `GET/PATCH/DELETE /api/planner/blocks/[id]` — CRUD bloco
- `POST/GET/PATCH/DELETE /api/planner/blocks/[id]/exceptions` — Exceções recorrência
- `GET/POST /api/planner/rules` — Regras IPSRT

### Integrações (6)
- `POST/GET /api/google/sync` — Sync Google Calendar (incremental syncToken + full ?full=1)
- `POST /api/integrations/health-export` — Webhook HAE (Apple Health via Cloudflare Worker)
- `POST /api/integrations/health-export/import` — Import manual
- `GET /api/integrations/health-export/status` — Status importações
- `GET/POST /api/integrations/settings` — Config integrações

### Financeiro (7)
- `GET/POST /api/financeiro` — Transações
- `GET/PATCH/DELETE /api/financeiro/[id]` — CRUD transação
- `GET /api/financeiro/resumo` — Analytics (median+MAD, anomalias, correlação humor-gasto Spearman, sustained increase)
- `GET /api/financeiro/range` — Range por data
- `GET /api/financeiro/historico` — 12 meses
- `POST /api/financeiro/import` — Bulk import CSV/XLSX (batch 50)
- `POST /api/financeiro/feedback` — Feedback de alertas (idempotente)

### Outros (7+)
- `GET/POST /api/lembretes` — Lembretes
- `GET/POST /api/plano-de-crise` — Plano de crise
- `GET /api/cursos/aula` — Conteúdo de aula
- `POST /api/cursos/progresso` — Progresso de cursos
- `GET/POST /api/perfil-socioeconomico` — Perfil socioeconômico
- `POST /api/acesso-profissional` — Gerar acesso profissional
- `GET /api/acesso-profissional/[token]` — Dados do paciente (read-only)
- `DELETE /api/acesso-profissional/[token]` — Revogar acesso
- `GET /api/noticias` — Notícias (PubMed + Google News)
- `GET /api/insights-summary` — Resumo para dashboard
- `GET /api/relatorio` — Relatório mensal
- `POST /api/cron/purge-access-logs` — Purge LGPD (90d, Vercel Cron 03:00 UTC)
- `GET /api/cron/send-reminders` — Web Push reminders (Vercel Cron every minute, idempotent, batched)
- `POST /api/push-subscriptions` — Subscribe push (SSRF allowlist, atomic $transaction, cap 5/user)
- `DELETE /api/push-subscriptions` — Unsubscribe push
- `POST /api/insights-narrative` — AI narrative (OpenAI Responses API, rate limit 10/hour)
- `POST /api/whatsapp/webhook` — WhatsApp Cloud API webhook (HMAC-SHA256, masked phone logging)
- `GET /api/whatsapp/webhook` — WhatsApp verification challenge (Meta hub.challenge)
- `GET /api/sos/chat` — SOS chatbot with crisis detection (423 test cases)
- `POST /api/integrations/health-connect` — Android Health Connect webhook

## 6. Banco de Dados (21 modelos Prisma)

| Modelo | Propósito |
|--------|-----------|
| User | Usuários (email, senha, Google OAuth, googleSub) |
| DiaryEntry | Diário de humor (mood 1-5, energia 1-5, ansiedade 1-5, irritability 1-5, medicação, sinais de alerta JSON, note) |
| SleepLog | Registros de sono (date, bedtime/wakeTime HH:MM, totalHours, quality 0-100, awakenings, hrv ms, heartRate bpm, **excluded bool**, preRoutine JSON, notes) |
| DailyRhythm | Âncoras IPSRT (5 âncoras diárias: wakeTime, firstContact, mainActivityStart, dinnerTime, bedtime) |
| ExerciseSession | Sessões de exercício (tipo, duração) |
| CrisisPlan | Plano de crise (trustedContacts JSON, professionalName/Phone, medications JSON, preferredHospital, copingStrategies JSON) |
| PlannerBlock | Blocos do planejador (title, category 8 tipos, kind ANCHOR/FLEX/RISK, energyCost 0-10, stimulation LOW/MED/HIGH, googleEventId, googleColor, sourceType app/google) |
| PlannerRecurrence | Recorrência (freq NONE/DAILY/WEEKLY, interval, weekDays, until) |
| PlannerException | Exceções de recorrência (isCancelled, overrides) |
| StabilityRule | Regras IPSRT (lateEventCutoffMin, windDownMin, minBufferBeforeSleep, maxLateNightsPerWeek, targetSleepTimeMin, targetWakeTimeMin) |
| GoogleAccount | Tokens Google (AES-256-GCM encrypted, syncToken, lastSyncAt) |
| IntegrationKey | Chaves HAE (apiKey unique, lastPayloadDebug) |
| HealthMetric | Métricas importadas (steps, active_calories, blood_oxygen) |
| NewsArticle | Cache de notícias (PubMed, Google News) |
| RateLimit | Rate limiting atômico ($transaction) |
| ProfessionalAccess | Acesso profissional (token unique, pinHash bcrypt, failedPinAttempts, lockedUntil, shareSosEvents) |
| AccessLog | Audit trail profissional (pin_validated, data_viewed, pin_failed, locked) |
| SocioeconomicProfile | Perfil socioeconômico (careAccess, medicationSource, consultFrequency, hasEmergencyContact, livingSituation) |
| SOSEvent | Eventos SOS (action: opened/called_188/called_192/called_contact/breathing/grounding) |
| FinancialTransaction | Transações (amount, category, account, occurredAt DateTime, source manual/mobills_csv) |
| AlertFeedback | Feedback alertas financeiros (@@unique userId+alertType+alertDate) |
| Consent | LGPD (scope: health_data/terms_of_use, ipAddress masked) |
| WeeklyAssessment | ASRM (5 items, total 0-20) + PHQ-9 (9 items, total 0-27, item9 separado) + FAST short (6 domains, avg) |
| LifeChartEvent | NIMH Life Chart (7 tipos: med_change, stressor, travel, hospitalization, therapy, menstrual, other) |
| FunctioningAssessment | FAST short (work, social, selfcare, finances, cognition, leisure, 1-5 each) |
| ReminderSettings | Lembretes (wakeReminder, sleepReminder, diaryReminder, breathingReminder HH:MM, enabled) |
| ContentView | Views de conteúdo (slug, viewedAt) |
| CourseProgress | Progresso de cursos (courseSlug, lessonSlug, completedAt) |
| PushSubscription | Web Push (endpoint, p256dh, auth, userId. @@unique userId_endpoint) |

## 7. Componentes (56+ componentes)

### Core UI
Card, FormField, Alert, ScaleSelector, Header, Footer, BottomNav, Greeting, ServiceWorkerRegister, InstallBanner, DeleteAccountButton

### Dashboard
TodayStatus, QuickActions, ContextualSuggestions, DashboardChartWrapper, MiniTrendChart

### Gráficos
PeriodSelector, RhythmChart, SleepChart, MoodDistribution, MoodSleepChart, FinanceCharts (CategoryChart, MoodSpendingChart, YearlyComparisonChart)

### Insights (Motor Analítico)
NightHistorySelector, SleepHistoryCard, MetricLabel, SafetyNudge, Sparkline, MoodThermometer, EpisodePrediction, InfoTooltip, CalendarHeatmap, CyclingAnalysis

### Exercícios & SOS
BreathingTimer, BreathingCircle, ProgressSteps, GroundingGuide, QuickBreathing

### Planejador
TodayBlocks, WeeklyView, InsightsCharts, GoogleCalendarSync

### Gamification
AchievementGrid (9 achievements, progress bars, hide/show toggle)

### AI Narrative
NarrativeSection (on-demand generation, exponential backoff, inline error recovery)

### Relatório & Outros
MonthSelector, MonthlyReport, SoundPlayer, ImportCSV, TransactionList, NewsFeed, RhythmForm, SleepRoutineChecklist, WarningSignsChecklist, CrisisPlanForm, CrisisPlanCard, ReminderManager, RegularityMeter

## 8. Motor de Insights (computeInsights.ts ~1800 linhas, 40 testes + 127 narrative guardrail testes)

Features calculadas server-side:
- **Termômetro de Humor:** Dual-score M/D (0-100), EWMA α=0.4, 5 zonas (depressão severa/leve/eutimia/hipomania/mania), flag misto (forte/provável), instabilidade, ansiedade como sinal de distress
- **Social Jet Lag:** Weekday vs weekend sleep midpoint difference (threshold 83min)
- **SRM Window Score:** ±45min regularity (inspirado no Social Rhythm Metric)
- **Ciclagem Rápida:** Detecção DSM-5 (≥4 episódios/ano)
- **Predição de Episódio:** Risk scoring mania/depressão (0-100) com sinais, clamped defensivo
- **Heatmap 90d:** Humor, sono, energia com cores contextuais, keyboard nav, timezone-safe
- **15 Warning Signs:** ISBD/STEP-BD (currentStreak para ativos, longestStreak para histórico)
- **Correlações:** Spearman (Pearson on ranks, correto com empates), strength labels
- **Data Confidence:** Badges baseados em quantidade de dados
- **Circadian Analysis:** Chronotype estimation (regex + bounds check)
- **Medication Response Rate:** Denominador = 30 dias
- **Normalize Bedtime:** Cutoff 720min (12:00)

## 9. Segurança & LGPD

### Autenticação & Defesa
- iron-session + bcryptjs + Google OAuth
- CSRF: Sec-Fetch-Site + Origin no middleware (exceções: cron, integrations, profissional, whatsapp)
- Rate Limiting: Atômico via Prisma $transaction (push 10/15min, narrative 10/hour, cron idempotent)
- Google Tokens: AES-256-GCM encryption (src/lib/crypto.ts)
- PIN profissional: bcrypt hash, failed attempts lock, token expiry
- Push SSRF Prevention: dual allowlist (write-time Zod refine + send-time validation), 7 known push hosts
- WhatsApp: HMAC-SHA256 signature verification (X-Hub-Signature-256), 256KB payload limit, masked phone logging
- AI Safety: 17 forbidden clinical pattern regexes, high-risk template bypass, Zod + size guards

### LGPD Compliance
- **Consentimento:** Modelo Consent (health_data, terms_of_use), age gate 18+, health consent checkbox no cadastro
- **Export:** GET /api/auth/export (JSON completo de todos os dados)
- **Exclusão:** DELETE cascade + session destroy, DeleteAccountButton com confirmação + cache purge
- **IP Masking:** IPv4 /24 + IPv6 /64 + fallback [masked] via maskIp()
- **Purge:** Cron 90d access logs (fail-closed: !process.env.CRON_SECRET), resposta genérica { ok: true }

### Sentry Error Tracking
- PII scrubbing: scrubUrl(), scrubSpanData(), beforeBreadcrumb em 3 configs
- Header whitelist: content-type, user-agent, accept only
- Request body/query/cookies: filtered
- Error boundaries: error.tsx, global-error.tsx

## 10. PWA

- Service Worker v3: 3 caches (static cache-first, API network-first for PHI safety, offline pre-cache)
- APIs network-first: /api/diario, /api/sono, /api/rotina, /api/insights-summary, /api/lembretes, /api/avaliacao-semanal, /api/planner/blocks, /api/financeiro/historico
- Admin pages: never cached, never served offline (LGPD/PHI)
- SW auto-purge on 401/403 (session expiry → purge all cached PHI)
- Web Push: push event handler + notificationclick with vibration, tag-based dedup
- Manifest: icons (512, 192, maskable separados), shortcuts (Check-in, SOS), categories, id
- InstallBanner: banner educacional iOS Safari (após 2ª visita, dismissível 30d)
- Offline page: SVG acessível, CVV 188

## 11. Integrações

| Integração | Status | Detalhes |
|-----------|--------|----------|
| Apple Health (HAE) | ✅ Funcional | Cloudflare Worker proxy → webhook Vercel, sleep stages (Core/Deep/REM/Awake), HR, HRV, steps, calories, blood_oxygen. Timezone-safe (America/Sao_Paulo). Night splitting (60min awake gap). Nap detection (<1h). Batch upserts ($transaction). maxDuration=60. |
| Health Connect (Android) | ✅ Funcional | HC Webhook → API. Sleep, steps, HR data from Android wearables. |
| Google Calendar | ✅ Funcional | OAuth, incremental sync (syncToken), full sync (?full=1), color mapping 1-24, auto-sync ao abrir + cada 5min |
| Mobills (Financeiro) | ✅ Funcional | Import CSV/XLSX, batch 50, maxDuration=30 |
| WhatsApp Cloud API | 🟡 Ready | Webhook (HMAC-SHA256, masked phone, all entries/changes). Full check-in flow pending Meta Business setup. |
| OpenAI Responses API | ✅ Funcional | AI narrative in /insights. GPT-4.1 default (configurable via env). Structured Outputs (strict: true), store: false (LGPD), 17 forbidden clinical patterns, high-risk template bypass. |
| Web Push (VAPID) | ✅ Funcional | Cron every-minute reminders, SSRF allowlist (7 hosts), batch 10 concurrent, expired/invalid cleanup. |

## 12. Acessibilidade (A11y)

- `:focus-visible` global em globals.css
- Skip-to-content link no app layout (#main-content)
- ScaleSelector: `role="group"` + `aria-labelledby` + `aria-pressed`
- `--muted` contraste AA (~5.2:1 ratio)
- Header: `aria-expanded`, `aria-controls`, `aria-label` nav landmarks, `aria-current="page"`
- CalendarHeatmap: keyboard nav, aria-label legend descritivo
- AchievementGrid: `section` landmark, `role="progressbar"` + `aria-valuenow/valuemin/valuemax/label`
- NarrativeSection: `aria-expanded` collapse toggle
- InfoTooltip: `role="tooltip"` + `aria-expanded` + `aria-describedby` com useId
- SOS: `aria-live="assertive"` para mudanças de view
- BreathingCircle: `prefers-reduced-motion` desativa animação
- Avaliação semanal: progress bar `role="progressbar"` + aria-valuenow/label
- Check-in: `htmlFor`/`id` inputs, medication `role="group"`, warning signs `aria-expanded`
- Life Chart: `htmlFor`/`id` em 4 campos, event type `role="group"` + `aria-pressed`
- Recharts financeiro: sr-only text + `role="img"` + `aria-label`
- Alert ARIA: `role="status"` para info/warning, `role="alert"` para danger

## 13. Testes

- Framework: Vitest 4.0.18
- **704 testes em 8 suites** (0 falhas)
- `detectCrisis.test.ts`: 423 testes — SOS crisis detection (17 rounds of GPT Pro audit)
- `generateNarrative.test.ts`: 127 testes — 17 forbidden clinical patterns, medication names, edge cases
- `streaks.test.ts`: 53 testes — current/longest streak, 9 achievements, dual_streak_7 concurrency
- `computeInsights.test.ts`: 40 testes — sleep, mood, thermometer, risk, prediction, cycling, heatmap
- `expandRecurrence.test.ts`: 23 testes — planner recurrence expansion
- `healthExport.test.ts`: 19 testes — HAE Apple Health parser
- `parseMobillsCsv.test.ts`: 11 testes — Mobills CSV/XLSX parser
- `dateUtils.test.ts`: 8 testes — date utilities

## 14. Navegação

### Mobile (BottomNav — 5 tabs fixo no rodapé)
Hoje | Check-in | Sono | Insights | Menu

### Desktop (Header — links + SOS + Sair)
Hoje | Check-in | Sono | Insights | Mais | [SOS vermelho] | [Sair]

### Página "Mais" — 5 seções categorizadas
- **Registros:** Diário, Rotina, Planejador, Life Chart, Financeiro
- **Avaliações:** Avaliação Semanal, Funcionamento, Relatório Mensal
- **Bem-estar:** Exercícios, Sons, SOS, Plano de Crise
- **Aprendizado:** Conteúdos, Cursos, Notícias, Famílias, Como Usar
- **Configurações:** Conta, Lembretes, Perfil, Integrações, Acesso Profissional

## 15. Dados de Sono — Regras de Negócio

| Tipo | Critério | Métricas | Histórico | Visual |
|------|----------|----------|-----------|--------|
| Cochilo | < 1h | ❌ Excluído | ✅ Visível | Tag "cochilo" roxo |
| Sono real | ≥ 1h | ✅ Incluído | ✅ Visível | Barra colorida por duração |
| Incompleto? | 1h-4.5h | ✅ Incluído (até exclusão manual) | ✅ Visível | Tag "incompleto?" amarelo |
| Excluído | `excluded: true` | ❌ Excluído | ✅ Visível (dimmed) | Tag "excluído" + botão toggle |

- Toggle via `PATCH /api/sono/excluir` (SleepLog.excluded field)
- Histórico configurável: 7, 15, 30 noites ou 3 meses (via `?noites=N`)
- HAE: timezone-safe (America/Sao_Paulo), night splitting (gap 60min awake), multi-source dedup

---

## 16. ANÁLISE COMPETITIVA — Soma Psico (somapsico.com)

### O que é o Soma Psico
Plataforma de **gestão clínica para profissionais de saúde mental** (psicólogos, psiquiatras). App disponível iOS + Android. Rating 4.7/5 (33 avaliações na App Store). Free. Developer: Soma Technology LTDA.

### Features do Soma Psico
1. **Prontuário eletrônico** — Registro completo de pacientes
2. **Anamnese** — Documentação de intake assessment
3. **Agenda inteligente integrada ao WhatsApp** — Agendamento de sessões com notificação WhatsApp
4. **Teleconsultas** — Videochamadas seguras com qualidade de vídeo
5. **Gestão de documentos** — Gerenciamento de docs do paciente
6. **Controle financeiro** — Gestão financeira para o profissional/clínica
7. **Acesso para secretárias** — Multi-role (clínicas com secretária)
8. **Análise de diários de humor com IA** — IA analisa diários de humor dos pacientes
9. **LGPD compliant** — Acesso controlado, conformidade
10. **Push notifications** — Notificações
11. **Criptografia ponta-a-ponta** — End-to-end encryption
12. **Tour/onboarding** — Onboarding guiado

### Diferença Fundamental de Posicionamento

| Aspecto | Suporte Bipolar | Soma Psico |
|---------|----------------|------------|
| **Público** | Paciente (auto-gestão) | Profissional (gestão clínica) |
| **Foco** | Transtorno bipolar específico | Saúde mental geral |
| **Modelo** | Self-tracking + insights | Prontuário + teleconsulta + agenda |
| **Relação** | Paciente → Dados | Profissional → Pacientes |
| **IA** | Motor de insights (EWMA, Spearman, DSM-5) | Análise de diários de humor |
| **Integrações** | Apple Health, Google Calendar, Mobills | WhatsApp |
| **Instrumentos** | ASRM, PHQ-9, FAST, NIMH Life Chart | Anamnese genérica |

### Features que o Soma Psico TEM e nós NÃO TEMOS

| Feature Soma | Equivalente nosso? | Gap real? |
|-------------|-------------------|-----------|
| Teleconsulta (videochamada) | ❌ Não temos | ⚠️ Possível — mas nosso foco é self-management, não consulta. O acesso profissional (token+PIN) já permite compartilhar dados com o psiquiatra. |
| Agenda WhatsApp | ❌ Não temos | ⚠️ Lembretes por push/email, não WhatsApp. WhatsApp seria mais eficaz no Brasil. |
| Prontuário eletrônico | ❌ Dashboard profissional é read-only | 🟡 Nosso dashboard profissional poderia evoluir para incluir anotações do profissional. |
| Análise de humor com IA | 🟡 Parcial — motor de insights é baseado em estatística, não LLM | ⚠️ Gap: poderíamos usar LLM para gerar interpretações narrativas dos dados. |
| E2E encryption | ❌ AES-256-GCM para tokens Google, mas não E2E para dados | 🟡 Dados em repouso no PostgreSQL. E2E seria overengineering para uma webapp. |
| Multi-role (secretária) | ❌ N/A | ❌ Não aplicável — somos patient-facing |
| Onboarding tour guiado | ❌ Temos /como-usar mas não tour interativo | ⚠️ Gap real — um onboarding step-by-step no primeiro login melhoraria retenção |

### Features que NÓS TEMOS e o Soma Psico NÃO TEM

| Feature nossa | Vantagem |
|--------------|----------|
| Termômetro de Humor (EWMA bipolar) | Motor analítico específico para bipolar com 5 zonas e detecção de estado misto |
| Predição de Episódio | Risk scoring mania/depressão (0-100) com base em padrões |
| Ciclagem Rápida DSM-5 | Detecção automática de padrão de ciclagem |
| Social Jet Lag | Análise circadiana weekday vs weekend |
| Integração Apple Health | Dados automáticos de sono, HR, HRV, passos |
| ASRM + PHQ-9 + FAST | Instrumentos validados integrados com safety flow |
| NIMH Life Chart | Eventos significativos com timeline |
| SOS com logging | Sistema de emergência com grounding guiado |
| Plano de Crise | Contatos, medicações, coping strategies |
| Correlação humor-gastos | Spearman correlation com alertas financeiros |
| Heatmap 90 dias | Visualização de padrões de longo prazo |
| 15 Warning Signs | ISBD/STEP-BD prodrome detection |
| PWA com offline | Funciona offline com CVV 188 acessível |
| Perfil socioeconômico | Recomendações CAPS/SUS/CRAS automatizadas |

## 17. GAP ANALYSIS — Features que AINDA NÃO TEMOS (priorizado)

### P0 — Gaps Críticos (melhorariam muito o produto)

1. ~~**Lembretes via WhatsApp**~~ → 🟡 Webhook ready, Business account pending. Push notifications implementadas como alternativa.

2. **Onboarding tour interativo** — Primeiro login deveria guiar o usuário pelas features principais (check-in, sono, insights, SOS). Melhora retenção D1/D7.

3. ~~**IA narrativa para insights**~~ → ✅ **IMPLEMENTADO** (OpenAI Responses API, 17 forbidden patterns, high-risk template bypass, Structured Outputs strict: true, store: false LGPD)

4. **Resultados dos testes cognitivos** — A página `/cognitivo` existe mas não mostra resultados interpretados após completar o teste. Gap UX real.

### P1 — Gaps Importantes

5. ~~**Notificações push nativas**~~ → ✅ **IMPLEMENTADO** (Web Push VAPID, cron every-minute, SSRF allowlist, batch sending, expired cleanup)

6. **Compartilhamento de relatório em PDF** — Gerar PDF do relatório mensal para levar na consulta psiquiátrica. Muito pedido por pacientes.

7. ~~**Gamificação leve**~~ → ✅ **IMPLEMENTADO** (9 achievements, dual streaks, progress bars, AchievementGrid com a11y)

8. **Suporte a múltiplos idiomas** — Expansão para espanhol (América Latina tem mercado similar).

### P2 — Nice-to-have

9. **Diário de voz** — Gravação de áudio rápida quando não quer digitar (transcrição via Whisper).
10. **Widget iOS** — Widget de check-in rápido para home screen.
11. **Export para profissional em formato FHIR/HL7** — Interoperabilidade com sistemas de prontuário.
12. **Suporte a Apple Watch nativo** — Complication para check-in rápido.

## 18. Brand & Identidade Visual

- **Nome:** Suporte Bipolar
- **Domínio:** suportebipolar.com
- **Logo:** Cérebro com nós/dots + texto "SUPORTE BIPOLAR"
- **Ícone:** Cérebro puro (sem texto) — icon-512, icon-192, apple-touch
- **Favicon:** "SB" em fundo teal (icon.svg, favicon.ico, favicon.png)
- **OG Image:** Logo + "Seu painel de estabilidade"
- **Theme color:** #527a6e

## 19. Infraestrutura

- **Vercel:** Deploy automático on push to main, maxDuration 60s (Pro)
- **Cloudflare:** DNS (proxy OFF para SSL Vercel), Worker hae-proxy
- **Neon:** PostgreSQL serverless
- **Sentry:** Error tracking com PII scrubbing
- **GitHub:** Repositório privado

## 20. Perguntas para o Auditor GPT PRO

1. **Competitivo:** O Soma Psico é um concorrente direto ou complementar? Devemos investir em features para profissionais ou manter foco no paciente?
2. **IA:** Vale implementar interpretação narrativa dos insights com LLM? Qual o risco de linguagem clínica inadequada?
3. **WhatsApp:** Lembretes via WhatsApp Business API justificam o custo/complexidade vs push notifications?
4. **Onboarding:** Qual formato de tour seria ideal para nosso público (bipolar, mobile-first)?
5. **Monetização:** Com 46 páginas, 50+ APIs e 21 modelos, o app está pronto para freemium? O que deveria ser premium?
6. **Cognitivo:** Os testes cognitivos (tempo de reação, digit span) precisam de resultados interpretados? Qual o risco de over-interpretation?
7. **PDF:** Relatório em PDF para levar na consulta — é prioridade alta para o público-alvo?
8. **Mobile:** Vale investir em app nativo (React Native) ou manter PWA?
9. **Segurança:** A implementação LGPD cobre os requisitos legais? Precisa de DPO?
10. **Escalabilidade:** A arquitetura (Next.js + Prisma + Neon) suporta crescimento para 10K+ usuários simultâneos?

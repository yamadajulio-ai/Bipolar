# Rede Bipolar — Relatório Completo para Auditoria

## 1. Visão Geral

**Nome:** Rede Bipolar
**URL:** https://bipolar-yamadajulio-ais-projects.vercel.app (Vercel)
**Repositório:** github.com/yamadajulio-ai/Bipolar
**Público-alvo:** Brasileiros com transtorno bipolar (mobile-first, iPhone)
**Idioma:** pt-BR
**Princípios:** IPSRT, PROMAN/USP, linguagem clínica cuidadosa

## 2. Stack Técnica

| Tecnologia | Versão |
|-----------|--------|
| Next.js | 16.1.6 (App Router, Server Components) |
| React | 19.2.3 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| Prisma + PostgreSQL | Neon (^6.19.2) |
| Recharts | ^3.7.0 |
| Sentry | ^10.42.0 |
| iron-session | ^8.0.4 |
| bcryptjs | ^3.0.3 |
| Zod | ^4.3.6 |
| Vitest | ^4.0.18 (101 testes) |
| Deploy | Vercel (auto-deploy on push to main) |
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

Inspiração visual: vitorcavenaghi.com.br (estética healthcare teal/forest green)

## 4. Estrutura de Páginas (50 páginas)

### Páginas Públicas (4)
| Rota | Descrição |
|------|-----------|
| `/` | Landing page com hero, features e CTAs |
| `/escolher-visual` | Seletor de tema visual (4 opções) |
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
| `/hoje` | Dashboard principal — status do dia, alertas contextuais, streak, gráfico 7d |
| `/mais` | Hub de navegação com todas as seções |
| `/offline` | Fallback offline com CVV 188 |

### Registros Diários (6)
| Rota | Descrição |
|------|-----------|
| `/checkin` | Check-in rápido (humor 1-5, energia, ansiedade, sono, medicação, sinais de alerta) |
| `/diario` | Histórico do diário de humor |
| `/diario/novo` | Novo registro de diário |
| `/sono` | Histórico de sono |
| `/sono/novo` | Novo registro de sono (hora dormir/acordar, qualidade, rotina) |
| `/rotina/novo` | Registro de âncoras IPSRT (acordar, 1o contato, atividade, jantar, dormir) |

### Tendências & Insights (6)
| Rota | Descrição |
|------|-----------|
| `/diario/tendencias` | Gráficos de humor/sono, distribuição, alertas |
| `/sono/tendencias` | Análise de sono (média, qualidade, variância) |
| `/rotina/tendencias` | Regularidade de ritmo (SRM-like) |
| `/insights` | Painel completo: Termômetro Humor (M/D dual-score EWMA), Social Jet Lag, SRM Window Score, Ciclagem Rápida (DSM-5), Predição de Episódio, Heatmap 90d, 15 Warning Signs ISBD/STEP-BD |
| `/circadiano` | Análise circadiana (cronótipo, midpoint, dark therapy) |
| `/cognitivo` | Microtarefas cognitivas (tempo de reação, digit span) |

### Avaliações Clínicas (3)
| Rota | Descrição |
|------|-----------|
| `/avaliacao-semanal` | Wizard 4 steps: ASRM (5 items) + PHQ-9 (9 items, safety flow item 9) + FAST short (6 domínios) |
| `/life-chart` | Eventos significativos NIMH (7 tipos: medicação, estressor, viagem, hospitalização, terapia, menstrual, outro) |
| `/relatorio` | Relatório mensal com ASRM/PHQ-9/FAST + eventos + tendências |

### Bem-estar (4)
| Rota | Descrição |
|------|-----------|
| `/exercicios` | Lista de exercícios de respiração e aterramento |
| `/exercicios/respiracao/[tipo]` | Timer de respiração guiada (4-7-8, box, etc.) |
| `/exercicios/aterramento/[tipo]` | Aterramento guiado (5 sentidos, body scan) |
| `/sons` | Player de sons ambiente (white/pink/brown noise, chuva) |

### Emergência (3)
| Rota | Descrição |
|------|-----------|
| `/sos` | SOS: respiração rápida, grounding guiado, contatos de crise, logging |
| `/plano-de-crise` | Visualizar plano de crise |
| `/plano-de-crise/editar` | Editar plano de crise |

### Planejamento (2)
| Rota | Descrição |
|------|-----------|
| `/planejador` | Planejador semanal com Google Calendar + IPSRT |
| `/rotina` | Histórico de âncoras diárias |

### Educação (5)
| Rota | Descrição |
|------|-----------|
| `/conteudos` | Biblioteca de artigos educacionais |
| `/conteudos/[slug]` | Artigo individual |
| `/cursos` | Cursos estruturados com progresso |
| `/cursos/[cursoSlug]` | Overview do curso |
| `/cursos/[cursoSlug]/[aulaSlug]` | Aula individual |

### Configurações & Perfil (8)
| Rota | Descrição |
|------|-----------|
| `/conta` | Conta (LGPD: export, deletar) |
| `/conta/lembretes` | Lembretes (acordar, sono, diário, respiração) |
| `/perfil` | Perfil socioeconômico (5 perguntas, recomendações CAPS/SUS/CRAS) |
| `/integracoes` | Google Calendar + Health Auto Export (Apple Health) |
| `/acesso-profissional` | Acesso profissional (token + PIN bcrypt) |
| `/financeiro` | Financeiro (CSV import, categorias, correlação humor-gasto) |
| `/noticias` | Feed de notícias científicas |
| `/familias` | Guia para famílias |

### Acesso Profissional (1)
| Rota | Descrição |
|------|-----------|
| `/profissional/[token]` | Dashboard read-only para profissional (dados brutos + insights + SOS + assessments + life chart) |

## 5. APIs (45 endpoints)

### Autenticação
- `POST /api/auth/login` — Login com rate limiting
- `POST /api/auth/cadastro` — Registro com age gate + consent
- `POST /api/auth/logout` — Logout + session destroy
- `GET /api/auth/google` — OAuth Google Calendar
- `GET /api/auth/google/callback` — Callback Google Calendar
- `GET /api/auth/google-login` — Login via Google
- `GET /api/auth/google-login/callback` — Callback login Google
- `DELETE /api/auth/google/disconnect` — Desconectar Google
- `GET /api/auth/export` — Export LGPD (JSON completo)
- `POST /api/auth/excluir-conta` — Deletar conta (cascade)

### Dados de Saúde
- `GET/POST /api/diario` — CRUD diário de humor
- `GET /api/diario/tendencias` — Tendências do diário
- `GET/POST /api/sono` — CRUD sono
- `GET /api/sono/tendencias` — Tendências de sono
- `GET/POST/PUT /api/rotina` — Ritmo circadiano
- `GET /api/rotina/tendencias` — Regularidade de ritmo
- `GET/POST /api/sos` — Eventos SOS
- `GET/POST/PUT /api/avaliacao-semanal` — ASRM + PHQ-9 + FAST
- `GET/POST/PUT/DELETE /api/life-chart` — Life Chart events
- `GET/POST/PUT /api/funcionamento` — FAST (6 domínios)

### Planejamento
- `GET/POST /api/planner/blocks` — Blocos do planejador
- `GET/PUT/DELETE /api/planner/blocks/[id]` — CRUD bloco específico
- `POST/GET /api/planner/blocks/[id]/exceptions` — Exceções recorrência
- `GET/POST/PUT /api/planner/rules` — Regras IPSRT

### Integrações
- `GET/POST /api/google/sync` — Sync Google Calendar
- `GET/POST /api/integrations/health-export` — Webhook HAE
- `POST /api/integrations/health-export/import` — Import manual
- `GET /api/integrations/health-export/status` — Status importações
- `GET/POST /api/integrations/settings` — Config integrações

### Outros
- `GET/POST/PUT /api/lembretes` — Lembretes
- `GET/POST /api/exercicios` — Sessões de exercício
- `GET/POST/PUT /api/plano-de-crise` — Plano de crise
- `GET/POST /api/cursos/progresso` — Progresso de cursos
- `GET /api/cursos/aula` — Conteúdo de aula
- `GET/POST/PUT /api/perfil-socioeconomico` — Perfil socioeconômico
- `GET/POST /api/acesso-profissional` — Criar acesso profissional
- `POST /api/acesso-profissional/[token]` — Validar PIN profissional
- `GET/POST /api/financeiro` — Transações financeiras
- `DELETE /api/financeiro/[id]` — Deletar transação
- `POST /api/financeiro/import` — Import CSV/XLSX
- `GET /api/financeiro/resumo` — Resumo financeiro
- `GET /api/noticias` — Notícias científicas
- `GET /api/insights-summary` — Resumo para dashboard
- `GET /api/relatorio` — Relatório mensal
- `GET /api/cron/purge-access-logs` — Purge LGPD (90d, Vercel Cron)

## 6. Banco de Dados (25 modelos Prisma)

| Modelo | Propósito |
|--------|-----------|
| User | Usuários (email, senha, Google OAuth) |
| DiaryEntry | Diário de humor (mood 1-5, energia, ansiedade, medicação, sinais de alerta) |
| SleepLog | Registros de sono (hora, qualidade 0-100, HRV, rotina pré-sono) |
| DailyRhythm | Âncoras IPSRT (5 âncoras diárias) |
| ExerciseSession | Sessões de exercício (tipo, duração) |
| CrisisPlan | Plano de crise (contatos, medicações, coping) |
| PlannerBlock | Blocos do planejador (título, categoria, energia, Google Event) |
| PlannerRecurrence | Recorrência de blocos (freq, dias, até) |
| PlannerException | Exceções de recorrência |
| StabilityRule | Regras IPSRT (horários alvo, buffer, cutoff) |
| GoogleAccount | Tokens Google (AES-256-GCM encrypted) |
| IntegrationKey | Chaves de API (HAE) |
| HealthMetric | Métricas de saúde importadas |
| NewsArticle | Artigos de notícias |
| RateLimit | Rate limiting (atômico via $transaction) |
| ProfessionalAccess | Acesso profissional (token, PIN bcrypt, LGPD consent) |
| AccessLog | Log de acessos profissionais |
| SocioeconomicProfile | Perfil socioeconômico (5 campos) |
| SOSEvent | Eventos SOS (action, timestamp) |
| FinancialTransaction | Transações financeiras (CSV import) |
| Consent | Consentimentos LGPD (scope, data) |
| WeeklyAssessment | Avaliação semanal (ASRM, PHQ-9, FAST) |
| LifeChartEvent | Eventos Life Chart NIMH (7 tipos) |
| FunctioningAssessment | FAST short (6 domínios, 1-5) |
| ReminderSettings | Configurações de lembretes |
| ContentView | Views de conteúdo educacional |
| CourseProgress | Progresso de cursos |

## 7. Componentes (58 componentes em 57 arquivos)

### Core UI (19)
Card, FormField, Alert, ScaleSelector, Header, Footer, BottomNav, Greeting, ServiceWorkerRegister, InstallBanner, SOSButton, WarningSignsChecklist, SleepRoutineChecklist, AlertasPadrao, RegularityMeter, CrisisPlanForm, CrisisPlanCard, RhythmForm, ReminderManager

### Dashboard (5)
TodayStatus, QuickActions, ContextualSuggestions, DashboardChartWrapper, MiniTrendChart

### Gráficos (5)
PeriodSelector, RhythmChart, SleepChart, MoodDistribution, MoodSleepChart

### Insights (9)
NightHistorySelector, MetricLabel, SafetyNudge, Sparkline, MoodThermometer, EpisodePrediction, InfoTooltip, CalendarHeatmap, CyclingAnalysis

### Exercícios (4)
BreathingTimer, ProgressSteps, GroundingGuide, BreathingCircle

### Relatório (2)
MonthSelector, MonthlyReport

### Outros (14)
SoundPlayer, ImportCSV, TransactionList, CategoryChart, MoodSpendingChart, NewsFeed, GoogleCalendarSync, TodayBlocks, WeeklyView, InsightsCharts, QuickBreathing, DeleteAccountButton

## 8. Segurança & LGPD

### Implementado
- **Autenticação:** iron-session + bcryptjs + Google OAuth
- **CSRF:** Sec-Fetch-Site + Origin no middleware (exceções: cron, integrations, profissional)
- **Rate Limiting:** Atômico via Prisma $transaction
- **LGPD — Consentimento:** Modelo Consent (health_data, terms_of_use), age gate 18+
- **LGPD — Export:** GET /api/auth/export (JSON completo)
- **LGPD — Exclusão:** DELETE cascade + session destroy
- **LGPD — IP Masking:** IPv4 /24 + IPv6 /64 via maskIp()
- **LGPD — Purge:** Cron 90d access logs (fail-closed)
- **Google Tokens:** AES-256-GCM encryption
- **Profissional:** PIN bcrypt, token expiration, failed attempts lock, LGPD consent

### Sentry (Error Tracking)
- PII scrubbing: URLs, span data, breadcrumbs
- Header whitelist: content-type, user-agent, accept only
- Request body/query/cookies: filtered
- Error boundaries: error.tsx, global-error.tsx

## 9. PWA

- Service Worker v2: 3 caches (static cache-first, API stale-while-revalidate 5min, offline pre-cache)
- APIs cacheáveis: /api/diario, /api/sono, /api/rotina, /api/insights-summary, /api/lembretes
- SW update toast: detecta nova versão e mostra banner
- Manifest: icons (512, 192, maskable), shortcuts (Check-in, SOS)
- InstallBanner: banner educacional iOS Safari
- Offline page: SVG acessível, CVV 188

## 10. Integrações

| Integração | Status |
|-----------|--------|
| Google Calendar | Funcional (OAuth, sync, eventos no planejador) |
| Apple Health (HAE) | Funcional (webhook + import manual via Health Auto Export) |
| Mobills (Financeiro) | Import CSV/XLSX |

## 11. Acessibilidade (A11y)

- `:focus-visible` global
- Skip-to-content link
- ScaleSelector: `role="group"` + `aria-pressed`
- `--muted` contraste AA (~5.2:1)
- Header: `aria-expanded`, `aria-controls`, `aria-current="page"`
- CalendarHeatmap: keyboard nav, aria-label legend
- InfoTooltip: `role="tooltip"` + `aria-describedby` + hover support
- SOS: `aria-live="assertive"`
- BreathingCircle: `prefers-reduced-motion`

## 12. Testes

- Framework: Vitest 4.0.18
- 101 testes em 5 arquivos
- `computeInsights.test.ts`: 40 testes (sleep, mood, thermometer, risk, prediction, cycling, heatmap, rhythm, chart)

## 13. Motor de Insights (computeInsights.ts ~1800 linhas)

Features calculadas server-side:
- **Termômetro de Humor:** Dual-score M/D (0-100), EWMA α=0.4, 5 zonas, flag misto (forte/provável), instabilidade
- **Social Jet Lag:** Weekday vs weekend sleep midpoint difference
- **SRM Window Score:** ±45min regularity (inspired by Social Rhythm Metric)
- **Ciclagem Rápida:** Detecção DSM-5 (≥4 episódios/ano)
- **Predição de Episódio:** Risk scoring mania/depressão com sinais e recomendações
- **Heatmap 90d:** Humor, sono, energia com cores contextuais
- **15 Warning Signs:** ISBD/STEP-BD baseados
- **Correlações:** Spearman (ranks com empates)
- **Data Confidence:** Badges baseados em quantidade de dados

## 14. Navegação

### Mobile (BottomNav — 5 tabs)
Hoje | Check-in | Sono | Insights | Mais

### Desktop (Header — 5 links + SOS + Sair)
Hoje | Check-in | Sono | Insights | Mais | [SOS] | [Sair]

### Página "Mais" (24 itens)
Acesso a todas as features não presentes na nav principal.

## 15. Perguntas para o Auditor

1. **Visual:** A paleta teal transmite confiança para saúde mental? A landing page converte? Mobile-first está bem executado?
2. **UX:** A navegação (5 tabs + "Mais") é intuitiva? O dashboard (/hoje) tem informação suficiente sem sobrecarregar?
3. **Features:** Alguma feature essencial está faltando para o público-alvo? Alguma feature atual é desnecessária?
4. **Clínico:** Os instrumentos (ASRM, PHQ-9, FAST) estão bem integrados? O safety flow do PHQ-9 item 9 é adequado?
5. **Integrações:** Vale investir em mais integrações (Fitbit, Samsung Health, Google Fit)?
6. **Monetização:** O app está pronto para um modelo freemium? O que deveria ser premium?
7. **Segurança:** A implementação LGPD cobre os requisitos legais brasileiros?
8. **Performance:** Server Components estão sendo usados corretamente? Há oportunidades de otimização?
9. **Acessibilidade:** Está em nível AA? O que falta para AAA?
10. **Competitividade:** Como se compara a apps como Daylio, eMoods, Bearable?

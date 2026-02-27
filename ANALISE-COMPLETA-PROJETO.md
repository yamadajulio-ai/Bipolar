# Empresa Bipolar — Relatório Completo do Projeto

**Data**: 27/02/2026
**Autor do desenvolvimento**: Julio Yamada (com Claude Code / Claude Opus 4.6)
**Repositório**: https://github.com/yamadajulio-ai/Bipolar.git
**Branch**: main
**Ambiente**: localhost:3000 (dev) | PostgreSQL (produção via Neon)

---

## 1. O QUE É O PROJETO

**Empresa Bipolar** é uma plataforma web educativa e de auto-organização para pessoas com Transtorno Afetivo Bipolar Tipo 1 (TAB1) e suas famílias. O produto NÃO substitui tratamento médico/psicológico — funciona como ferramenta complementar.

### Princípios Fundamentais
1. Segurança em primeiro lugar (avaliação de risco para estados de crise)
2. Privacidade (LGPD, privacy by design, dados sensíveis de saúde mental)
3. Sem substituição médica (disclaimers em todas as telas)
4. Educação baseada em evidências
5. Acessibilidade (diferentes níveis de letramento digital)
6. **Zero gamificação** — sem streaks, badges, pontos, rankings (decisão arquitetural para evitar comportamento compulsivo/maníaco)
7. **Zero IA** para recomendações clínicas

---

## 2. STACK TÉCNICA

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| CSS | Tailwind CSS | v4 |
| ORM | Prisma Client | 6.19.2 |
| Banco de dados (dev) | SQLite | dev.db local |
| Banco de dados (prod) | PostgreSQL | Neon |
| Autenticação | iron-session (HttpOnly) + bcryptjs | v8 / v3 |
| Validação | Zod | v4 (importado de "zod/v4") |
| Gráficos | Recharts | 3.7.0 |
| Markdown | remark + rehype + gray-matter | — |
| Google API | googleapis | 171.4.0 |
| Linguagem | TypeScript | 5.x |
| Package Manager | pnpm | — |
| Testes | Vitest | 4.0.18 |

### Decisões técnicas notáveis:
- **PostgreSQL (Neon)** para produção, **SQLite** para dev local
- **Sem enums nativos** no Prisma com SQLite → campos String com validação Zod no runtime
- **Zod v4** importado de `"zod/v4"` com padrão `.safeParse()`
- **iron-session v8** com `getSession()` retornando `{ userId, email, isLoggedIn }`
- **Next.js 16 params**: `{ params }: { params: Promise<{ id: string }> }` com `await params`
- **Web Audio API** para sons (sem arquivos de áudio externos)
- **CSS custom properties** para paleta de cores quente ("Abraço")
- **Google OAuth 2.0** com refresh automático de tokens
- **Sync bidirecional** com Google Calendar via syncToken incremental

---

## 3. HISTÓRICO DE VERSÕES

### v1.0.0 — 24/02/2026 (MVP Inicial)
- Landing page com disclaimers
- Cadastro/login seguros (bcrypt + iron-session)
- Diário básico (humor 1-5, sono, nota)
- Biblioteca educacional (10 artigos markdown)
- Plano de crise estático
- Área para famílias
- Privacidade e termos de uso
- Security headers (CSP, X-Frame-Options)
- Rate limiting no login

### v2.0.0 — 25/02/2026 (Features Expandidas)
- Diário expandido (energia, ansiedade, irritabilidade, medicação, sinais de alerta)
- Módulo de sono (registro detalhado, qualidade, tendências)
- Exercícios de respiração (4-7-8, quadrada, diafragmática) com animação CSS
- Técnicas de aterramento (5 sentidos, relaxamento muscular progressivo)
- Rastreador de ritmo social (IPSRT)
- SOS de crise interativo (botão flutuante, interface escura, respiração rápida)
- Plano de crise personalizado (contatos, medicamentos, hospital, estratégias)
- Sons ambiente (ruído branco/rosa/marrom, chuva via Web Audio API)
- Dashboard inteligente com sugestões contextuais
- Relatório mensal imprimível para profissionais
- Cursos estruturados (4 cursos com aulas sequenciais)
- Lembretes gentis (Notification API)
- 6 novos modelos Prisma, 12+ API routes, 16+ páginas, 30+ componentes

### v3.0.0 — 25/02/2026 (Calendário de Estabilidade — Core MVP)
O módulo central do produto:
- **Planejador semanal** — blocos de atividades (âncora/flexível/risco), recorrência (nenhuma/diária/semanal), exceções por data
- **Motor de regras transparente** — detecta conflitos de horário, noites tardias, violação de wind-down, proteção de âncoras, limite de noites tardias/semana
- **Tela "Hoje" (Autopiloto)** — próximo bloco com contagem regressiva, âncoras do dia, orçamento de energia, ações rápidas
- **Check-in 30s** — humor, energia, ansiedade, irritabilidade, sono, medicação (salva via DiaryEntry)
- **Insights** — regularidade de sono, regularidade de âncoras IPSRT, carga semanal de energia, noites de risco
- 4 novos modelos Prisma (PlannerBlock, PlannerRecurrence, PlannerException, StabilityRule)
- Constraint engine puro (types.ts, expandRecurrence.ts, constraints.ts)

### v3.1.0 — 26/02/2026 ("Setup uma vez, roda sempre")
Redução drástica de entrada manual:
- **Templates de Semana** — salvar/aplicar com 3 modos (mesclar/preencher/substituir)
- **Rotinas Persistentes** — flag `isRoutine` no PlannerBlock (sem modelo novo, reutiliza 100% do código)
- **Copiar Semana** — clonar blocos de semana anterior com detecção de duplicatas
- **Quick Add** — parser determinístico pt-BR para adicionar blocos por texto (0 IA, ~40 keywords)
- **Smart Defaults** — auto-preenchimento por categoria (duração, energia, estimulação, tipo)
- **Onboarding First-Run** — setup de horários base + rotinas comuns no primeiro acesso
- 2 novos modelos (PlannerTemplate, PlannerTemplateBlock), 5 novas API routes, 6 novos componentes UI

### v3.2.0 — 26-27/02/2026 (Integrações Externas + Deploy PostgreSQL)
- **Google Calendar Sync** — OAuth 2.0 bidirecional, push de blocos para Google, pull de eventos do Google, sync incremental com syncToken
- **Importação Financeira Mobills** — parser CSV inteligente (formato brasileiro dd/MM/yyyy, separador ;), dashboard com gráficos de categorias, alerta de gastos elevados em mania
- **Health Auto Export** — webhook para receber dados de sono do iPhone (sleep_analysis), cálculo automático de qualidade, clustering de segmentos em noites, rate limiting 60 req/h
- **Página de Integrações** — UI para conectar/desconectar Google, gerenciar API keys de Health Export, instruções passo a passo
- **Migração para PostgreSQL (Neon)** — schema migrado, migration SQL gerada, pronto para deploy em produção
- 3 novos modelos (GoogleAccount, IntegrationKey, FinancialTransaction)
- 2 novos campos no PlannerBlock (googleEventId, sourceType)
- 8+ novas API routes, 4 novos componentes UI

---

## 4. ARQUITETURA DO PROJETO

### Estrutura de diretórios

```
empresa-bipolar/
├── content/
│   ├── biblioteca/          # 11 artigos markdown sobre TAB1
│   └── cursos/              # 4 cursos com aulas sequenciais
│       ├── entendendo-tab1/     # Entendendo o TAB1 (5 aulas)
│       ├── higiene-do-sono/     # Higiene do Sono (4 aulas)
│       ├── comunicacao-familiar/ # Comunicação Familiar (3 aulas)
│       └── regulacao-emocional/  # Regulação Emocional (4 aulas)
├── docs/                    # 10 documentos de produto
├── prisma/
│   ├── schema.prisma        # 18 modelos
│   ├── dev.db               # SQLite dev
│   └── migrations/          # PostgreSQL migration
├── public/                  # Assets estáticos
├── src/
│   ├── middleware.ts         # Auth middleware (protege rotas, redireciona)
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── globals.css      # Tailwind + CSS custom properties
│   │   ├── (app)/           # Rotas autenticadas (42+ páginas)
│   │   │   ├── layout.tsx       # Layout com Header, Footer, SOSButton, disclaimers
│   │   │   ├── hoje/            # Tela Hoje (autopiloto)
│   │   │   ├── planejador/      # Calendário de estabilidade
│   │   │   ├── checkin/         # Check-in 30s
│   │   │   ├── insights/        # Insights de estabilidade
│   │   │   ├── diario/          # Diário + novo + tendências
│   │   │   ├── sono/            # Sono + novo + tendências
│   │   │   ├── exercicios/      # Respiração + aterramento (rotas dinâmicas)
│   │   │   ├── rotina/          # Ritmo social + novo + tendências
│   │   │   ├── cursos/          # Cursos + [cursoSlug] + [aulaSlug]
│   │   │   ├── conteudos/       # Biblioteca + [slug]
│   │   │   ├── sons/            # Sons ambiente
│   │   │   ├── sos/             # SOS de crise
│   │   │   ├── relatorio/       # Relatório mensal
│   │   │   ├── plano-de-crise/  # Plano + edição
│   │   │   ├── conta/           # Conta + lembretes
│   │   │   ├── integracoes/     # Integrações (Google, Health Export)
│   │   │   ├── financeiro/      # Dashboard financeiro + import CSV
│   │   │   ├── familias/        # Área para famílias
│   │   │   ├── mais/            # Hub + templates + rotinas
│   │   │   └── como-usar/       # Guia completo
│   │   ├── (auth)/          # Login, cadastro
│   │   ├── (public)/        # Landing, termos, privacidade, escolher-visual
│   │   └── api/             # 32+ API routes
│   │       ├── auth/            # login, cadastro, logout, google OAuth
│   │       ├── diario/          # CRUD + tendências
│   │       ├── sono/            # CRUD + tendências
│   │       ├── rotina/          # CRUD + tendências
│   │       ├── exercicios/      # CRUD
│   │       ├── planner/         # blocks, blocks/[id], exceptions, rules, weeks/clone
│   │       ├── templates/       # CRUD + [id]/apply
│   │       ├── quick-add/       # Parser pt-BR
│   │       ├── google/          # sync bidirecional
│   │       ├── financeiro/      # CRUD + import CSV + resumo
│   │       ├── integrations/    # health-export webhook + settings
│   │       ├── lembretes/       # GET/POST
│   │       ├── plano-de-crise/  # GET/PUT
│   │       ├── relatorio/       # GET
│   │       └── cursos/          # aula + progresso
│   ├── components/          # 53+ componentes React
│   │   ├── planner/         # 11 componentes (WeeklyView, BlockEditor, QuickAdd, etc.)
│   │   ├── charts/          # 5 gráficos (Mood, Sleep, Rhythm, Distribution, Period)
│   │   ├── dashboard/       # 5 widgets (TodayStatus, QuickActions, MiniTrend, etc.)
│   │   ├── exercicios/      # 4 (BreathingTimer, Circle, GroundingGuide, ProgressSteps)
│   │   ├── financeiro/      # 3 (FinanceCharts, ImportCSV, TransactionList)
│   │   ├── relatorio/       # 2 (MonthlyReport, MonthSelector)
│   │   ├── integrations/    # 1 (GoogleCalendarSync)
│   │   ├── sons/            # 1 (SoundPlayer)
│   │   ├── sos/             # 1 (QuickBreathing)
│   │   └── (raiz)/          # 14 base (Header, Footer, Alert, Card, SOSButton, etc.)
│   └── lib/
│       ├── auth.ts          # iron-session + bcrypt
│       ├── db.ts            # Prisma client singleton
│       ├── security.ts      # Rate limiting, sanitização
│       ├── constants.ts     # Constantes do app
│       ├── content.ts       # Loader de markdown
│       ├── courses.ts       # Sistema de cursos
│       ├── dateUtils.ts     # Utilidades de data (+ testes)
│       ├── google/          # 3 módulos (auth, calendar, sync)
│       ├── planner/         # 10 módulos (types, categories, defaults, constraints,
│       │                    #   quickAddParse, expandClient/Server/Recurrence,
│       │                    #   templateApply, weekClone + testes)
│       ├── financeiro/      # 1 módulo (parseMobillsCsv + teste)
│       └── integrations/    # 1 módulo (healthExport + teste)
└── package.json
```

### Modelos Prisma (18 modelos)

| # | Modelo | Propósito | Relação |
|---|--------|----------|---------|
| 1 | User | Usuário com email/senha | — |
| 2 | DiaryEntry | Diário expandido (humor, sono, energia, ansiedade, irritabilidade, medicação, sinais) | User 1:N |
| 3 | ContentView | Tracking de leitura de artigos | User 1:N |
| 4 | SleepLog | Registro detalhado de sono (horários, qualidade, despertares, rotina) | User 1:N |
| 5 | ExerciseSession | Sessões de respiração/aterramento | User 1:N |
| 6 | DailyRhythm | Ritmo social IPSRT (5 âncoras de tempo) | User 1:N |
| 7 | ReminderSettings | Configuração de lembretes (4 horários + enabled) | User 1:1 |
| 8 | CrisisPlan | Plano de crise (contatos, profissional, medicamentos, hospital, estratégias) | User 1:1 |
| 9 | CourseProgress | Progresso nos cursos (curso + aula completada) | User 1:N |
| 10 | PlannerBlock | Blocos do calendário (título, categoria, kind, horários, energia, estimulação, isRoutine, googleEventId, sourceType) | User 1:N |
| 11 | PlannerRecurrence | Recorrência (NONE/DAILY/WEEKLY, intervalo, dias, até) | Block 1:1 |
| 12 | PlannerException | Exceções (cancelar/alterar ocorrências específicas) | Block 1:N |
| 13 | StabilityRule | Regras de estabilidade (cutoff noturno, wind-down, buffer sono, max noites tardias, proteger âncoras, horários alvo) | User 1:1 |
| 14 | PlannerTemplate | Templates de semana (nome, descrição) | User 1:N |
| 15 | PlannerTemplateBlock | Blocos de template (tempo relativo: startTimeMin, durationMin, weekDay) | Template 1:N |
| 16 | GoogleAccount | OAuth tokens do Google (accessToken, refreshToken, expiresAt, calendarId, syncToken) | User 1:1 |
| 17 | IntegrationKey | Chaves de API para serviços externos (health_auto_export) | User 1:N |
| 18 | FinancialTransaction | Transações financeiras (data, descrição, valor, categoria, conta, source) | User 1:N |

### API Routes (32+ endpoints)

**Auth (4)**:
- POST /api/auth/cadastro — registro de usuário
- POST /api/auth/login — login com email/senha
- POST /api/auth/logout — encerrar sessão
- GET /api/auth/google/callback — OAuth callback do Google

**Google (2)**:
- POST /api/auth/google — iniciar OAuth do Google
- POST /api/google/sync — sincronizar com Google Calendar

**Auth Google (1)**:
- POST /api/auth/google/disconnect — desconectar Google

**Planner (7)**:
- GET/POST /api/planner/blocks — listar/criar blocos
- GET/PATCH/DELETE /api/planner/blocks/[id] — gerenciar bloco individual
- GET/POST /api/planner/blocks/[id]/exceptions — exceções de bloco
- GET/PUT /api/planner/rules — regras de estabilidade
- POST /api/planner/weeks/clone — clonar semana

**Templates (4)**:
- GET/POST /api/templates — listar/criar templates
- GET/PATCH/DELETE /api/templates/[id] — gerenciar template
- POST /api/templates/[id]/apply — aplicar template à semana

**Quick Add (1)**:
- POST /api/quick-add — parser pt-BR de texto → bloco

**Diário (2)**:
- GET/POST/PUT /api/diario — CRUD de entradas
- GET /api/diario/tendencias — análise de tendências

**Sono (2)**:
- GET/POST/PUT /api/sono — CRUD de logs de sono
- GET /api/sono/tendencias — análise de tendências de sono

**Rotina (2)**:
- GET/POST/PUT /api/rotina — CRUD de ritmos diários
- GET /api/rotina/tendencias — análise de tendências

**Financeiro (3)**:
- GET/POST /api/financeiro — listar/criar transações
- POST /api/financeiro/import — importar CSV Mobills
- GET /api/financeiro/resumo — resumo financeiro

**Integrações (2)**:
- POST /api/integrations/health-export — webhook Health Auto Export
- GET/POST /api/integrations/settings — gerenciar chaves de integração

**Outros (5)**:
- GET/POST /api/exercicios — sessões de exercício
- GET/POST /api/lembretes — configuração de lembretes
- GET/PUT /api/plano-de-crise — plano de crise
- GET /api/relatorio — relatório mensal
- GET/POST /api/cursos/progresso + POST /api/cursos/aula — progresso de cursos

---

## 5. NÚMEROS DO PROJETO

| Métrica | Valor |
|---------|-------|
| Arquivos .ts/.tsx | ~130+ |
| Páginas/telas | 42+ |
| API routes | 32+ |
| Componentes React | 53+ |
| Modelos Prisma | 18 |
| Módulos de lib | 24+ |
| Conteúdo educacional | 4 cursos (16 aulas) + 11 artigos |
| Dependências de produção | 14 |
| Dependências de dev | 11 |
| Dias de desenvolvimento | 4 (24-27/02/2026) |
| Integrações externas | 3 (Google Calendar, Health Auto Export, Mobills CSV) |
| Uso de IA para recomendações | 0 |
| Gamificação | 0 |

---

## 6. FUNCIONALIDADES COMPLETAS (TODAS IMPLEMENTADAS)

### Core: Calendário de Estabilidade
1. Planejador semanal com blocos (âncora/flexível/risco)
2. Recorrência (nenhuma/diária/semanal) com exceções
3. Motor de regras transparente (5 tipos de alerta)
4. Tela "Hoje" autopiloto (próximo bloco, âncoras, energia)
5. Check-in 30 segundos
6. Insights de estabilidade (sono, âncoras IPSRT, carga, risco)
7. Templates de semana (salvar/aplicar 3 modos)
8. Rotinas persistentes (isRoutine flag)
9. Copiar semana com detecção de duplicatas
10. Quick-add por texto (parser pt-BR determinístico)
11. Smart defaults por categoria
12. Onboarding first-run

### Integrações Externas
13. **Google Calendar Sync** — OAuth 2.0, sync bidirecional (push blocos → Google, pull eventos → app), sync incremental com syncToken, refresh automático de tokens
14. **Health Auto Export** — webhook para dados de sono do iPhone, parsing de sleep_analysis, cálculo de qualidade (Deep+REM ratio), clustering de segmentos, rate limiting 60 req/h
15. **Importação Financeira Mobills** — parser CSV inteligente (formato brasileiro), dashboard com gráficos, alerta de gastos elevados em mania, detecção de duplicatas

### Módulos Complementares
16. Diário expandido (7 métricas + sinais de alerta)
17. Painel de tendências (gráficos, alertas de padrão)
18. Módulo de sono (registro + tendências)
19. Exercícios de respiração (3 técnicas com animação)
20. Técnicas de aterramento (2 técnicas com guia)
21. Rastreador de ritmo social IPSRT
22. SOS de crise interativo
23. Plano de crise personalizado
24. Sons ambiente (4 tipos via Web Audio API)
25. Dashboard inteligente com sugestões
26. Relatório mensal imprimível
27. Cursos estruturados (4 cursos)
28. Biblioteca educacional (11+ artigos)
29. Lembretes gentis (Notification API)
30. Dashboard financeiro com gráficos de categorias

### Infraestrutura
31. Landing page com disclaimers
32. Cadastro/login seguros (bcrypt + iron-session HttpOnly)
33. Exclusão de conta (LGPD)
34. Security headers (X-Frame-Options, HSTS, CSP, XSS Protection, Permissions-Policy)
35. Rate limiting
36. Privacidade e termos de uso
37. Área para famílias
38. Página "Como Usar" (guia completo)
39. Middleware de autenticação com proteção de rotas
40. Migração para PostgreSQL (Neon) para produção

---

## 7. DETALHAMENTO DAS INTEGRAÇÕES EXTERNAS

### 7.1 Google Calendar — Sync Bidirecional

**Fluxo OAuth:**
1. Usuário clica "Conectar Google Calendar" → POST /api/auth/google
2. Redirect para Google consent screen (scopes: calendar.events)
3. Google callback → GET /api/auth/google/callback
4. Salva tokens (access + refresh) na tabela GoogleAccount
5. Refresh automático quando token expira

**Fluxo de Sync:**
- **PUSH**: Blocos criados no app (sourceType="app") sem googleEventId → cria evento no Google Calendar com extendedProperties para metadata
- **PULL**: Eventos do Google Calendar → cria PlannerBlock (sourceType="google") no app
- **Incremental**: Usa syncToken do Google para buscar apenas mudanças desde último sync
- **Fallback**: Se syncToken inválido, faz full sync
- **Campos mapeados**: título, horário início/fim, notas/description, categoria (via extendedProperties)

**Arquivos:**
- `src/lib/google/auth.ts` — OAuth2 client setup, token refresh
- `src/lib/google/calendar.ts` — CRUD de eventos no Google Calendar
- `src/lib/google/sync.ts` — Lógica de sync bidirecional
- `src/app/api/auth/google/route.ts` — Iniciar OAuth
- `src/app/api/auth/google/callback/route.ts` — Callback OAuth
- `src/app/api/auth/google/disconnect/route.ts` — Desconectar
- `src/app/api/google/sync/route.ts` — Endpoint de sync
- `src/components/integrations/GoogleCalendarSync.tsx` — UI de sync

### 7.2 Health Auto Export (iPhone → Sono)

**Fluxo:**
1. Usuário configura API key na página de Integrações
2. Configura app Health Auto Export no iPhone com URL do webhook e Bearer token
3. App iPhone envia POST /api/integrations/health-export com dados JSON
4. Backend valida API key, aplica rate limiting (60 req/h)
5. Parser extrai sleep_analysis, agrupa segmentos em noites (clustering 12h)
6. Calcula: bedtime, wakeTime, totalHours, quality (baseado em Deep+REM ratio), awakenings
7. Upsert na tabela SleepLog

**Cálculo de Qualidade:**
| Deep+REM Ratio | Qualidade |
|---------------|-----------|
| >= 35% | 5 (Excelente) |
| >= 25% | 4 (Bom) |
| >= 15% | 3 (Regular) |
| >= 8% | 2 (Ruim) |
| < 8% | 1 (Muito Ruim) |

**Arquivos:**
- `src/lib/integrations/healthExport.ts` — Parser + processamento
- `src/app/api/integrations/health-export/route.ts` — Webhook endpoint
- `src/app/api/integrations/settings/route.ts` — CRUD de API keys

### 7.3 Importação Financeira Mobills (CSV)

**Fluxo:**
1. Usuário exporta CSV do app Mobills
2. Upload via página /financeiro → POST /api/financeiro/import
3. Parser detecta delimitador (; ou ,) e formato numérico brasileiro (1.234,56)
4. Parse de datas dd/MM/yyyy → YYYY-MM-DD
5. Valores negativos entre parênteses suportados
6. Detecção de duplicatas via unique constraint (userId, date, description, amount)
7. Dashboard mostra receitas, despesas, saldo, média diária, gráficos por categoria

**Arquivos:**
- `src/lib/financeiro/parseMobillsCsv.ts` — Parser CSV
- `src/app/api/financeiro/import/route.ts` — Endpoint de import
- `src/app/api/financeiro/route.ts` — CRUD transações
- `src/app/api/financeiro/resumo/route.ts` — Resumo financeiro
- `src/components/financeiro/` — FinanceCharts, ImportCSV, TransactionList

---

## 8. SCHEMA COMPLETO DO BANCO DE DADOS

### Provider: PostgreSQL (Neon) / SQLite (dev)

```prisma
// 18 modelos com relações CASCADE

model User {
  id, email (unique), passwordHash, createdAt
  → DiaryEntry[], ContentView[], SleepLog[], ExerciseSession[],
    DailyRhythm[], ReminderSettings?, CrisisPlan?, CourseProgress[],
    PlannerBlock[], StabilityRule?, PlannerTemplate[],
    GoogleAccount?, IntegrationKey[], FinancialTransaction[]
}

model DiaryEntry {
  id, userId, date (YYYY-MM-DD), mood (1-5), sleepHours (0-24),
  note?, energyLevel? (1-5), anxietyLevel? (1-5), irritability? (1-5),
  tookMedication? ("sim"|"nao"|"nao_sei"), warningSigns? (JSON array)
  @@unique([userId, date])
}

model SleepLog {
  id, userId, date (YYYY-MM-DD), bedtime (HH:MM), wakeTime (HH:MM),
  totalHours, quality (1-5), awakenings (default 0),
  preRoutine? (JSON array), notes?
  @@unique([userId, date])
}

model ExerciseSession {
  id, userId, exerciseType, durationSecs, completedAt
}

model DailyRhythm {
  id, userId, date, wakeTime?, firstContact?, mainActivityStart?,
  dinnerTime?, bedtime?, notes?
  @@unique([userId, date])
}

model ReminderSettings {
  id, userId (unique), wakeReminder?, sleepReminder?,
  diaryReminder?, breathingReminder?, enabled
}

model CrisisPlan {
  id, userId (unique), trustedContacts? (JSON), professionalName?,
  professionalPhone?, medications? (JSON), preferredHospital?,
  copingStrategies? (JSON), updatedAt
}

model CourseProgress {
  id, userId, courseSlug, lessonSlug, completedAt
  @@unique([userId, courseSlug, lessonSlug])
}

model PlannerBlock {
  id, userId, title, category, kind (ANCHOR|FLEX|RISK),
  isRoutine, startAt, endAt, notes?, energyCost (0-10),
  stimulation (0=LOW|1=MED|2=HIGH), googleEventId?, sourceType (app|google)
  → PlannerRecurrence?, PlannerException[]
  @@index([userId, startAt]), @@index([userId, endAt])
}

model PlannerRecurrence {
  id, blockId (unique), freq (NONE|DAILY|WEEKLY),
  interval, weekDays?, until?
}

model PlannerException {
  id, blockId, occurrenceDate, isCancelled,
  overrideStartAt?, overrideEndAt?, overrideTitle?, overrideNotes?
  @@unique([blockId, occurrenceDate])
}

model StabilityRule {
  id, userId (unique), lateEventCutoffMin (default 1260=21:00),
  windDownMin (default 90), minBufferBeforeSleep (default 60),
  maxLateNightsPerWeek (default 2), protectAnchors (default true),
  targetSleepTimeMin?, targetWakeTimeMin?
}

model PlannerTemplate {
  id, userId, name, description?
  → PlannerTemplateBlock[]
}

model PlannerTemplateBlock {
  id, templateId, title, category, kind,
  startTimeMin (minutos desde 00:00), durationMin, energyCost,
  stimulation, weekDay (0-6), notes?
}

model GoogleAccount {
  id, userId (unique), accessToken, refreshToken, expiresAt,
  calendarId (default "primary"), syncToken?
}

model IntegrationKey {
  id, userId, service ("health_auto_export"), apiKey (unique), enabled
  @@unique([userId, service])
}

model FinancialTransaction {
  id, userId, date (YYYY-MM-DD), description, amount (+ = receita, - = despesa),
  category, account?, source (manual|mobills_csv)
  @@unique([userId, date, description, amount])
}
```

---

## 9. SEGURANÇA E COMPLIANCE

### Headers de Segurança (next.config.ts)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### Autenticação
- Senhas com bcrypt (cost 12)
- Sessão iron-session HttpOnly (7 dias)
- Cookie: `empresa-bipolar-session`, httpOnly, secure em prod, sameSite=lax
- Middleware protege todas as rotas autenticadas
- Rate limiting no login

### Dados
- Cascade delete em todas as relações (User → tudo)
- Campos JSON armazenados como String (validação Zod no runtime)
- Disclaimer médico em todas as telas autenticadas
- Nenhum dado de medicação com dosagem (apenas nomes)

### Google OAuth
- Tokens encriptados na sessão
- Refresh automático quando expirado
- Revogação de tokens ao desconectar
- Scopes mínimos (calendar.events)

### Health Export
- Autenticação via Bearer token (API key)
- Rate limiting: 60 requests/hora por API key
- API keys únicas por serviço/usuário

---

## 10. MATRIZ DE RISCOS MONITORADOS

| Risco | Severidade | Mitigação implementada |
|-------|-----------|----------------------|
| Usuário em episódio maníaco | Crítica | Disclaimers em todas as telas, sem interpretações automáticas |
| Desinformação sobre medicação | Crítica | Não aborda medicamentos específicos/dosagens |
| Vazamento de dados | Crítica | TLS, bcrypt, sessão HttpOnly, LGPD compliance |
| Substituição de ajuda profissional | Alta | Links CVV/CAPS/SAMU em destaque, avisos persistentes |
| Gamificação compulsiva | Eliminado | Zero gamificação (decisão arquitetural) |
| Alertas geram ansiedade | Média | Linguagem suave, não alarmista, com disclaimers |
| Calendário gera rigidez | Média | Alertas informativos (não bloqueantes), linguagem suave |
| Complexidade sobrecarrega em crise | Alta | Tela "Hoje" simplificada, SOS acessível em todas as telas |
| Gastos excessivos em mania | Alta | Alerta no dashboard financeiro sobre gastos elevados |
| Sync duplica eventos | Média | Detecção de duplicatas, sourceType tracking, syncToken incremental |

---

## 11. DECISÕES ARQUITETURAIS IMPORTANTES

1. **Rotinas como flag (não modelo novo)**: `isRoutine` no PlannerBlock reutiliza 100% do código existente
2. **Templates com tempo relativo**: `startTimeMin` + `durationMin` + `weekDay` (não datetime absoluto)
3. **Quick-add determinístico**: Parser regex pt-BR sem IA, ~40 keywords → 8 categorias
4. **Motor de regras transparente**: Todas as mensagens em linguagem suave, nenhum alerta é bloqueante
5. **Recurrence expansion in-memory**: NONE/DAILY/WEEKLY expandido no cliente e servidor sem cron jobs
6. **Check-in via DiaryEntry**: Reutiliza modelo existente, evita fragmentação de dados
7. **Web Audio API**: Sons gerados em runtime com oscillators/filters, sem arquivos de áudio
8. **Google Sync bidirecional**: extendedProperties nos eventos para rastrear metadata do app
9. **Health Export como webhook**: Modelo passivo (app recebe push, não faz poll)
10. **Financeiro como alerta de mania**: Dashboard focado em detectar padrão de gastos excessivos, não em gestão financeira completa
11. **PostgreSQL para prod, SQLite para dev**: Simplicidade local + robustez em produção
12. **Zod v4 runtime validation**: Compensa falta de enums nativos no SQLite

---

## 12. DOCUMENTAÇÃO DO PROJETO (pasta /docs)

| Documento | Conteúdo |
|-----------|---------|
| 00-visao.md | Missão, princípios, declaração importante, funcionalidades, visão de futuro |
| 01-tese-da-empresa.md | Tese do negócio |
| 02-personas.md | Personas do produto |
| 03-proposta-de-valor.md | Proposta de valor |
| 04-riscos-e-mitigacoes.md | 16 riscos mapeados com mitigações |
| 05-compliance-checklist-mvp.md | Checklist LGPD |
| 06-prd-mvp.md | PRD completo (funcionalidades, métricas, restrições) |
| 07-backlog.md | 86+ user stories em 13+ épicos |
| 08-politica-de-moderacao-e-crise.md | Política de moderação e gestão de crise |
| 09-changelog.md | Changelog v1.0.0 → v3.2.0 |

---

## 13. MÉTRICAS DE SUCESSO DEFINIDAS

| Métrica | Meta |
|---------|------|
| Usuários cadastrados | Validar fluxo funcional |
| Blocos criados por semana | >= 5 |
| Check-ins 30s por semana | >= 3 |
| Regularidade de âncoras (IPSRT) | Monitorar tendência |
| Registros no diário por semana | >= 2 |
| Exercícios realizados por semana | >= 1 |
| Syncs Google Calendar realizados | Monitorar adoção |
| Imports de CSV financeiro | Monitorar adoção |

---

## 14. BUGS CONHECIDOS / ISSUES ATUAIS

1. **Conflitos duplicados no planejador** — Muitos itens "Conflito" aparecendo no calendário semanal (visível na tela, possivelmente relacionado ao sync do Google Calendar gerando duplicatas ou ao motor de regras detectando conflitos entre blocos recorrentes e importados)
2. **8 noites tardias na semana** — Motor de regras detectando atividades após o horário limite (21:00 default), pode indicar que eventos do Google Calendar importados estão sendo avaliados pelas regras de estabilidade

---

## 15. O QUE FALTA / PRÓXIMOS PASSOS POSSÍVEIS

O backlog planejado original (86 stories) está 100% completo. Direções futuras:

### Alta Prioridade
- **Resolver conflitos/duplicatas no planejador** — investigar e corrigir
- **Testes automatizados** (unitários + integração) — cobertura crítica
- **Deploy em produção** (Vercel + Neon PostgreSQL)
- **PWA** (Progressive Web App) para experiência mobile

### Média Prioridade
- **Testes de usabilidade** com usuários reais
- **Revisão por profissional de saúde mental** do conteúdo educacional
- **Acessibilidade (a11y)** — audit com axe-core
- **Notificações push** (substituir Notification API por Web Push)
- **Backup/export de dados** para o usuário

### Baixa Prioridade
- **Internacionalização** (i18n) para outros idiomas
- **Modo offline** com Service Worker
- **Modo escuro** (classificado como Won't no backlog atual)

---

## 16. CONTEXTO DE DESENVOLVIMENTO

- **Ferramenta de desenvolvimento**: Claude Code (CLI) com modelo Claude Opus 4.6
- **Metodologia**: Commits atômicos, lint + build verificados
- **Tempo total**: ~4 dias (24-27/fev/2026)
- **Conta de teste**: julio.yamada@teste.com / Julio2026!
- **Repositório**: https://github.com/yamadajulio-ai/Bipolar.git
- **Database prod**: PostgreSQL via Neon

---

*Documento gerado em 27/02/2026 para análise externa do estado completo do projeto Empresa Bipolar.*

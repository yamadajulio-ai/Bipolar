# Suporte Bipolar — Visão Geral da Arquitetura

## 1. Visão Geral

O **Suporte Bipolar** é uma aplicação web/PWA voltada a brasileiros com transtorno bipolar, construída sobre **Next.js 15** (App Router, React 19, Server Components). A aplicação segue o padrão mobile-first e está sendo preparada para distribuição nativa via **Capacitor** (iOS App Store). Toda a lógica de servidor roda em **Vercel Pro** (serverless), com banco de dados **PostgreSQL** hospedado no **Neon** e acessado exclusivamente pelo ORM **Prisma**. O domínio de produção (`suportebipolar.com`) está protegido por **Cloudflare Pro** (proxy ON, WAF, SSL Full Strict).

A arquitetura é monolítica por escolha deliberada: front-end, API routes e lógica de negócio coexistem no mesmo repositório Next.js. Isso simplifica o deploy (push → auto-deploy Vercel) e mantém type-safety end-to-end com **TypeScript** e **Zod**. O único serviço externo fora do monolito é um **Cloudflare Worker** (`hae-proxy`) que faz proxy de dados do Apple Health via Health Auto Export.

O projeto possui ~303 arquivos TypeScript/TSX em `src/`, ~44 modelos Prisma no schema (853 linhas), 33 páginas autenticadas, e uma suíte de **1.188 testes** (1.176 Vitest + 12 Playwright E2E). A narrativa de IA utiliza **GPT-5.4** (OpenAI Responses API) com Structured Outputs e 4 camadas de guardrails, nunca armazenando dados do usuário na OpenAI (`store: false`, LGPD).

A segurança é multicamada: CSRF double-submit cookie, CSP enforced, step-up auth, rate limiting atômico no banco, sessão iron-session com idle/absolute/sliding, HSTS preload e Sentry com PII scrubbing. O consent center gerencia 11 escopos LGPD com versionamento.

O sistema de insights é o módulo mais complexo: `computeInsights.ts` (2.585 linhas) calcula termômetro de humor (EWMA), social jet lag, cycling analysis, episode prediction, stability score (4 componentes ponderados), correlações Spearman e heatmaps. SafetyNudge implementa triggers clínicos multi-nível (SAMU 192, CVV 188, CAPS/UBS) baseados em PHQ-9, risco misto e padrões de sono.

## 2. Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 15 (App Router, Server Components, React 19) |
| **Linguagem** | TypeScript 5, Zod 4 (validação runtime) |
| **Estilização** | Tailwind CSS 4, PostCSS |
| **ORM / DB** | Prisma 6 + PostgreSQL (Neon serverless) |
| **Gráficos** | Recharts 3 |
| **Auth** | iron-session (encrypted cookies), Google OAuth, argon2/bcryptjs |
| **AI** | OpenAI SDK (GPT-5.4 Responses API), Anthropic SDK (legado) |
| **Push** | web-push (VAPID), Vercel Cron |
| **Mobile nativo** | Capacitor 8 (iOS — Face ID, APNs, haptics, share) |
| **Observabilidade** | Sentry (Next.js SDK, edge + server + client) |
| **Analytics** | Vercel Analytics + Speed Insights, Meta CAPI |
| **CDN / WAF** | Cloudflare Pro (proxy, rate limiting, WAF rules) |
| **Workers** | Cloudflare Workers Paid (HAE proxy) |
| **Backup** | Cloudflare R2 (`suporte-bipolar-backups`) |
| **Testes** | Vitest 4, Playwright 1.58 |
| **Lint / Format** | ESLint 9, Prettier 3 |
| **Deploy** | Vercel Pro (push main → auto-deploy) |
| **Content** | Markdown (gray-matter + remark + rehype) |
| **Conteúdo** | xlsx (importação financeira) |
| **Markdown** | remark → rehype-sanitize → rehype-stringify |
| **Telefonia** | libphonenumber-js (WhatsApp E.164) |

## 3. Mapa de Pastas

```
├── prisma/
│   └── schema.prisma            # 44 modelos, 853 linhas — fonte de verdade do banco
├── src/
│   ├── app/
│   │   ├── (app)/               # 33 páginas autenticadas (hoje, checkin, sono, insights, etc.)
│   │   ├── (auth)/              # Login, cadastro, recuperação de senha
│   │   ├── (public)/            # Landing pages, ferramentas SEO, termos, privacidade
│   │   └── api/                 # ~40 route handlers (REST, cron jobs, webhooks)
│   ├── components/              # 16 pastas de componentes React (admin, charts, sos, insights…)
│   ├── lib/                     # Lógica de negócio pura e utilitários
│   │   ├── ai/                  # Narrativa AI (generateNarrative, guardrails, public-evidence)
│   │   ├── insights/            # computeInsights.ts (2.585 linhas) — motor analítico principal
│   │   ├── financeiro/          # Lógica financeira (gastos × humor)
│   │   ├── diary/               # Processamento de diário
│   │   ├── journal/             # Journaling terapêutico
│   │   ├── planner/             # Calendário de estabilidade (IPSRT)
│   │   ├── integrations/        # Health Connect, Health Auto Export
│   │   ├── google/              # Google Calendar sync, OAuth tokens (AES-256-GCM)
│   │   ├── capacitor/           # Bridge Capacitor ↔ web (biometria, notifications)
│   │   ├── auth.ts              # Sessão iron-session, getSession helper
│   │   ├── security.ts          # CSRF, rate limiting, IP masking
│   │   ├── dateUtils.ts         # Timezone America/Sao_Paulo — contrato formal do projeto
│   │   ├── streaks.ts           # Grace vs strict vs longest streak
│   │   ├── web-push.ts          # VAPID push notifications
│   │   ├── whatsapp.ts          # WhatsApp Business Cloud API
│   │   └── constants.ts         # Warning signs, thresholds, feature flags
│   └── middleware.ts            # Auth guards, CSRF validation, landing redirects (199 linhas)
├── content/
│   ├── biblioteca/              # Artigos psicoeducativos em Markdown
│   └── cursos/                  # Cursos estruturados (lições em Markdown)
├── docs/                        # Documentação de produto (PRD, personas, compliance, changelog)
├── e2e/                         # Playwright E2E (middleware smoke tests)
├── workers/
│   └── hae-proxy/               # Cloudflare Worker — proxy Apple Health (HAE)
├── public/                      # Assets estáticos, SW, manifest, OG images
├── scripts/                     # Scripts utilitários (geração de stories, etc.)
├── sentry.*.config.ts           # Configuração Sentry (client, server, edge)
├── next.config.ts               # CSP enforced, HSTS, security headers, Sentry wrapping
├── capacitor.config.ts          # Configuração Capacitor iOS
├── vitest.config.ts             # Configuração Vitest
├── playwright.config.ts         # Configuração Playwright
└── vercel.json                  # Overrides de deploy Vercel
```

## 4. Fluxo de Dados

### 4.1. Fluxo principal (usuário → app → banco)

```
iPhone (PWA/Capacitor)
  ↓ HTTPS (Cloudflare Pro WAF → Vercel Edge)
  ↓
middleware.ts — auth guard, CSRF validation, landing redirects
  ↓
Server Components (RSC) — fetch dados via Prisma no servidor
  ↓ hydration
Client Components — interação do usuário (formulários, gráficos Recharts)
  ↓ fetch / POST
API Route Handlers (src/app/api/**)
  ↓ Zod validation + session check + rate limiting
Prisma Client → PostgreSQL (Neon)
```

### 4.2. Narrativa AI

```
Client (InsightsNarrative) → POST /api/insights-narrative
  ↓ consent check (sos_chatbot / ai_narrative scope)
  ↓ coleta de dados (sono, humor, medicação, planner) via Prisma
  ↓ monta prompt com contexto clínico
  ↓ OpenAI Responses API (GPT-5.4, Structured Outputs, store:false)
  ↓ Zod parse + 17 forbidden patterns + text normalization
  ↓ high-risk bypass (riskLevel atencao_alta → template fixo)
  ↓ salva Narrative no banco
Client ← JSON response
```

### 4.3. Push Notifications

```
Vercel Cron (cada X min) → GET /api/cron/send-reminders
  ↓ busca PushSubscription + ReminderSettings (privacyMode)
  ↓ web-push VAPID → navegador/dispositivo
  ↓ error taxonomy: 410 (cleanup), 429 (retry), 400 (strike → 3 strikes delete)
```

### 4.4. Integrações de saúde

```
Apple Health → Health Auto Export (HAE) app
  ↓ POST webhook
Cloudflare Worker (hae-proxy) → rewrite → /api/integrations/health-export
  ↓ parse + validação
Prisma → HealthMetric (HRV, heart rate, steps, etc.)

Android Wearable → Health Connect Webhook
  ↓ POST /api/integrations/health-connect
  ↓ parse + validação
Prisma → HealthMetric
```

### 4.5. WhatsApp Business

```
User ativa compartilhamento → wa.me deep link (share)
WhatsApp Cloud API → POST /api/whatsapp/webhook
  ↓ verificação de assinatura + consent 3-layer (LGPD art. 11 + art. 33)
  ↓ ProcessedWhatsAppMessage (idempotência)
  ↓ MessageLog (auditoria)
```

### 4.6. Acesso profissional

```
Profissional recebe link com token (24 bytes base64url)
  ↓ GET /api/acesso-profissional/[token]
  ↓ validação token + PIN + rate limit (IP 20/15min, token 10/15min)
  ↓ read-only dashboard com dados clínicos (LGPD SELECT minimal)
  ↓ AccessLog (auditoria de cada acesso)
```

## 5. Pontos Fortes de Arquitetura

1. **Type-safety end-to-end**: TypeScript + Prisma types + Zod validation em toda API route. Erros de tipo são capturados em compile-time, não em produção.

2. **Segurança multicamada robusta**: CSRF double-submit + Sec-Fetch-Site, CSP enforced (não report-only), step-up auth, rate limiting atômico no banco, iron-session encrypted, HSTS preload, IP masking /24+/64. O projeto demonstra maturidade rara para uma aplicação deste porte.

3. **LGPD nativa**: Consent center com 11 escopos versionados, `LGPD SELECT` em queries Prisma, `store: false` na OpenAI, DELETE endpoint para narrativas, export de dados, exclusão de conta com cascade. Não é um afterthought — está no DNA da arquitetura.

4. **Motor de insights sofisticado**: `computeInsights.ts` implementa análises clínicas reais (EWMA, Spearman, social jet lag, cycling detection, episode prediction, stability score composto) com thresholds baseados em literatura (IPSRT, ISBD, PROMAN/USP).

5. **AI com guardrails clínicos**: 4 camadas de proteção na narrativa (Structured Outputs + Zod + forbidden patterns + high-risk bypass), garantindo que a IA nunca faça afirmações diagnósticas diretas.

6. **Suíte de testes abrangente**: 1.188 testes (unit + E2E) com cobertura especial em SOS/crise (456 testes), guardrails de IA (339 testes) e middleware de segurança (Playwright smoke).

7. **PWA production-ready**: Service Worker v2 com 3 caches, update toast, iOS install banner, offline page com CVV 188 (recurso de crise sempre acessível).

8. **Timezone como contrato formal**: `America/Sao_Paulo` explícito em todo cálculo de data, com funções dedicadas (`localDateStr`, `localToday`), evitando bugs sutis de timezone em servidor UTC.

9. **Monolito bem organizado**: Route groups `(app)`, `(auth)`, `(public)` separam claramente domínios. A `lib/` isola lógica de negócio dos componentes React.

10. **Infraestrutura resiliente**: Cloudflare Pro (WAF + rate limiting na borda), Vercel Pro (auto-scaling), Neon (serverless PostgreSQL), R2 backups, Sentry observability.

## 6. Problemas e Riscos Técnicos

### 6.1. Complexidade concentrada — `computeInsights.ts` (2.585 linhas)
- **Arquivo**: `src/lib/insights/computeInsights.ts`
- **Risco**: God file. Concentra termômetro, jet lag, cycling, prediction, heatmap, stability score, streaks e correlações num único arquivo. Dificulta manutenção, code review e testes isolados.
- **Impacto**: Alto. Qualquer mudança em uma análise pode introduzir regressões em outras.

### 6.2. Modelo `DailyRhythm` órfão no schema
- **Arquivo**: `prisma/schema.prisma` (linhas 176-191)
- **Risco**: O CLAUDE.md documenta que "Rotina/Ritmo foi removido" e os componentes foram deletados, mas o modelo Prisma permanece. Tabela fantasma no banco, migrations desnecessárias, confusão para novos desenvolvedores.

### 6.3. Dualidade argon2 + bcryptjs para hashing de senha
- **Arquivos**: `package.json` (ambos como dependências)
- **Risco**: Dois algoritmos de hashing competindo. Se não há uma migração explícita de bcrypt → argon2, pode haver inconsistência em senhas existentes vs. novas. Superfície de manutenção duplicada.

### 6.4. JSON em campos `String` do Prisma (denormalization)
- **Arquivos**: `CrisisPlan.trustedContacts`, `CrisisPlan.copingStrategies`, `DiaryEntry.warningSigns`, `SleepLog.preRoutine`, etc.
- **Risco**: Perda de type-safety no banco, impossibilidade de queries/filtros SQL nesses campos, risco de dados malformados. Em PostgreSQL, `Json` ou `JsonB` nativo do Prisma seria mais adequado.

### 6.5. Middleware monolítico crescente
- **Arquivo**: `src/middleware.ts` (199 linhas, tendência de crescimento)
- **Risco**: Lista de `protectedPaths` hardcoded, lógica CSRF, redirects e guards no mesmo arquivo. À medida que novas rotas surgem, a manutenção se torna frágil (esquecer de adicionar uma rota = falha de segurança silenciosa).

### 6.6. Ausência de caching layer
- **Risco**: Todas as API routes fazem queries diretas ao Neon sem cache intermediário. Para dados que mudam pouco (conteúdo Markdown, configurações, cursos), não há ISR, Redis, ou `unstable_cache`. O `Cache-Control: no-store` em todas as APIs é correto para dados pessoais, mas páginas públicas (`/ferramentas/*`, `/para-profissionais`) poderiam ser cacheadas.

### 6.7. Testes E2E mínimos (12 Playwright)
- **Risco**: A suíte E2E cobre apenas middleware smoke. Fluxos críticos como check-in, registro de sono, avaliação semanal e SOS não têm cobertura E2E. Unit tests são fortes, mas não capturam problemas de integração real.

### 6.8. Schema Prisma com 44 modelos sem domínio separado
- **Arquivo**: `prisma/schema.prisma` (853 linhas, arquivo único)
- **Risco**: Acoplamento conceitual. Modelos de domínios distintos (financeiro, sono, SOS, planner, WhatsApp, cognitivo) compartilham um único schema sem separação lógica. Prisma não suporta multi-schema nativamente, mas comentários delimitadores e organização poderiam melhorar a legibilidade.

### 6.9. Dependência do Anthropic SDK sem uso aparente
- **Arquivo**: `package.json` — `@anthropic-ai/sdk` listado como dependência
- **Risco**: Se a migração para OpenAI GPT-5.4 foi concluída, o SDK Anthropic é peso morto (~dependência sem uso). Aumenta o tamanho do bundle e superfície de vulnerabilidades.

### 6.10. Proliferação de prompts/documentos na raiz
- **Arquivos**: `prompt-gpt-*.md` (12+ arquivos), `ANALISE-COMPLETA-*.md`, `RELATORIO-*.md`, imagens WhatsApp
- **Risco**: Poluição do diretório raiz. Esses arquivos não são código nem documentação de produto — são artefatos de processo. Dificultam a navegação e inflam o repositório git.

## 7. Sugestões de Melhoria (Alto Nível)

### Alta Prioridade

1. **Decompor `computeInsights.ts`** — Extrair cada análise (thermometer, jetLag, cycling, prediction, stabilityScore, heatmap, correlations) em módulos separados dentro de `src/lib/insights/`. Manter um barrel file `computeInsights.ts` que orquestra. Isso facilita testes unitários por análise e reduz blast radius de mudanças.

2. **Inverter a lógica de rotas protegidas no middleware** — Em vez de allowlist (`protectedPaths`), usar denylist: tudo é protegido por padrão, exceto rotas explicitamente públicas. Isso elimina o risco de esquecer de proteger uma nova rota.

3. **Expandir cobertura E2E** — Adicionar Playwright tests para os 5 fluxos mais críticos: check-in diário, registro de sono, avaliação semanal (PHQ-9 + ASRM), ativação de SOS e fluxo de login/cadastro. Meta: 30-50 E2E tests.

4. **Limpar modelos órfãos do Prisma** — Criar migration para remover `DailyRhythm` (e confirmar se a tabela está vazia em produção antes). Remover referências residuais no schema.

5. **Unificar hashing de senha** — Escolher argon2 (mais seguro, recomendação OWASP) e migrar lazy: ao login, se o hash é bcrypt, re-hash com argon2. Remover bcryptjs após migração completa.

### Média Prioridade

6. **Migrar campos JSON string para `Json` nativo do Prisma** — Usar `Json` type para `trustedContacts`, `copingStrategies`, `warningSigns`, `preRoutine`. Adicionar validação Zod no read. Isso habilita queries JSON no PostgreSQL e melhora type-safety.

7. **Adicionar caching em páginas públicas** — Usar ISR (`revalidate`) ou `generateStaticParams` para `/ferramentas/*`, `/para-profissionais`, `/conteudos/*`. Essas páginas raramente mudam e podem ser servidas como static.

8. **Organizar artefatos de processo** — Mover `prompt-gpt-*.md`, imagens WhatsApp e relatórios para uma pasta `_internal/` ou `.archive/` e adicioná-la ao `.gitignore` (ou a um repo separado de documentação).

9. **Remover dependência Anthropic SDK** — Se a migração AI → OpenAI está completa, remover `@anthropic-ai/sdk` do `package.json`. Reduz bundle size e superfície de supply chain.

10. **Separar schema Prisma com comentários de domínio** — Agrupar os 44 modelos em seções claras com separadores (`// ── Auth & User`, `// ── Sleep`, `// ── Financial`, `// ── SOS & Crisis`, etc.). Alguns já existem — padronizar para todos.

### Baixa Prioridade

11. **Considerar edge runtime para rotas leves** — API routes de leitura simples (health check, display-preferences) poderiam rodar no edge runtime do Vercel para menor latência. Avaliar compatibilidade com Prisma (Neon driver adapter).

12. **Implementar feature flags tipados** — `src/lib/featureFlags.ts` existe mas parece básico. Para a complexidade do projeto (Capacitor, WhatsApp, AI), um sistema de feature flags mais robusto (mesmo que simples, baseado em env vars tipadas) permitiria rollouts graduais.

13. **Documentar ADRs (Architecture Decision Records)** — Decisões como "por que monolito", "por que iron-session e não NextAuth", "por que GPT-5.4 e não Claude" estão espalhadas no CLAUDE.md. ADRs formais em `docs/adr/` preservariam o contexto para futuros mantenedores.

14. **Adicionar health check no banco** — A rota `/api/health` existe, mas verificar se testa conectividade real com o Neon (um `SELECT 1`). Útil para monitoramento Cloudflare e alertas de downtime do banco.

---

*Documento gerado em 2026-03-23 com base na análise completa do repositório.*

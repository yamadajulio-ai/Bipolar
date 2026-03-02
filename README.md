# Rede Bipolar

Plataforma educacional e de auto-organização para pessoas com Transtorno Afetivo Bipolar e suas famílias.

> **Este aplicativo NÃO substitui tratamento médico ou psicológico.**
> Em crise ou risco imediato: **CVV 188** | **SAMU 192** | **UPA 24h**

**Site:** [redebipolar.com](https://redebipolar.com) | [redebipolar.com.br](https://redebipolar.com.br)

## Sobre o projeto

O Rede Bipolar oferece:

- **Check-in 30s** — Humor, energia, ansiedade, irritabilidade, medicação e sinais de alerta
- **Diário Expandido** — Registro diário completo com humor (1-5), sono, energia, ansiedade, irritabilidade, adesão à medicação, sinais de alerta
- **Painel de Tendências** — Gráficos de humor/sono com recharts, alertas automáticos de padrões (7/30/90 dias)
- **Módulo de Sono** — Registro detalhado (horários, qualidade, despertares, rotina pré-sono), tendências
- **Calendário de Estabilidade** — Planejador semanal com sincronização Google Calendar, motor de regras transparente, orçamento de energia
- **Exercícios de Respiração** — 4-7-8 (insônia), quadrada (ansiedade), diafragmática (aterramento) com animação visual
- **Técnicas de Aterramento** — 5 sentidos (5-4-3-2-1), relaxamento muscular progressivo
- **Rastreador de Ritmo Social** — Baseado na IPSRT, monitora regularidade de horários-âncora
- **SOS de Crise** — Botão sempre visível, interface escura, respiração rápida, números de emergência
- **Plano de Crise Personalizado** — Contatos, profissional, medicamentos (só nomes), hospital, estratégias
- **Sons Ambiente** — Ruído branco/rosa/marrom, chuva (Web Audio API), timer de sono
- **Dashboard Inteligente** — Status do dia, mini-gráfico, sugestões contextuais, ações rápidas
- **Insights Clínicos** — 6 métricas de sono (média, regularidade, variabilidade, tendência, ponto médio circadiano, qualidade), humor (tendência, variabilidade, adesão medicação, sinais de alerta), ritmo social IPSRT com automação via PlannerBlock, correlação sono×humor (Pearson n≥14), alertas observacionais com encaminhamento profissional
- **Relatório Mensal** — Resumo imprimível para compartilhar com profissionais de saúde
- **Notícias e Estudos** — Feed atualizado do PubMed (artigos científicos, traduzidos automaticamente EN→PT-BR) e Google News (notícias PT-BR) sobre Transtorno Bipolar, cache de 1h
- **Cursos Estruturados** — 4 cursos com aulas sequenciais
- **Biblioteca Educacional** — 11+ artigos em pt-BR
- **Controle Financeiro** — Importação Mobills (CSV/XLSX), gráficos por categoria, correlação humor × gastos
- **Lembretes Gentis** — Notification API para rotina e registros
- **Área para Famílias** — Checklist e guia para familiares
- **PWA** — Instalável como app, offline fallback, service worker
- **Privacidade** — Dados de saúde tratados com cuidado (LGPD), exportação de dados (Art. 18)

## Integrações

| Integração | Descrição |
|------------|-----------|
| **Google Calendar** | Sync pull-only — eventos do Google aparecem automaticamente no planejador |
| **Google Sign-In** | Login com conta Google (OAuth 2.0) |
| **Mobills** | Importação CSV/XLSX de transações financeiras |
| **Apple Health** | Dados de sono via Health Auto Export (webhook + importação manual JSON) |
| **PubMed** | Artigos científicos sobre Transtorno Bipolar (API E-utilities, tradução automática EN→PT-BR) |
| **Google Translate** | Tradução automática de títulos PubMed (EN→PT-BR, fallback gracioso) |
| **Google News** | Notícias PT-BR sobre Transtorno Bipolar (RSS) |

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Prisma ORM** + SQLite (dev) / PostgreSQL Neon (prod)
- **iron-session** — sessões em cookies HttpOnly
- **bcryptjs** — hash de senhas
- **zod v4** — validação de dados
- **recharts** — gráficos e visualizações
- **googleapis** — Google Calendar + OAuth
- **xlsx (SheetJS)** — parser de planilhas Mobills
- **gray-matter + remark/rehype** — conteúdo markdown
- **Web Audio API** — sons ambiente (sem dependências externas)
- **Vitest** — testes unitários

## Requisitos

- Node.js 18+ (testado com Node 24)
- pnpm (ou npm)

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env e defina SESSION_SECRET, DATABASE_URL, GOOGLE_CLIENT_ID, etc.

# 3. Criar banco de dados
npx prisma migrate dev

# 4. Rodar em desenvolvimento
pnpm dev
```

O app estará disponível em [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Servidor de produção |
| `pnpm lint` | Verificação ESLint |
| `pnpm test` | Rodar testes (Vitest) |
| `npx prisma studio` | Interface visual do banco |
| `npx prisma migrate dev` | Rodar migrações |

## Estrutura do projeto

```
/docs/                   → Documentação de negócio/produto/compliance
/content/
  /biblioteca/           → Artigos educacionais em markdown
  /cursos/               → Cursos estruturados (subpastas com aulas)
/prisma/                 → Schema e migrações do banco
/public/                 → Manifest PWA, service worker, ícones, logos
/src/
  /app/
    /(public)/           → Landing, privacidade, termos
    /(auth)/             → Login, cadastro
    /(app)/              → Área autenticada:
      /app/              → Dashboard inteligente
      /hoje/             → Tela "Hoje" (autopiloto do dia)
      /planejador/       → Calendário de estabilidade (Google Calendar sync)
      /checkin/          → Check-in 30 segundos
      /insights/         → Insights de estabilidade
      /diario/           → Diário expandido + tendências
      /sono/             → Módulo de sono + tendências
      /exercicios/       → Respiração e aterramento
      /rotina/           → Rastreador de ritmo social (IPSRT)
      /sos/              → SOS de crise interativo
      /sons/             → Sons ambiente (Web Audio API)
      /conteudos/        → Biblioteca educacional
      /cursos/           → Cursos estruturados
      /noticias/         → Feed de notícias e estudos científicos
      /financeiro/       → Controle financeiro + importação Mobills
      /plano-de-crise/   → Plano de crise personalizado
      /familias/         → Guia para familiares
      /relatorio/        → Relatório mensal
      /integracoes/      → Google Calendar, Mobills, Apple Health
      /conta/            → Conta + lembretes
      /mais/             → Menu de acesso a todos os módulos
    /api/                → API routes (30+ endpoints)
  /lib/                  → Auth, DB, segurança, conteúdo, cursos, constantes
    /google/             → OAuth, Calendar API, sync pull-only
    /financeiro/         → Parsers Mobills (CSV + XLSX)
    /planner/            → Motor de regras, recorrência, categorias
    /integrations/       → Health Auto Export webhook + importação manual
    /insights/           → Motor de insights clínicos (sono, humor, IPSRT)
  /components/           → 50+ componentes reutilizáveis
```

## Modelos de dados

| Modelo | Descrição |
|--------|-----------|
| User | Usuário (email, senha, Google OAuth, nome) |
| DiaryEntry | Registro expandido (humor, sono, energia, ansiedade, irritabilidade, medicação, sinais de alerta) |
| SleepLog | Registro de sono (horários, qualidade, despertares, rotina pré-sono) |
| ExerciseSession | Sessão de exercício (tipo, duração) |
| DailyRhythm | Ritmo social diário (horários-âncora IPSRT) |
| ReminderSettings | Configurações de lembretes |
| CrisisPlan | Plano de crise personalizado |
| CourseProgress | Progresso em cursos |
| ContentView | Visualização de conteúdo |
| PlannerBlock | Bloco de atividade (categoria, tipo, energia, estimulação, Google Calendar sync) |
| PlannerRecurrence | Recorrência de blocos (diária, semanal) |
| PlannerException | Exceção para ocorrências específicas |
| StabilityRule | Regras de estabilidade (horários, limites, proteção de âncoras) |
| GoogleAccount | Tokens OAuth do Google Calendar |
| IntegrationKey | Chaves API para webhooks externos |
| FinancialTransaction | Transações financeiras (manual ou importada do Mobills) |
| NewsArticle | Cache de notícias (PubMed + Google News, TTL 1h) |

## Segurança

- Senhas hasheadas com bcrypt (custo 12)
- Sessões em cookies HttpOnly, Secure, SameSite=Lax
- Rate limiting persistente no banco de dados (serverless-safe)
- Tokens OAuth Google criptografados em repouso (AES-256-GCM)
- Validação com zod em todas as APIs
- SQL injection prevenido via Prisma ORM
- Security headers (CSP, X-Frame-Options, etc.)
- HTML sanitizado no markdown (rehype-sanitize)
- Sem dados sensíveis em logs
- Exportação LGPD (Art. 18) — download JSON de todos os dados do usuário

## Princípios éticos

- Não prometemos cura
- Não recomendamos medicação ou dosagem
- Não incentivamos privação de sono ou substâncias
- Sem gamificação (streaks, rankings, desafios, badges, pontos)
- Sem IA para recomendações clínicas
- Sempre incentivamos acompanhamento profissional
- Dados de saúde são sensíveis e tratados com cuidado (LGPD)
- Alertas são observacionais (sem termos diagnósticos) com encaminhamento profissional
- Exercícios incluem aviso para parar se sentir desconforto

## Documentação

Veja a pasta `/docs` para documentação completa:

- [Visão](docs/00-visao.md)
- [Tese da empresa](docs/01-tese-da-empresa.md)
- [Personas](docs/02-personas.md)
- [Proposta de valor](docs/03-proposta-de-valor.md)
- [Riscos e mitigações](docs/04-riscos-e-mitigacoes.md)
- [Compliance checklist](docs/05-compliance-checklist-mvp.md)
- [PRD](docs/06-prd-mvp.md)
- [Backlog](docs/07-backlog.md)
- [Política de moderação e crise](docs/08-politica-de-moderacao-e-crise.md)
- [Changelog](docs/09-changelog.md)

## Licença

Projeto privado. Todos os direitos reservados.

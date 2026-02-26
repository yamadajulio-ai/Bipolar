# Empresa Bipolar

Plataforma educacional e de auto-organização para pessoas com Transtorno Afetivo Bipolar tipo 1 (TAB1) e suas famílias.

> **Este aplicativo NÃO substitui tratamento médico ou psicológico.**
> Em crise ou risco imediato: **CVV 188** | **SAMU 192** | **UPA 24h**

## Sobre o projeto

O Empresa Bipolar oferece:

- **Diário Expandido** — Humor (1-5), sono, energia, ansiedade, irritabilidade, adesão à medicação, sinais de alerta
- **Painel de Tendências** — Gráficos de humor/sono com recharts, alertas automáticos de padrões
- **Módulo de Sono** — Registro detalhado (horários, qualidade, despertares, rotina pré-sono), tendências
- **Exercícios de Respiração** — 4-7-8 (insônia), quadrada (ansiedade), diafragmática (aterramento) com animação visual
- **Técnicas de Aterramento** — 5 sentidos (5-4-3-2-1), relaxamento muscular progressivo
- **Rastreador de Ritmo Social** — Baseado na IPSRT, monitora regularidade de horários-âncora
- **SOS de Crise** — Botão sempre visível, interface escura, respiração rápida, números de emergência
- **Plano de Crise Personalizado** — Contatos, profissional, medicamentos (só nomes), hospital, estratégias
- **Sons Ambiente** — Ruído branco/rosa/marrom, chuva (Web Audio API), timer de sono
- **Dashboard Inteligente** — Status do dia, mini-gráfico, sugestões contextuais, ações rápidas
- **Relatório Mensal** — Resumo imprimível para compartilhar com profissionais de saúde
- **Cursos Estruturados** — 4 cursos com aulas sequenciais sobre TAB1
- **Biblioteca Educacional** — 11+ artigos sobre TAB tipo 1 em pt-BR
- **Lembretes Gentis** — Notification API para rotina e registros
- **Área para Famílias** — Checklist e guia para familiares
- **Privacidade** — Dados de saúde tratados com cuidado (LGPD)

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Prisma ORM** + SQLite (dev) / PostgreSQL (prod)
- **iron-session** — sessões em cookies HttpOnly
- **bcryptjs** — hash de senhas
- **zod v4** — validação de dados
- **recharts** — gráficos e visualizações
- **gray-matter + remark/rehype** — conteúdo markdown
- **Web Audio API** — sons ambiente (sem dependências externas)

## Requisitos

- Node.js 18+ (testado com Node 24)
- pnpm (ou npm)

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env e defina SESSION_SECRET com pelo menos 32 caracteres

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
| `npx prisma studio` | Interface visual do banco |
| `npx prisma migrate dev` | Rodar migrações |

## Estrutura do projeto

```
/docs/                   → Documentação de negócio/produto/compliance
/content/
  /biblioteca/           → Artigos educacionais em markdown
  /cursos/               → Cursos estruturados (subpastas com aulas)
/prisma/                 → Schema e migrações do banco
/src/
  /app/
    /(public)/           → Landing, privacidade, termos
    /(auth)/             → Login, cadastro
    /(app)/              → Área autenticada:
      /app/              → Dashboard inteligente
      /diario/           → Diário expandido + tendências
      /sono/             → Módulo de sono + tendências
      /exercicios/       → Respiração e aterramento
      /rotina/           → Rastreador de ritmo social
      /sos/              → SOS de crise interativo
      /sons/             → Sons ambiente (Web Audio API)
      /conteudos/        → Biblioteca educacional
      /cursos/           → Cursos estruturados
      /plano-de-crise/   → Plano de crise personalizado
      /familias/         → Guia para familiares
      /relatorio/        → Relatório mensal
      /conta/            → Conta + lembretes
    /api/                → API routes
  /lib/                  → Auth, DB, segurança, conteúdo, cursos, constantes
  /components/           → Componentes reutilizáveis
    /charts/             → Componentes recharts
    /exercicios/         → Breathing circle, timer, grounding guide
    /sos/                → SOS panel, quick breathing
    /dashboard/          → Dashboard cards e gráficos
    /sons/               → Sound player (Web Audio API)
    /relatorio/          → Relatório mensal
```

## Modelos de dados

| Modelo | Descrição |
|--------|-----------|
| User | Usuário (email, hash senha) |
| DiaryEntry | Registro expandido (humor, sono, energia, ansiedade, irritabilidade, medicação, sinais de alerta) |
| SleepLog | Registro de sono (horários, qualidade, despertares, rotina pré-sono) |
| ExerciseSession | Sessão de exercício (tipo, duração) |
| DailyRhythm | Ritmo social diário (horários-âncora) |
| ReminderSettings | Configurações de lembretes |
| CrisisPlan | Plano de crise personalizado |
| CourseProgress | Progresso em cursos |
| ContentView | Visualização de conteúdo |

## Segurança

- Senhas hasheadas com bcrypt (custo 12)
- Sessões em cookies HttpOnly, Secure, SameSite=Lax
- Rate limiting no login (5 tentativas / 15 min)
- Validação com zod em todas as APIs
- SQL injection prevenido via Prisma ORM
- Security headers (CSP, X-Frame-Options, etc.)
- HTML sanitizado no markdown (rehype-sanitize)
- Sem dados sensíveis em logs

## Princípios éticos

- Não prometemos cura
- Não recomendamos medicação ou dosagem
- Não incentivamos privação de sono ou substâncias
- Sem gamificação (streaks, rankings, desafios, badges, pontos)
- Sempre incentivamos acompanhamento profissional
- Dados de saúde são sensíveis e tratados com cuidado
- Alertas automáticos sempre incluem disclaimer profissional
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

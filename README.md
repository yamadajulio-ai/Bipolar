# Empresa Bipolar

Plataforma educacional e de auto-organização para pessoas com Transtorno Afetivo Bipolar tipo 1 (TAB1) e suas famílias.

> **Este aplicativo NÃO substitui tratamento médico ou psicológico.**
> Em crise ou risco imediato: **CVV 188** | **SAMU 192** | **UPA 24h**

## Sobre o projeto

O Empresa Bipolar oferece:

- **Diário de Humor e Sono** — Registre humor (1-5) e horas de sono diariamente
- **Biblioteca Educacional** — 10+ artigos sobre TAB tipo 1 em pt-BR
- **Plano de Crise** — Orientações e recursos de emergência no Brasil
- **Área para Famílias** — Checklist e guia para familiares
- **Privacidade** — Dados de saúde tratados com cuidado (LGPD)

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Prisma ORM** + SQLite (dev) / PostgreSQL (prod)
- **iron-session** — sessões em cookies HttpOnly
- **bcryptjs** — hash de senhas
- **zod** — validação de dados
- **gray-matter + remark/rehype** — conteúdo markdown

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
/docs/              → Documentação de negócio/produto/compliance
/content/biblioteca → Artigos educacionais em markdown
/prisma/            → Schema e migrações do banco
/src/
  /app/
    /(public)/      → Landing, privacidade, termos
    /(auth)/        → Login, cadastro
    /(app)/         → Área autenticada (diário, conteúdos, crise, famílias)
    /api/           → API routes (auth, diário)
  /lib/             → Auth, DB, segurança, conteúdo
  /components/      → Componentes reutilizáveis
```

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
- Sem gamificação (streaks, rankings, desafios)
- Sempre incentivamos acompanhamento profissional
- Dados de saúde são sensíveis e tratados com cuidado

## Documentação

Veja a pasta `/docs` para documentação completa:

- [Visão](docs/00-visao.md)
- [Tese da empresa](docs/01-tese-da-empresa.md)
- [Personas](docs/02-personas.md)
- [Proposta de valor](docs/03-proposta-de-valor.md)
- [Riscos e mitigações](docs/04-riscos-e-mitigacoes.md)
- [Compliance checklist](docs/05-compliance-checklist-mvp.md)
- [PRD MVP](docs/06-prd-mvp.md)
- [Backlog](docs/07-backlog.md)
- [Política de moderação e crise](docs/08-politica-de-moderacao-e-crise.md)

## Licença

Projeto privado. Todos os direitos reservados.

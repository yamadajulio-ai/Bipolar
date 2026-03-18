# Suporte Bipolar — Projeto

## Budget
- **Budget total: $10.000 USD** — Priorizar QUALIDADE sempre, sem economizar em soluções.

## Stack
- Next.js 15 (App Router, Server Components)
- TypeScript, Tailwind CSS
- Prisma + PostgreSQL (Neon)
- Recharts para gráficos
- Deploy: Vercel
- Integrações: Apple Health via Health Auto Export (HAE) + Cloudflare Worker proxy

## Público-alvo
- Brasileiros com transtorno bipolar
- Uso principal via iPhone (mobile-first)
- Idioma: pt-BR

## Princípios
- Baseado em protocolos IPSRT e pesquisas do PROMAN/USP
- Linguagem clínica cuidadosa — nunca fazer afirmações diagnósticas diretas
- "Não substitui avaliação profissional" em toda comunicação clínica

## Modo de Trabalho
- **Sempre começar pela ordem que faz mais sentido lógico** — não perguntar ao usuário por onde começar. Priorizar: P0 (bugs/segurança) → P1 (UX/copy críticos) → P2 (melhorias) → P3 (polimento).
- Fazer direto, não pedir permissão nem dar instruções.
- **NUNCA implementar features novas sem auditoria do GPT Pro antes.** Toda feature nova deve ser planejada, auditada e aprovada pelo GPT Pro antes de qualquer código ser escrito. Isso garante qualidade e alinhamento com o padrão do projeto.
- **NUNCA dar sugestão/opinião própria pura.** Sempre consultar o modelo mais avançado disponível (o3 da OpenAI via API) para análise e recomendação. O usuário quer a melhor qualidade possível e confia na análise de modelos especializados.

## Regras de Dados — Sono
- **Cochilo**: registro < 1h → exibido no histórico (tag "cochilo", roxo) mas **excluído** das métricas
- **Sono real**: registro >= 1h → incluído em todas as métricas (média, regularidade, variabilidade, alertas, correlações)
- **Registro incompleto**: campo `excluded: true` no SleepLog → excluído de métricas/heatmap, visível no histórico (dimmed, tag "excluído"). Toggle via `PATCH /api/sono/excluir`. Registros 1-4.5h mostram tag "incompleto?" como sugestão.
- Todos os registros aparecem no histórico para revisão clínica
- Histórico configurável pelo usuário: 7, 15, 30 noites ou 3 meses (via `?noites=N`)

## Domínios
- **Produção**: suportebipolar.com (Vercel + Cloudflare DNS, proxy OFF)
- **Legacy**: redebipolar.com (ainda ativo)
- **HAE Worker**: hae-proxy on Cloudflare Workers → suportebipolar.com/api/integrations/health-export

## Insights — Arquitetura
- Página: `src/app/(app)/insights/page.tsx` (Server Component)
- Motor de cálculo: `src/lib/insights/computeInsights.ts`
- Gráfico: `src/components/planner/InsightsCharts.tsx` (Client Component)
- Seletor de período: `src/components/insights/NightHistorySelector.tsx` (Client Component)
- Dados buscados: 90 dias de sono (histórico), 30 dias de humor/ritmos/planner (insights)
- Timezone: America/Sao_Paulo

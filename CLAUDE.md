# Suporte Bipolar — Projeto

## Budget
- **Budget total: $10.000 USD** — Priorizar QUALIDADE sempre, sem economizar em soluções.

## Stack
- Next.js 15 (App Router, Server Components)
- TypeScript, Tailwind CSS
- Prisma + PostgreSQL (Neon)
- Recharts para gráficos
- Deploy: Vercel Pro ($20/mês)
- CDN/WAF: Cloudflare Pro ($20/ano, proxy ON, SSL Full strict)
- Workers: Cloudflare Workers Paid ($5/mês)
- Backup: Cloudflare R2 (bucket `suporte-bipolar-backups`)
- Integrações: Apple Health via Health Auto Export (HAE) + Cloudflare Worker proxy

## Público-alvo
- Brasileiros com transtorno bipolar
- Uso principal via iPhone (mobile-first)
- Idioma: pt-BR

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
- **NUNCA implementar features novas sem auditoria do GPT Pro antes.** Toda feature nova deve ser planejada, auditada e aprovada pelo GPT Pro antes de qualquer código ser escrito. Isso garante qualidade e alinhamento com o padrão do projeto.
- **NUNCA dar sugestão/opinião própria pura.** Sempre consultar o modelo mais avançado disponível (o3 da OpenAI via API) para análise e recomendação. O usuário quer a melhor qualidade possível e confia na análise de modelos especializados.
- **Prompts de auditoria GPT Pro**: Sempre exibir o conteúdo completo do prompt diretamente na conversa (output de texto), para o usuário copiar e colar manualmente no GPT Pro. NÃO salvar apenas em arquivo — sempre printar aqui.
- **Auto-revisão antes do GPT Pro**: Antes de montar o prompt de auditoria para o GPT Pro, o Claude DEVE fazer uma auto-análise crítica do próprio código implementado — revisar edge cases, segurança, cobertura de testes, robustez e possíveis lacunas. Corrigir o que encontrar ANTES de gerar o prompt. Isso otimiza tempo evitando que o GPT Pro aponte problemas que o Claude poderia ter pego sozinho.

## Clipboard (Windows)
- **NUNCA usar `type file | clip`** — corrompe caracteres UTF-8 (acentos viram lixo).
- Método correto para copiar texto UTF-8 para o clipboard:
  1. Salvar o conteúdo em arquivo `.txt` com encoding `utf-8-sig` (BOM).
  2. Usar PowerShell: `[System.IO.File]::ReadAllText("path", [System.Text.Encoding]::UTF8) | Set-Clipboard`
  3. Para verificar: usar `chcp 65001` antes de chamar PowerShell, ou setar `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` no script.

## Regras de Dados — Sono
- **Cochilo**: registro < 1h → exibido no histórico (tag "cochilo", roxo) mas **excluído** das métricas
- **Sono real**: registro >= 1h → incluído em todas as métricas (média, regularidade, variabilidade, alertas, correlações)
- **Registro incompleto**: campo `excluded: true` no SleepLog → excluído de métricas/heatmap, visível no histórico (dimmed, tag "excluído"). Toggle via `PATCH /api/sono/excluir`. Registros 1-4.5h mostram tag "incompleto?" como sugestão.
- Todos os registros aparecem no histórico para revisão clínica
- Histórico configurável pelo usuário: 7, 15, 30 noites ou 3 meses (via `?noites=N`)

## Domínios
- **Produção**: suportebipolar.com (Vercel Pro + Cloudflare Pro, proxy ON, SSL Full strict)
- **Legacy**: redebipolar.com (ainda ativo)
- **HAE Worker**: hae-proxy on Cloudflare Workers Paid → suportebipolar.com/api/integrations/health-export
- **Backups**: Cloudflare R2 bucket `suporte-bipolar-backups` (ENAM, Standard)

## Insights — Arquitetura
- Página: `src/app/(app)/insights/page.tsx` (Server Component)
- Motor de cálculo: `src/lib/insights/computeInsights.ts`
- Gráfico: `src/components/planner/InsightsCharts.tsx` (Client Component)
- Seletor de período: `src/components/insights/NightHistorySelector.tsx` (Client Component)
- Dados buscados: 90 dias de sono (histórico), 30 dias de humor/ritmos/planner (insights)
- Timezone: America/Sao_Paulo

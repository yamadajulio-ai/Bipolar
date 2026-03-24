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
- **Sono real**: registro >= 2h → incluído em todas as métricas (média, regularidade, variabilidade, alertas, correlações)
- **Registro incompleto**: campo `excluded: true` no SleepLog → excluído de métricas/heatmap, visível no histórico (dimmed, tag "excluído"). Toggle via `PATCH /api/sono/excluir`. Registros 1-4.5h mostram tag "incompleto?" como sugestão.
- **totalHours**: span completo bed→wake (inclui tempo acordado). **Não** subtrai awakenings.
- **awakeMinutes**: campo separado com minutos acordados durante o sono (detectados pelo wearable). Exibido no card: "Xmin acordado (relógio)".
- **Faixas de cor do histórico**: <1h roxo (cochilo) | <5h vermelho (crítico) | 5-6h âmbar (abaixo do ideal) | 6-7h neutro | >=7h verde (ideal)
- Todos os registros aparecem no histórico para revisão clínica
- Histórico configurável pelo usuário: 7, 15, 30 noites ou 3 meses (via `?noites=N`)

## iOS App Store — Estratégia B+
- **Abordagem**: Capacitor com WebView + Vercel backend + pilares nativos reais (GPT Pro audit: 7.7/10)
- **Pilares nativos**: Face ID/Keychain, APNs + Local Notifications, offline de crise, deep links + share
- **NÃO usar**: `server.url` em produção (Capacitor docs: só para dev), static export (refactor 40-60% inviável)
- **Apple Developer**: conta individual (Julio Cesar de Sousa Yamada), Enrollment ID 5J4DNRWRS2, compra 2026-03-19
- **Mac Mini M4**: comprado, a caminho — necessário para Xcode build + TestFlight
- **Review risks**: Guideline 4.2 (mitigado por native value), 1.4.1 (copy de suporte, não diagnóstico), demo account
- **Review Notes**: `docs/app-store-review-notes.md`

## AI Narrative — Modelo
- **Modelo atual**: GPT-5.4 via OpenAI Responses API (migrado de Claude Sonnet 4)
- **Structured Outputs**: JSON Schema nativo + Zod pós-parse + forbidden patterns (17 regras)
- **High-risk bypass**: riskLevel "atencao_alta" → template fixo, sem LLM
- **store: false** (LGPD: sem persistência na OpenAI)
- **Env var**: `OPENAI_NARRATIVE_MODEL` (default: gpt-5.4, permite canário com gpt-5.2)

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
- Dados buscados: 90 dias de sono (histórico), 30 dias de humor/planner (insights)
- Timezone: America/Sao_Paulo
- Mixed state risk boost: forte +3, provável +2 no risk score (ISBD: maior risco suicida)
- **Rotina/Ritmo removido** — feature descontinuada, DailyRhythm não é mais utilizado nos cálculos
- **Stability Score**: pesos 35/30/20/15 (sono/medicação/humor/estabilidade)
- **Sleep composite**: regularidade 30%, duração 30%, qualidade 25%, HRV 15% (sub-pesos redistribuídos se dado ausente)

## Security — Arquitetura
- **CSRF**: 2 camadas — Sec-Fetch-Site/Origin (middleware) + double-submit cookie (`__Host-csrf` + `X-CSRF-Token` header via `CsrfProvider` global interceptor)
- **CSP**: enforced (não report-only) — `Content-Security-Policy` no `next.config.ts`
- **Step-up auth**: ações sensíveis (delete account, export) exigem re-confirmação de senha (email users) ou sessão recente <5min (Google OAuth)
- **Session**: idle 7d + absolute 30d + sliding refresh 1h, iron-session encrypted, `Clear-Site-Data` no logout
- **Rate limiting**: DB-backed atômico (`$transaction`), per-endpoint
- **Sentry PII**: replays OFF, request data filtered, URL redaction, breadcrumb whitelist

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

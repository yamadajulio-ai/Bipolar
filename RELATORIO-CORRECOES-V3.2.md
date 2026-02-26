# Empresa Bipolar — Relatorio de Correcoes Criticas v3.2

**Data**: 26/02/2026
**Repositorio**: https://github.com/yamadajulio-ai/Bipolar.git (publico)
**Branch**: main
**Autor**: Julio Yamada + Claude Code (Claude Opus 4.6)

---

## Contexto

O ChatGPT Pro analisou o repositorio e identificou 5 bugs criticos que afetavam o uso diario da aplicacao. Os 5 bugs estao organizados em 4 secoes abaixo (Bug 2 agrupa 2 problemas relacionados: duplicatas no Diario + erro 500 no Sono, ambos resolvidos pela mesma estrategia de upsert). Todas as correcoes foram implementadas em 4 commits atomicos + 1 hotfix (v3.2.1), com lint e build passando em cada etapa.

**Nota sobre v3.2.1** (commit `7263bad`): Apos a primeira revisao do ChatGPT Pro, foram encontradas 7 instancias adicionais do padrao UTC e outros bugs menores. Todos foram corrigidos no hotfix. Resultado: **zero ocorrencias** de `toISOString().split("T")[0]` restantes no codebase (verificado via grep).

---

## Bugs Encontrados vs Correcoes Aplicadas

### Bug 1: Datas UTC — Check-in registrava no dia errado

**Problema**: 16+ instancias de `new Date().toISOString().split("T")[0]` geravam data UTC. Usuario fazendo check-in as 23h no Brasil (UTC-3) registrava no dia seguinte.

**Correcao** (commits `e7bfefb` + hotfix `7263bad`):
- Criado `src/lib/dateUtils.ts` com funcoes `localToday()` e `localDateStr()` que usam `getFullYear()/getMonth()/getDate()` (timezone local)
- Substituido em 25 arquivos: pages, APIs, componentes, planner engine
- Funcoes `startOfDay()`/`endOfDay()` para limites de dia
- Hotfix v3.2.1: corrigidas 7 instancias adicionais encontradas na segunda revisao (planejador, diario, insights, sono, rotina pages + WeekCloneModal + TemplatesManager)
- Removido sufixo UTC "Z" da URL de fetch no WeeklyView

**Status**: ✅ 100% corrigido — zero ocorrencias restantes (verificado via `grep toISOString().split`)

**Arquivos alterados**: 26 (25 corrigidos + 1 novo)

---

### Bug 2: Diario permitia duplicatas + Sono retornava 500 (2 sub-bugs)

**Problema**:
- `DiaryEntry` nao tinha `@@unique([userId, date])` — POST criava duplicatas
- `SleepLog` tinha unique mas usava `create()` — segunda submissao no mesmo dia retornava erro 500 generico

**Correcao** (commit `c859c6d`):
- Adicionado `@@unique([userId, date])` ao model DiaryEntry no Prisma schema
- Migration SQL: `CREATE UNIQUE INDEX "DiaryEntry_userId_date_key"`
- `POST /api/diario`: `create()` → `upsert()` com chave composta `userId_date`
- `POST /api/sono`: `create()` → `upsert()` com chave composta `userId_date`

**Resultado**: Segunda submissao no mesmo dia atualiza o registro existente ao inves de duplicar/crashar.

**Arquivos alterados**: 4 (schema + migration + 2 routes)

---

### Bug 3: Motor de recorrencia quebrado

**Problema** (4 sub-bugs):
1. **`interval` ignorado para WEEKLY+weekDays**: Recorrencia bi-semanal (interval=2) aparecia toda semana
2. **Limite de 400 iteracoes**: Blocos recorrentes antigos (>400 dias) sumiam completamente
3. **Cursor reset**: Linhas 67-78 do expandRecurrence.ts avancavam o cursor ate o range, depois resetavam pra blockStart, desperdicando computacao
4. **Codigo duplicado**: Mesma logica de expansao copiada em 4 arquivos (expandRecurrence, WeeklyView, TodayBlocks, templates/route)

**Correcao** (commit `4263b47` + hotfix `7263bad`):

Algoritmo reescrito de **cursor-based** para **range-based**:
```
Para cada dia em [rangeStart, rangeEnd]:
  DAILY:  daysSince % interval === 0
  WEEKLY+weekDays: weekday no set E weeksSince % interval === 0
  WEEKLY plain: mesmo weekday E weeksSince % interval === 0
```

- **Elimina limite de 400**: Itera apenas os dias do range (max 7 para semana, 31 para mes)
- **Interval funciona corretamente**: Usa aritmetica modular sobre daysSince/weeksSince
- **Sem cursor reset**: Comeca direto do max(rangeStart, blockStart)

Criado `src/lib/planner/expandClient.ts`:
- Interface `SerializedBlock` (blocos como JSON do API)
- `hydrate()` converte strings ISO para Date objects
- `expandSerializedBlocks()` — hidrata + expande (para uso em componentes client)

Refatoracoes:
- `WeeklyView.tsx`: removida `expandBlocksClient()` (~100 linhas) — usa `expandSerializedBlocks()`
- `TodayBlocks.tsx`: removida expansao manual (~90 linhas) — usa `expandSerializedBlocks()`

Hotfix v3.2.1 adicional:
- `applyException()`: corrigido bug de notes — `!== undefined` → `!= null` (null significava "nao definido", nao "limpar")
- `getOccsForDay()`: corrigido para usar `occurrenceDate === dayStr` ao inves de `toISOString().startsWith(dayStr)` (evita drift UTC)
- Smart defaults no BlockEditorModal: `Math.min(23, ...)` → `% 1440` (evita blocos de 24h ao cruzar meia-noite)

**Resultado liquido**: -190 linhas de codigo duplicado, +75 linhas de modulo compartilhado.

**Arquivos alterados**: 6 (expandRecurrence reescrito + expandClient novo + WeeklyView + TodayBlocks + BlockEditorModal + hotfix)

---

### Bug 4: Blocos que cruzam meia-noite

**Problema**: Bloco 23:00→01:00 era salvo com startAt=23:00 e endAt=01:00 **do mesmo dia**, resultando em duracao negativa (-22h ao inves de +2h).

**Correcao** (commit `ff15a2c`):
- `WeeklyView.handleSave()`: Se `endDate <= startDate`, adiciona 1 dia ao endAt
- `BlockEditorModal.tsx`: Indicador visual "Termina no dia seguinte (bloco cruza meia-noite)" quando endTime <= startTime

**Arquivos alterados**: 2

---

## Resumo Estatistico

| Metrica | Valor |
|---------|-------|
| Commits | 5 (4 originais + 1 hotfix v3.2.1) |
| Arquivos alterados | 30+ |
| Resultado liquido | Menos codigo, mais correto |
| Padrao UTC restante | 0 (verificado via grep) |
| Lint | Passa |
| Build | Passa (73 rotas, 0 erros) |

---

## Commits (na ordem)

```
e7bfefb fix: replace UTC toISOString date splits with local timezone dateUtils
c859c6d fix: add DiaryEntry unique constraint and use upserts for diary/sleep
4263b47 fix: rewrite recurrence engine with range-based algorithm
ff15a2c fix: handle blocks crossing midnight correctly
7263bad fix: remaining UTC instances, smart defaults wrap, getOccsForDay, applyException notes
```

---

## Arquivos-chave para revisao

| Arquivo | O que faz |
|---------|-----------|
| `src/lib/dateUtils.ts` | Funcoes centrais de data local (34 linhas) |
| `src/lib/planner/expandRecurrence.ts` | Motor de recorrencia range-based (156 linhas) |
| `src/lib/planner/expandClient.ts` | Hidratacao + expansao para client components (75 linhas) |
| `src/lib/planner/constraints.ts` | Alertas de estabilidade (125 linhas) |
| `prisma/schema.prisma` | Schema com DiaryEntry @@unique |
| `src/app/api/diario/route.ts` | POST com upsert |
| `src/app/api/sono/route.ts` | POST com upsert |
| `src/components/planner/WeeklyView.tsx` | Planejador semanal (sem codigo duplicado) |
| `src/components/planner/TodayBlocks.tsx` | Blocos de hoje (sem codigo duplicado) |
| `src/components/planner/BlockEditorModal.tsx` | Modal com indicador meia-noite |

---

## Stack atual

- Next.js 16.1.6 (Turbopack) + React 19 + TypeScript
- Prisma 6.19.2 + SQLite
- Zod v4 (validacao) + iron-session v8 (auth) + bcryptjs
- Tailwind CSS 4
- 126 arquivos fonte (.ts/.tsx)
- 73 rotas (app router)

---

## Pontos abertos para proxima revisao

### Prioridade A — Funcional
1. **Blocos overnight no "Hoje"** — O fetch do endpoint `/api/planner/blocks` usa `startAt >= timeMin AND startAt <= timeMax`, o que exclui blocos que comecaram ontem e terminam hoje (ex.: sono 23:00→07:00). Correcao: usar overlap (`startAt <= timeMax AND endAt >= timeMin`)
2. **`until` semantica** — `until` e DateTime no Prisma; se gravado como `T00:00:00`, pode excluir ocorrencia do proprio dia (cursor esta ao meio-dia). Tratar como `endOfDay(until)` na comparacao

### Prioridade B — Divida tecnica
3. **Templates/weekClone ainda duplicam expansao local** — usam loop manual ao inves do `expandAllBlocks` compartilhado (funciona, mas e codigo repetido no servidor)
4. **checkConstraintsClient no WeeklyView** — versao simplificada client-side duplica parte da logica de `constraints.ts` (servidor). Poderia ser unificada via API

### Prioridade C — Testes
5. **Testes automatizados** — nenhum teste unitario para o motor de recorrencia ou para as rotas API. Cenarios prioritarios:
   - expandRecurrence: DAILY interval 1/2/3, WEEKLY sem/com weekDays, interval 2, excecoes, until
   - dateUtils: horarios proximos de 23:00/00:30 em UTC-3
   - POST /api/diario e /api/sono: segundo POST atualiza, nao duplica

### Prioridade D — Seguranca
6. **Rate limiting** — APIs nao tem rate limiting (priorizar endpoints de escrita)
7. **CSRF** — iron-session protege via cookie, mas nao ha token CSRF explicito. Minimo: validar Origin/Referer + SameSite=Lax
8. **Timezone em producao** — Em deploy na Vercel, o server timezone pode ser UTC. A premissa de `dateUtils` ("server timezone == client timezone") precisa ser revisitada se for para producao

---

## Resultado da segunda revisao (ChatGPT Pro)

A segunda revisao do ChatGPT Pro encontrou os seguintes problemas adicionais, **todos corrigidos no hotfix v3.2.1** (`7263bad`):

| # | Problema | Correcao |
|---|----------|----------|
| P0 | 7 instancias restantes de `toISOString().split("T")[0]` | Substituidas por `localDateStr()` |
| P1 | Smart defaults criavam blocos de 24h | `Math.min(23,...)` → `% 1440` |
| P2 | `getOccsForDay` usava `toISOString().startsWith()` | Usa `occurrenceDate === dayStr` |
| P3 | `applyException` notes: null vs undefined | `!== undefined` → `!= null` |
| P4 | Fetch URL com sufixo UTC "Z" | Removido "Z" |

**Status apos hotfix**: Todos os 5 problemas adicionais foram corrigidos. Zero ocorrencias do padrao UTC restantes no codebase.

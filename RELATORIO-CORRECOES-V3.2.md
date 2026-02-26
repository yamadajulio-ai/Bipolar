# Empresa Bipolar — Relatorio de Correcoes Criticas v3.2

**Data**: 26/02/2026
**Repositorio**: https://github.com/yamadajulio-ai/Bipolar.git (publico)
**Branch**: main
**Autor**: Julio Yamada + Claude Code (Claude Opus 4.6)

---

## Contexto

O ChatGPT Pro analisou o repositorio e identificou 5 bugs criticos que afetavam o uso diario da aplicacao. Todas as correcoes foram implementadas em 4 commits atomicos, com lint e build passando em cada etapa.

---

## Bugs Encontrados vs Correcoes Aplicadas

### Bug 1: Datas UTC — Check-in registrava no dia errado

**Problema**: 16+ instancias de `new Date().toISOString().split("T")[0]` geravam data UTC. Usuario fazendo check-in as 23h no Brasil (UTC-3) registrava no dia seguinte.

**Correcao** (commit `e7bfefb`):
- Criado `src/lib/dateUtils.ts` com funcoes `localToday()` e `localDateStr()` que usam `getFullYear()/getMonth()/getDate()` (timezone local)
- Substituido em 18 arquivos: pages, APIs, componentes, planner engine
- Funcoes `startOfDay()`/`endOfDay()` para limites de dia

**Arquivos alterados**: 19 (18 corrigidos + 1 novo)

---

### Bug 2: Diario permitia duplicatas + Sono retornava 500

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

**Problema** (3 sub-bugs):
1. **`interval` ignorado para WEEKLY+weekDays**: Recorrencia bi-semanal (interval=2) aparecia toda semana
2. **Limite de 400 iteracoes**: Blocos recorrentes antigos (>400 dias) sumiam completamente
3. **Cursor reset**: Linhas 67-78 do expandRecurrence.ts avancavam o cursor ate o range, depois resetavam pra blockStart, desperdicando computacao
4. **Codigo duplicado**: Mesma logica de expansao copiada em 4 arquivos (expandRecurrence, WeeklyView, TodayBlocks, templates/route)

**Correcao** (commit `4263b47`):

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

**Resultado liquido**: -190 linhas de codigo duplicado, +75 linhas de modulo compartilhado.

**Arquivos alterados**: 4 (expandRecurrence reescrito + expandClient novo + WeeklyView + TodayBlocks)

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
| Commits | 4 |
| Arquivos alterados | 23 |
| Linhas adicionadas | 267 |
| Linhas removidas | 291 |
| Resultado liquido | -24 linhas (menos codigo, mais correto) |
| Lint | Passa |
| Build | Passa (73 rotas, 0 erros) |

---

## Commits (na ordem)

```
e7bfefb fix: replace UTC toISOString date splits with local timezone dateUtils
c859c6d fix: add DiaryEntry unique constraint and use upserts for diary/sleep
4263b47 fix: rewrite recurrence engine with range-based algorithm
ff15a2c fix: handle blocks crossing midnight correctly
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

1. **Templates/weekClone ainda duplicam expansao local** — usam loop manual ao inves do `expandAllBlocks` compartilhado (funciona, mas e codigo repetido no servidor)
2. **checkConstraintsClient no WeeklyView** — versao simplificada client-side duplica parte da logica de `constraints.ts` (servidor). Poderia ser unificada via API
3. **Testes automatizados** — nenhum teste unitario para o motor de recorrencia ou para as rotas API
4. **Rate limiting** — APIs nao tem rate limiting
5. **CSRF** — iron-session protege via cookie, mas nao ha token CSRF explicito

---

## Pedido

Por favor analise o repositorio atualizado e confirme:
1. Os 5 bugs originais foram corrigidos corretamente?
2. O algoritmo range-based de recorrencia esta correto para todos os casos?
3. Ha novos bugs introduzidos pelas correcoes?
4. Quais devem ser os proximos passos prioritarios?

# HOTSPOTS.md — Análise de Pontos Quentes do Código

> Gerado em 2026-03-23 via scan completo do repositório.

---

## Critérios de Hotspot

Os seguintes tipos de problema foram considerados na análise:

- **Funções/componentes enormes**: Arquivos com >200 linhas, componentes com >10 useState, funções com alta complexidade ciclomática (muitos branches, nested if/else).
- **Duplicação de lógica**: Padrões repetidos em múltiplos arquivos sem abstração (ex: config de zonas de humor, validação de auth, cálculos de risco).
- **Bugs potenciais e race conditions**: Closures stale em useEffect, operações não-atômicas, dados silenciosamente descartados, sentinelas incorretas.
- **Segurança**: Input sem validação, endpoints sem rate limit, CSP permissivo, sessões legadas sem invalidação, IDOR checks frágeis.
- **Performance**: Queries N+1, operações O(n²), queries sem paginação/limite, índices ausentes no banco, falta de Suspense boundaries.
- **Problemas de arquitetura e manutenibilidade**: God components, prop drilling, hardcoded strings, falta de error boundaries, inconsistência entre endpoints.

---

## Lista de Hotspots por Arquivo

### 1. `src/app/api/integrations/health-export/import/route.ts`
- **Trecho**: Handler POST (~linha 11-53)
- **Tipo**: Segurança
- **Prioridade**: **ALTA**
- Endpoint de importação de dados Health não verifica `session.isLoggedIn` antes de processar o body. Se a sessão for inválida, `session.userId` será undefined e upserts podem falhar silenciosamente ou criar registros órfãos. Outros endpoints (ex: `/api/sos`) fazem a checagem corretamente.

### 2. `src/app/api/sos/route.ts`
- **Trecho**: POST handler (~linha 27-36)
- **Tipo**: Segurança / Lógica
- **Prioridade**: **ALTA**
- O endpoint SOS exige autenticação, mas a página `/sos` é pública (middleware nunca bloqueia). Usuários em crise sem login acessam `/sos` mas o `logSOS("opened")` falha silenciosamente. Eventos de crise de usuários não-autenticados não são registrados.

### 3. `prisma/schema.prisma`
- **Trecho**: Model `MedicationLog` (~linha 851)
- **Tipo**: Performance (índice ausente)
- **Prioridade**: **ALTA**
- Falta índice composto em `(userId, date, scheduleId)` para a query de `updateLegacyMedication()`. Tem `@@unique([scheduleId, date])` e `@@index([userId, date])` mas não o compound necessário para a cláusula WHERE usada em `/api/medicamentos/logs`.

### 4. `src/lib/integrations/healthExport.ts`
- **Trecho**: `parseHAEDate()` (~linha 66-72)
- **Tipo**: Bug potencial (perda de dados silenciosa)
- **Prioridade**: **ALTA**
- Se a regex falha, cai em `new Date(dateStr)` que é browser-dependent. Datas malformadas do Apple Health geram `Invalid Date` e registros de sono são descartados sem aviso. Nenhum log ou contador de erros — se 20% dos dados forem malformados, o usuário não saberá.

### 5. `src/lib/ai/generateNarrative.ts`
- **Trecho**: `generateNarrativeV2()` (~linha 801-950)
- **Tipo**: Tratamento de erros / Observabilidade
- **Prioridade**: **ALTA**
- `llmAttempted` é marcado `true` antes da chamada OpenAI. Se a LLM crasha mid-stream, retorna fallback genérico sem distinguir "LLM recusou" de "JSON truncado" de "validação Zod falhou". Sem logging estruturado de qual etapa falhou. Para narrativas clínicas patient-facing, degradação silenciosa é arriscada.

### 6. `src/app/api/whatsapp/webhook/route.ts`
- **Trecho**: Iteração sobre `body.entry` (~linha 94-192)
- **Tipo**: Validação de input
- **Prioridade**: **ALTA**
- Itera sobre `body.entry` e `changes` com type checks frouxos. Assume que `message` tem `id`, `from`, `text.body` sem validação runtime. Um webhook malformado do Meta (que passa verificação de assinatura) pode causar crash em acesso a propriedades nested.

### 7. `src/app/api/diario/snapshots/route.ts`
- **Trecho**: `reprojectEntry()` (~linha 38-73, 108-114)
- **Tipo**: Race condition
- **Prioridade**: **ALTA**
- Dois requests concorrentes criando snapshots para o mesmo dia chamam `reprojectEntry()` que faz `findMany` → calcula → update. Não é atômico — last-write-wins, perdendo dados de humor do primeiro request. O check de idempotência por `clientRequestId` não protege a re-projeção.

### 8. `src/components/sos/SOSChatbot.tsx` (913 linhas)
- **Trecho**: Componente inteiro
- **Tipo**: Arquitetura / Manutenibilidade
- **Prioridade**: **ALTA**
- God component com voice recognition, TTS, message streaming, session timers, safety re-arming, e cleanup. 10+ useState, múltiplos useEffect com lógica de 150+ linhas. `ttsEnabledRef` é workaround para closures stale. Extremamente difícil de testar ou modificar.

### 9. `src/app/(app)/avaliacao-semanal/page.tsx` (572 linhas)
- **Trecho**: Inicialização de scores (~linha 44-80)
- **Tipo**: Bug potencial (validação de formulário)
- **Prioridade**: **ALTA**
- `asrmScores`, `phq9Scores`, `fastScores` usam -1 como sentinel para "não respondido", mas não há validação client-side impedindo submissão com valores -1. PHQ-9 item 9 (ideação suicida) só é validado no step de revisão, não no preenchimento.

### 10. `src/app/(app)/meu-diario/JournalClient.tsx` (783 linhas)
- **Trecho**: State management (~linha 115-145)
- **Tipo**: Arquitetura / Complexidade
- **Prioridade**: **ALTA**
- 13+ useState gerenciando entries, drafts, editing, consent, reflection, filters. Lógica de persistência de drafts mistura localStorage em múltiplas funções. Sem error boundary para falhas de narrativa AI.

### 11. `src/components/insights/NarrativeSection.tsx` (477 linhas)
- **Trecho**: State management (~linha 30-145)
- **Tipo**: Complexidade / Error handling
- **Prioridade**: **ALTA**
- 11 useState para narrative state, loading, UI expansion, retry logic, feedback. Sem error boundary. RetryCount/cooldown pattern é manual e error-prone.

### 12. `src/lib/insights/computeInsights.ts` (~2000 linhas)
- **Trecho**: `computeRiskScore()` (~linha 1067) + `computeEpisodePrediction()` (~linha 1498)
- **Tipo**: Duplicação de lógica
- **Prioridade**: **MÉDIA**
- Ambas funções recalculam risco baseado em sono independentemente sem estado compartilhado. MAD outlier detection reimplementado em dois lugares (linhas ~1162 e ~2326). Risco de divergência em manutenção.

### 13. `src/lib/insights/computeInsights.ts`
- **Trecho**: `computeHeatmapData()` (~linha 1990-2018)
- **Tipo**: Performance
- **Prioridade**: **MÉDIA**
- Itera 90 dias criando HeatmapDay para cada dia mesmo com zero dados. Sem early exit para dados esparsos. Para power users com dados de longa data, gera arrays grandes desnecessariamente.

### 14. `src/lib/insights/computeInsights.ts`
- **Trecho**: `assignRanks()` / `spearmanCorrelation()` (~linha 361-381)
- **Tipo**: Bug estatístico
- **Prioridade**: **MÉDIA**
- Se dados têm muitos empates (ex: humor=3 todo dia), ranks colapsam e denominador da correlação de Pearson vai a zero → retorna `null` silenciosamente. Usuários com hábitos estáveis não recebem feedback nem aviso.

### 15. `src/app/api/acesso-profissional/[token]/route.ts`
- **Trecho**: Queries de dashboard (~linha 199-319)
- **Tipo**: Performance
- **Prioridade**: **MÉDIA**
- `sleepLog`, `moodSnapshot`, `sOSEvent` buscados sem `take()` limit. Paciente com 2+ anos de dados pode retornar milhares de registros, excedendo memória da Vercel function.

### 16. `src/app/api/acesso-profissional/[token]/route.ts`
- **Trecho**: PIN braking logic (~linha 33-182)
- **Tipo**: Complexidade ciclomática
- **Prioridade**: **MÉDIA**
- 5 branches condicionais para tentativas (1, 5, 10, 20) com dual-read pattern (dentro e fora da transaction). Duas cadeias de validação paralelas que podem divergir.

### 17. `next.config.ts`
- **Trecho**: CSP headers (~linha 10-13)
- **Tipo**: Segurança
- **Prioridade**: **MÉDIA**
- CSP de produção inclui `'unsafe-inline'` e `'unsafe-eval'` para script-src. Necessário para Next.js/Tailwind mas enfraquece proteção XSS significativamente. Refatoração para nonces seria ideal.

### 18. `src/lib/auth.ts`
- **Trecho**: Legacy cookie migration (~linha 69-89)
- **Tipo**: Segurança
- **Prioridade**: **MÉDIA**
- Migração de sessão legada valida que o usuário existe e email confere, mas não verifica se a senha foi alterada desde a criação da sessão. Sem campo `passwordVersion` ou `lastPasswordChangeAt` para invalidar sessões antigas.

### 19. `src/app/api/medicamentos/logs/route.ts`
- **Trecho**: `updateLegacyMedication()` em loop (~linha 79-81, 96-137)
- **Tipo**: Performance (N+1)
- **Prioridade**: **MÉDIA**
- Para batch de 30 medication logs, executa 30+ queries sequenciais (3 queries por iteração). Poderia ser refatorado para `$transaction()` com bulk compute.

### 20. `src/lib/whatsapp.ts`
- **Trecho**: `normalizePhone()` / `sendWhatsAppReminder()` (~linha 31-57, 149-184)
- **Tipo**: Validação de input
- **Prioridade**: **MÉDIA**
- Se normalização falha, `wa.me/?` é gerado sem telefone. `sendWhatsAppText()` pode receber phone inválido e falhar silenciosamente com error message misleading ("WhatsApp não configurado" quando o problema é telefone inválido).

### 21. `src/lib/integrations/healthExport.ts`
- **Trecho**: `processNight()` (~linha 482-499)
- **Tipo**: Performance
- **Prioridade**: **MÉDIA**
- Deduplicação multi-source tem worst case O(n²): itera sobre sources e para cada um chama `.filter()`. Com 5 wearables e 100 segmentos = 500 filter ops por noite. Deveria pre-computar contagens por source.

### 22. `src/lib/ai/generateNarrative.ts`
- **Trecho**: `FEW_SHOT_*` examples (~linha 352-402)
- **Tipo**: Manutenibilidade
- **Prioridade**: **MÉDIA**
- Few-shot examples são JSON inline sem versionamento. Nenhum teste automatizado valida que conformam ao `narrativeV2Schema`. Mudança no schema pode desalinhar exemplos sem detecção.

### 23. `src/app/api/auth/export/route.ts`
- **Trecho**: Queries de exportação (~linha 88-100)
- **Tipo**: LGPD / Performance
- **Prioridade**: **MÉDIA**
- Endpoint de portabilidade LGPD busca modelos sem `select` clauses — retorna TODAS as colunas incluindo dados sensíveis (tokens Google, audit logs internos). Contrasta com `/api/relatorio/export` que usa `select` para minimização.

### 24. Múltiplos Client Components (relatorio, financeiro, planejador)
- **Trecho**: `new Date().getFullYear()`, `getMonth()`, `getDay()`
- **Tipo**: Bug de timezone
- **Prioridade**: **MÉDIA**
- Client Components usam `new Date()` com métodos locais do browser em vez do timezone canônico `America/Sao_Paulo`. Causa erros off-by-one em datas para usuários acessando de fora do fuso de São Paulo (ex: 23h em SP = 2h UTC do dia seguinte).

### 25. `src/app/(app)/integracoes/page.tsx` (809 linhas)
- **Trecho**: `fetchKeys` e `fetchSyncStatus` (~linha 56-80)
- **Tipo**: Error handling
- **Prioridade**: **MÉDIA**
- Callbacks de fetch não tratam erros. Progresso de importação Health Connect sem timeout — se webhook stala, usuário vê loading indefinido.

### 26. `src/components/planner/WeeklyView.tsx` (554 linhas)
- **Trecho**: Auto-sync logic (~linha 100-200)
- **Tipo**: Race condition / Memory leak
- **Prioridade**: **MÉDIA**
- 7 useState + lógica de auto-sync com risco de race condition. Fetch operations em série sem AbortController — risco de memory leak no unmount.

### 27. `src/app/api/sos/chat/route.ts` (~600+ linhas)
- **Trecho**: Arrays de pattern matching (EXPLICIT_CRISIS, CONTEXTUAL_HARM, etc.)
- **Tipo**: Manutenibilidade
- **Prioridade**: **MÉDIA**
- 300+ linhas de arrays de regex para detecção de crise inline no route file. Difícil de debugar ou adicionar novos padrões. Deveria ser extraído para módulo dedicado.

### 28. `src/components/CrisisPlanForm.tsx` (314 linhas)
- **Trecho**: Handlers addX, removeX, updateX (~linha 27-117)
- **Tipo**: Duplicação
- **Prioridade**: **MÉDIA**
- Handlers para contacts, medications, strategies são quase idênticos (3x repetidos). Sem validação client-side para telefones ou campos vazios até submissão.

### 29. `src/app/(app)/cognitivo/page.tsx` (717 linhas)
- **Trecho**: Renderização de tarefas (~linha 1-37)
- **Tipo**: Error boundary ausente
- **Prioridade**: **MÉDIA**
- Componentes cognitivos (ReactionTime, DigitSpan) renderizados sem error boundary. Fetch de histórico falha silenciosamente. Se tarefa crasha, nenhum fallback UI.

### 30. `src/app/(app)/insights/page.tsx` (1037 linhas)
- **Trecho**: Data fetching no Server Component (~linha 1-100)
- **Tipo**: Performance / UX
- **Prioridade**: **MÉDIA**
- Server Component grande buscando dados em série (sleep, mood, assessments, insights). Sem Suspense boundaries per-section — página inteira bloqueia até tudo carregar.

### 31. `src/lib/insights/computeInsights.ts`
- **Trecho**: `computeMoodThermometer()` (~linha 1374-1493)
- **Tipo**: Confiança estatística
- **Prioridade**: **BAIXA**
- Com exatamente 3 entries, `last3` é o dataset inteiro. "Instabilidade" sobre 3 dias é sinal fraco, mas confidence é marcada como "high". Flag `provisional` usa threshold diferente (`dataAvailable < 10`) do thermometer.

### 32. `src/lib/diary/projectSnapshots.ts`
- **Trecho**: `computeSnapshotMetadata()` (~linha 69-82)
- **Tipo**: Error isolation
- **Prioridade**: **BAIXA**
- `JSON.parse()` em loop sem try-catch per-entry. Um snapshot com JSON corrompido faz TODOS os snapshots falharem.

### 33. `src/lib/streaks.ts`
- **Trecho**: `computeLongestStreak()` (~linha 105-127)
- **Tipo**: Bug semântico
- **Prioridade**: **BAIXA**
- Array vazio retorna `longest = 1` em vez de 0. Semanticamente confuso — streak de 1 com zero dados reais.

### 34. `src/lib/security.ts`
- **Trecho**: `maskIp()` (~linha 70-86)
- **Tipo**: Edge case IPv6
- **Prioridade**: **BAIXA**
- IPv6 comprimido como `::1` splitado em groups incorretamente. Não é risco de segurança (pseudonymized de qualquer forma), mas demonstra fragilidade do string-splitting.

### 35. `src/components/insights/HeatmapWithJournal.tsx`
- **Trecho**: Zone label/color config (~linha 39-45)
- **Tipo**: Duplicação
- **Prioridade**: **BAIXA**
- Config de zonas duplicada em 3+ componentes (CalendarHeatmap, MoodThermometer, JournalClient, HojePage). Mudanças exigem edição em múltiplos arquivos.

### 36. `src/components/insights/SafetyNudge.tsx`
- **Trecho**: Resource links (~linha 40-80)
- **Tipo**: Hardcoded strings
- **Prioridade**: **BAIXA**
- Links de recursos (SAMU 192, CVV 188, CAPS/UBS) hardcoded em copy — sem constants file. Sem aria-label nos botões de recurso.

### 37. `src/middleware.ts`
- **Trecho**: CSRF exemption regex (~linha 42-49)
- **Tipo**: Segurança (menor)
- **Prioridade**: **BAIXA**
- Exemption de CSRF valida formato do token (32 chars) antes de verificar se existe no banco. Não é explorável sozinho, mas é boundary de segurança fraca.

### 38. `src/app/(app)/admin/layout.tsx`
- **Trecho**: Auth check (~linha 16-28)
- **Tipo**: Auditoria
- **Prioridade**: **BAIXA**
- Check de `role === "admin"` redireciona se falso, mas não loga a tentativa não autorizada. Contrasta com acesso profissional que loga falhas de PIN.

---

## Top 10 Hotspots Mais Críticos

| Rank | Arquivo | Problema | Prioridade | Por que atacar primeiro |
|------|---------|----------|------------|------------------------|
| **1** | `api/integrations/health-export/import/route.ts` | Auth check ausente no POST | ALTA | Risco direto de segurança — requests não-autenticados podem criar dados com userId undefined, corrompendo o banco. Fix trivial (2 linhas). |
| **2** | `api/diario/snapshots/route.ts` | Race condition na re-projeção | ALTA | Perda de dados de humor em check-ins concorrentes. Afeta a feature core do app (tracking diário). Requer wrapping em transaction atômica. |
| **3** | `api/whatsapp/webhook/route.ts` | Input não validado do Meta | ALTA | Webhook externo sem Zod validation pode crashar a rota inteira. Meta pode enviar payloads inesperados. Crash = perda de mensagens de usuários. |
| **4** | `lib/integrations/healthExport.ts` | Perda silenciosa de dados de sono | ALTA | Datas malformadas do Apple Health são descartadas sem log. Usuário pode perder 20% dos dados sem saber. Afeta precisão de todos os insights. |
| **5** | `lib/ai/generateNarrative.ts` | Fallback silencioso sem instrumentação | ALTA | Narrativas clínicas degradam sem que ninguém saiba. Para app de saúde mental, qualquer falha silenciosa em conteúdo patient-facing é P0. |
| **6** | `app/(app)/avaliacao-semanal/page.tsx` | Validação de formulário PHQ-9 | ALTA | PHQ-9 item 9 (ideação suicida) sem validação client-side adequada. Submissão com -1 pode gerar scores incorretos que alimentam SafetyNudge e risk assessment. |
| **7** | `prisma/schema.prisma` | Índice composto ausente em MedicationLog | ALTA | Query sem índice causa full table scan. Escala linearmente com dados — para pacientes de longo prazo, latência cresce proporcionalmente. |
| **8** | `components/sos/SOSChatbot.tsx` | God component (913 linhas) | ALTA | Componente mais crítico do app (crise) é o mais difícil de manter/testar. Qualquer bug aqui tem impacto direto em segurança do paciente. Refatoração em sub-componentes é investimento de longo prazo. |
| **9** | `api/sos/route.ts` | SOS events não logados para não-autenticados | ALTA | Usuários em crise sem login não têm eventos registrados. Contradiz a filosofia "SOS sempre acessível" do middleware. Fix: permitir log anônimo ou ajustar expectativa. |
| **10** | `api/acesso-profissional/[token]/route.ts` | Queries sem limite no dashboard | MÉDIA | Profissional acessando paciente com 2+ anos de dados pode triggerar OOM na Vercel. Adicionar `take()` é fix simples com grande impacto em estabilidade. |

---

## Legenda de Prioridades

- **ALTA**: Risco de segurança, perda de dados, ou bug que afeta funcionalidade core. Deve ser corrigido antes de qualquer feature nova.
- **MÉDIA**: Problemas de performance, manutenibilidade ou edge cases que afetam qualidade mas não são bloqueantes. Resolver em ciclo de refatoração.
- **BAIXA**: Polish, duplicação menor, edge cases raros. Resolver quando tocar no arquivo por outro motivo.

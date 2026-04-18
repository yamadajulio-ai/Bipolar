# ADR-011: Movimento e Ritmo (atividade física como sinal clínico)

## Status
Accepted (2026-04-18)

## Context
Atividade física tem valência dupla em transtorno bipolar:
- **Protetiva**: regula sono, humor e ritmo circadiano (evidência observacional adjuvante).
- **Sinal prodrômico**: exercício excessivo ou em horário tardio pode anteceder hipomania/mania; inatividade prolongada pode anteceder depressão.

A evidência bipolar-específica é **fraca/heterogênea**: CANMAT/ISBD 2018 trata exercício no contexto de estilo de vida/psicoeducação (não hierarquizado como first-line); meta-análise 2025 em BD mostra melhora depressiva/ansiosa, mas **não** mania, com evidência de baixa qualidade. Portanto o recurso NÃO pode ser vendido internamente como "Tier-1 CANMAT".

Hoje o app importa do Health Auto Export (HAE) steps, active_calories, HRV e resting heart rate, mas **ignora** `workouts[]` (HKWorkout) presentes no payload. Health Connect (Android) tem `ExerciseSessionRecord` equivalente. A camada de fitness existente é um card agregado "Corpo (7 dias)" sem semântica de sessão nem linha de base individual.

Uma primeira proposta centrou o MVP em `active_calories` + `steps` ("dias ativos"). Essa proposta foi **rejeitada** em consulta clínica independente (GPT Pro, 2026-04-18): volume bruto é fraco para decisão clínica em BD; o que importa é **mudança vs padrão pessoal, timing relativo ao sono, e co-ocorrência com outros sinais**.

## Decision

### 1. Reposicionamento semântico
A feature **não é fitness/performance**. É **"Movimento e ritmo"** — camada de ritmo corporal e ativação.
- UI do paciente: palavra "movimento"
- Config/consent/export clínico: "atividade física" / "sessões de atividade"
- Frase-âncora obrigatória em todo alerta: *"isso, sozinho, não significa…"*
- Evidência comunicada como **observacional/adjuvante**, nunca first-line

### 2. Dois sinais distintos e complementares
Manter **ambos**:
- **Movimento intencional** (`ExerciseSession`): HKWorkout/ExerciseSessionRecord com tipo, duração, intensidade, timing.
- **Ativação global** (`Metric` existente: steps, active_calories): captura inquietação, pacing, goal-directed activity — mesmo sem "treino".

Em BD, ativação global pode subir sem sessão registrada (prodrômico). Se guardarmos só workouts, perdemos o sinal. Se guardarmos só agregados, perdemos a semântica clínica.

### 3. Modelagem de dados em três camadas
- **`Metric`** (inalterada): séries escalares diárias.
- **`ExerciseSession`** (nova): eventos intervalares com `source`, `externalId`, `activityTypeRaw`/`activityTypeNorm`, `startAtUtc`/`endAtUtc`, `timezoneOffsetMin`, `localDate`, `durationSec`, `energyKcal`, `distanceM`, `avgHr`, `intensityBand`, `isIntentional`, `contextTag`, `rawPayload`. Unicidade `(userId, source, externalId)` + fallback dedupe por janela temporal.
- **`DailyActivitySummary`** (derivada): `steps`, `sessionCount`, `sessionMinutes{Light,Moderate,Vigorous}`, `lateSessionMinutes`, `lastSessionEndRelativeToHabitualSleepMin`, `activityLoad`, `dataCompleteness`, `sourceMix`, `baseline28d`, `zScore`, `weekendAdjustedBaseline`.

### 4. Métrica-alvo: activity-load ponderado
Não usar "workout minutes" brutos. Usar `activityLoad = Σ intensidade × duração + bônus lateness`.
- Light=1, Moderate=2, Vigorous=3
- Bônus lateness se sessão encerra <4h do sono habitual
- Baseline: **28 dias** (mediana + MAD), separado dia útil vs fim de semana

### 5. Gatilhos Risk-v2 (conservadores)
**Ativação/hipomania (YELLOW)**:
- `activityLoad > 1.75× baseline28d` em 2/3 dias **E**
- Sessão M/V encerrando <4h do sono habitual em 2/3 dias **OU**
- Queda/atraso de sono **OU**
- Energia/irritabilidade acima do habitual
- **Exigência obrigatória**: ≥1 co-sinal não-motor

**ORANGE**: escalada rápida + múltiplos co-sinais claros.

**RED**: **nunca** por atividade sozinha.

**Desativação/depressão**:
- Queda relativa <50% do baseline28d em 3/5 dias (não threshold absoluto universal)
- Reforçar com zero sessão intencional + energia baixa + piora humor/PHQ/Diary

**Antídotos falso-positivo obrigatórios**:
- Baseline28d (não 7d)
- Ajuste dia útil / fim de semana
- Travel/timezone suppression
- `dataCompleteness` mínimo
- Context tags ("planejado", "prova", "viagem", "trabalho físico", "doença", "lesão")
- Rebaselina após mudança de fonte/dispositivo
- Personalização via `warningSigns`, `MoodSnapshot`, `LifeChart`

### 6. Stability Score
**Zero peso direto** na fase inicial. Movimento entra como **contexto interpretativo** nos Insights ("sono pior após sessão intensa tardia"), nunca como pontos.
Revisão em 6-12 meses com dados próprios antes de considerar modificador oculto de no máximo 5%.

### 7. Roadmap por fases
- **Fase 0 (fundacional)**: schema, parser `workouts[]`, consent scope granular, `dataCompleteness`, self-report relativo.
- **Fase 1 (shadow mode, 6-8 semanas)**: calcular `DailyActivitySummary` + baseline + `activityLoad` em produção **sem alertar**. Backtest local contra SleepLog/MoodSnapshot/DiaryEntry/ASRM/PHQ-9/warningSigns/LifeChart.
- **Fase 2 (UI resumo)**: card de ritmo em linguagem neutra. **Zero calorias no paciente.**
- **Fase 3 (Risk-v2 behind flag)**: gatilhos conservadores (§5), observação por 30 dias antes de ampliar.
- **Fase 4 (Insights observacionais)**: correlações como "costuma coincidir", nunca causais.

### 8. Guardrails TCA (comorbidade alimentar)
**Proibido**:
- Calorias queimadas na UI principal
- Peso, IMC, meta de emagrecimento
- Streaks de volume, badges por intensidade/frequência
- Ranking / social comparison
- Linguagem de compensação ("queimar", "descontar", "recuperar", "devendo")
- Metas agressivas fixas ("7/7 dias")
- Reforço positivo em picos ("uau, 3 treinos hoje!")

**Obrigatório**:
- Foco em consistência e timing (não gasto)
- Toggle para esconder números e ver só categorias
- Feedback neutro, não celebratório
- Nudge de **redução** de intensidade noturna quando houver risco de ativação
- Calorias só em backend / export clínico, nunca objeto central do paciente

### 9. LGPD — consent granular
Novo scope `physical_activity` em vez de estender `health_data`. Justificativa: atividade física revela padrões comportamentais distintos (rotina, pacing, locais frequentados via GPS). ANPD trata dado de saúde como sensível — consentimento deve ser específico e destacado por finalidade. GPS/rota **não é MVP** e exigirá opt-in separado quando considerado.

### 10. Auditabilidade clínica
Cada disparo de alerta Risk-v2 relacionado a movimento grava em `RiskAlertAudit`:
- Condições que dispararam
- `dataCompleteness` no momento
- Baseline utilizado
- Supressores / context tags ativos

Sem isso não há como depurar falso positivo nem defender o racional clínico.

### 11. Self-report
Não perguntar "você se movimentou hoje?" (binário). Usar escala relativa: "abaixo do habitual / dentro do habitual / acima do habitual / não sei" + chip opcional "perto da hora de dormir". Melhor ground truth para calibrar anomalias.

## Consequences

**Positivas**:
- Captura sinal prodrômico sem gamificar fitness
- Evita falsos positivos de fim de semana ativo / viagem / trabalho físico
- Reduz risco de gatilhar comorbidade TCA
- Mantém disciplina metodológica no Stability Score
- Cria infra reutilizável (baseline28d, completeness, anomaly) para outras features

**Negativas**:
- Shadow mode de 6-8 semanas atrasa time-to-feature visível ao usuário
- Modelagem em 3 camadas aumenta complexidade de schema e queries
- Novo scope LGPD exige UI de consent migration para usuários existentes

**Riscos residuais**:
- Evidência BD-específica ainda emergente — pode exigir recalibração pós-backtest
- Dispositivos diferentes (Apple Watch / Fitbit / Samsung / phone-only) produzem ruído de completeness que o baseline precisa absorver

## References
- GPT Pro clinical review (2026-04-18) — revisão independente com literatura recente
- CANMAT/ISBD 2018 Guidelines
- EPA 2024 meta-review (atividade física em SMI)
- Meta-análise 2025 (exercício em BD): efeito depressivo/ansioso, não maníaco
- `src/lib/integrations/healthExport.ts` — parser HAE atual
- ADR-005 Insights Modularization
- ADR-002 Timezone Contract (America/Sao_Paulo canônico)

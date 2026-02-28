# Changelog — Rede Bipolar

## v3.3.0 — 2026-02-28

### Hardening, Deploy Producao, XLSX

#### Deploy em Producao
- Vercel com auto-deploy do GitHub
- Dominios: redebipolar.com e redebipolar.com.br
- PostgreSQL via Neon

#### Google Calendar Sync Hardening (5 correcoes)
- Filtro de eventos all-day e eventos longos (>18h) que poluiam o planejador
- `singleEvents: true` no sync incremental (evita recurring masters)
- Upsert com `@@unique([userId, googleEventId])` (elimina duplicatas)
- `lastSyncAt` no GoogleAccount como watermark de push (corrige push watermark)
- Filtro de ocorrencias por semana visivel antes de checar constraints (corrige "8 noites tardias")

#### Planejador Redesenhado
- Grade horaria estilo Google Calendar substituindo layout de cards
- sourceType propagado no pipeline (PlannerBlockData, ExpandedOccurrence, SerializedBlock)
- Alertas cross-source ignorados (conflitos app<->google nao geram alerta)
- Badges de alerta condensados ("3 Conflitos" em vez de badges individuais)

#### Importacao XLSX do Mobills
- Suporte a arquivos .xlsx/.xls alem de .csv (biblioteca SheetJS)
- Deteccao automatica de formato pelo nome do arquivo
- Parser com suporte a datas Excel serial, formato R$, numero brasileiro
- Frontend atualizado para aceitar .csv, .xlsx e .xls

#### Infraestrutura
- Migration: `lastSyncAt` + unique index `PlannerBlock_userId_googleEventId_key`
- 1 nova dependencia (xlsx / SheetJS 0.18.5)
- 1 novo modulo (parseMobillsXlsx.ts)
- 53 testes passando

---

## v3.1.0 — 2026-02-26

### "Setup uma vez, roda sempre"

Reduz drasticamente a entrada manual no Calendario de Estabilidade com templates, rotinas, clonagem, quick-add e smart defaults.

#### Templates de Semana
- CRUD completo de templates (/api/templates)
- Criar template a partir de semana existente (fromWeekStart)
- Aplicar template com 3 modos: mesclar, preencher, substituir
- Tela de gerenciamento em /mais/templates com preview em grid 7 dias

#### Rotinas Persistentes
- Flag isRoutine no PlannerBlock (reutiliza 100% do codigo existente)
- Rotinas = blocos com recorrencia que repetem indefinidamente
- Pausar/remover rotinas em /mais/rotinas
- Indicador visual (↻) nos blocos de rotina no planejador
- Filtro ?routinesOnly=true na API

#### Copiar Semana
- POST /api/planner/weeks/clone com modos all/flexOnly/exceptAnchors
- Pula rotinas automaticamente (ja repetem)
- Deteccao de duplicatas por titulo + horario
- Modal no planejador com selecao de semana fonte

#### Quick Add
- Parser deterministico pt-BR (0 IA, 0 deps)
- Suporte: hoje/amanha/dia da semana, range de horario (14-15, 14h30), titulo
- Keyword matching para ~40 palavras → 8 categorias
- Se parse completo: cria bloco automaticamente
- Se parse parcial: abre modal preenchido
- Input integrado na toolbar do planejador

#### Smart Defaults
- CATEGORY_DEFAULTS com duracao, energia, estimulacao e tipo por categoria
- Auto-preenchimento no modal ao mudar categoria (novo bloco)

#### Onboarding First-Run
- Banner na tela Hoje quando 0 blocos e 0 templates
- Step 1: definir horarios de acordar/dormir
- Step 2: selecionar rotinas comuns (cafe, almoco, jantar, medicacao)
- Gera blocos DAILY com isRoutine=true + salva regras de estabilidade

### Infraestrutura
- 2 modelos novos (PlannerTemplate, PlannerTemplateBlock)
- 1 campo novo (PlannerBlock.isRoutine)
- 5 novas API routes (templates CRUD, apply, clone, quick-add)
- 6 novos componentes UI
- Fix critico: GET /api/planner/blocks agora busca blocos recorrentes criados antes da semana visualizada
- 0 dependencias novas

---

## v3.0.0 — 2026-02-25

### Core: Calendario de Estabilidade (MVP)

Novo modulo central — planejador semanal TAB-first com motor de regras transparente.

#### Planejador Semanal
- Blocos de atividades com categorias (sono, medicacao, refeicao, trabalho, social, exercicio, lazer, outro)
- Tipos de bloco: ancora (protege estabilidade), flexivel, risco
- Recorrencia: nenhuma, diaria, semanal (com selecao de dias)
- Excecoes por data (cancelar ou alterar ocorrencias especificas)
- Navegacao entre semanas com visualizacao em grid de 7 colunas

#### Motor de Regras Transparente
- Deteccao de conflitos de horario entre blocos
- Alerta de noites tardias (atividades apos horario limite configuravel)
- Violacao de wind-down (atividades estimulantes perto do horario de dormir)
- Protecao de ancoras (blocos flexiveis conflitando com ancoras)
- Limite de noites tardias por semana
- Todas as mensagens em linguagem suave e nao alarmista

#### Tela "Hoje" (Autopiloto)
- Proximo bloco com contagem regressiva
- Ancoras do dia em destaque
- Orcamento de energia (barra visual com codificacao por cor)
- Acoes rapidas (check-in, planejador, exercicios, SOS)

#### Check-in 30s
- Humor, energia, ansiedade, irritabilidade (escala 1-5)
- Horas de sono e adesao a medicacao
- Sinais de alerta (checklist colapsavel)
- Salva via DiaryEntry existente — sem modelo novo

#### Insights de Estabilidade
- Regularidade de sono (variancia de horarios de dormir/acordar)
- Regularidade de ancoras IPSRT (acordar, contato, atividade, jantar, dormir)
- Carga semanal de energia (soma de energyCost dos blocos)
- Noites de risco (contagem de noites tardias)
- Observacoes suaves com disclaimer profissional
- Grafico de humor/sono (recharts dual-axis)

### Navegacao Reorganizada
- 5 telas principais: Hoje, Planejador, Check-in, Insights, Mais
- Tela "Mais" agrega acesso a todos os modulos complementares
- Redirect de auth agora vai para /hoje

### Infraestrutura
- 4 novos modelos Prisma (PlannerBlock, PlannerRecurrence, PlannerException, StabilityRule)
- 4 novas API routes (/api/planner/blocks, blocks/[id], blocks/[id]/exceptions, rules)
- Constraint engine puro (types.ts, expandRecurrence.ts, constraints.ts)
- 0 novas dependencias

### Documentacao
- Visao do produto atualizada com core Calendario de Estabilidade
- PRD atualizado com novo escopo
- Backlog com novo epico 0
- Riscos expandidos com 3 novos riscos do calendario
- Changelog atualizado

---

## v2.0.0 — 2026-02-25

### Novas Funcionalidades (Inspiradas no Headspace, adaptadas para TAB1)

#### Diário Expandido
- Novos campos opcionais: energia (1-5), ansiedade (1-5), irritabilidade (1-5)
- Adesão à medicação (sim/não/não lembro) — sem especificar medicamento
- Checklist de sinais de alerta (10 sinais precoces de episódios)
- Componente reutilizável ScaleSelector para seletores 1-5

#### Painel de Tendências
- Gráficos de humor e sono ao longo do tempo (recharts LineChart dual-axis)
- Distribuição de humor (BarChart)
- Seletor de período (7/14/30/90 dias)
- Alertas automáticos de padrões (sono diminuindo, humor persistentemente alto/baixo)
- Todos os alertas incluem disclaimer profissional

#### Módulo de Sono
- Novo modelo SleepLog com horários, qualidade, despertares, rotina pré-sono
- Registro detalhado com cálculo automático de horas
- Tendências de sono (qualidade, regularidade de horário)
- Artigo educacional sobre higiene do sono para bipolaridade

#### Exercícios de Respiração
- Respiração 4-7-8 (para insônia)
- Respiração quadrada / box breathing (para ansiedade)
- Respiração diafragmática (para aterramento)
- Animação visual CSS (círculo expandindo/contraindo)
- Registro de sessões no banco de dados

#### Técnicas de Aterramento
- 5 Sentidos (5-4-3-2-1) — aterramento sensorial
- Relaxamento Muscular Progressivo
- Guia passo a passo com indicador de progresso

#### Rastreador de Ritmo Social
- Baseado na Terapia Interpessoal de Ritmos Sociais (IPSRT)
- 5 horários-âncora: acordar, primeiro contato, atividade principal, jantar, dormir
- Métrica de regularidade (percentual clínico, não gamificado)
- Gráfico de ritmo (recharts)

#### SOS de Crise Interativo
- Botão SOS flutuante visível em todas as telas
- Interface escura de baixa estimulação
- 3 caminhos: ajuda imediata (telefones), acalmar (respiração 4-7-8), insônia (aterramento)
- Números de emergência como links tel: clicáveis

#### Plano de Crise Personalizado
- Contatos de confiança (nome + telefone)
- Profissional de saúde (nome + telefone)
- Medicamentos atuais (apenas nomes, com disclaimer médico)
- Hospital de preferência
- Estratégias pessoais de enfrentamento

#### Sons Ambiente
- Ruído branco, rosa, marrom e simulação de chuva
- Gerados via Web Audio API (sem arquivos de áudio externos)
- Controle de volume
- Timer de sono com fade-out (15/30/60/90 min)

#### Dashboard Inteligente
- Saudação por período do dia
- Status do dia atual (registro feito ou não)
- Mini-gráfico de tendência dos últimos 7 dias
- Sugestões contextuais baseadas em regras
- Grade de ações rápidas para todas as funcionalidades

#### Relatório Mensal
- Resumo mensal com estatísticas agregadas
- Gráficos de humor e sono do mês
- Distribuição de humor
- Sinais de alerta mais frequentes
- Adesão à medicação (percentual)
- Imprimível / exportável como PDF (CSS print)
- Para compartilhar com profissionais de saúde

#### Cursos Estruturados
- 4 cursos com aulas sequenciais em markdown
- Progresso exibido como fração ("3 de 8 aulas")
- Cursos: Entendendo o TAB1, Higiene do Sono, Regulação Emocional, Comunicação Familiar

#### Lembretes Gentis
- Lembretes configuráveis para registro, sono, exercícios
- Browser Notification API (sem push server)
- Componente ReminderManager invisível no layout

### Infraestrutura

- 6 novos modelos Prisma (SleepLog, ExerciseSession, DailyRhythm, ReminderSettings, CrisisPlan, CourseProgress)
- DiaryEntry expandido com 5 novos campos opcionais
- 12+ novas API routes
- 16+ novas páginas
- 30+ novos componentes
- Header reestruturado com navegação expandida e menu mobile hamburger
- Middleware atualizado para proteger todas as novas rotas
- 0 novas dependências (tudo com pacotes já instalados)

### Documentação

- README.md atualizado com novas funcionalidades e estrutura
- PRD (docs/06-prd-mvp.md) expandido com escopo completo
- Backlog (docs/07-backlog.md) atualizado com novos épicos e stories
- Riscos (docs/04-riscos-e-mitigacoes.md) expandidos com 7 novos riscos
- Changelog (docs/09-changelog.md) criado

---

## v1.0.0 — 2026-02-24

### MVP Inicial

- Landing page com disclaimers
- Cadastro e login seguros (bcrypt + iron-session)
- Diário básico (humor 1-5, sono, nota)
- Biblioteca educacional (10 artigos markdown)
- Plano de crise estático
- Área para famílias
- Política de privacidade e termos de uso
- Security headers (CSP, X-Frame-Options, etc.)
- Rate limiting no login

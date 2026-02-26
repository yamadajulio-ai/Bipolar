# Changelog — Empresa Bipolar

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

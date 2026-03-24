# UX Overview — Suporte Bipolar

## 1. Rotas e Telas Principais

### Públicas (sem autenticação)

| Rota | Objetivo |
|------|----------|
| `/` | Landing page — hero, features, trust badges (IPSRT/PROMAN), FAQ, CTAs de cadastro |
| `/login` | Login com e-mail/senha ou Google OAuth |
| `/cadastro` | Cadastro com gate de idade (18+), consentimento LGPD (art. 11) obrigatório |
| `/recuperar-senha` | Recuperação de senha por e-mail (token-based) |
| `/comecar` | Página intermediária "Comece agora" — benefícios + CTA para cadastro |
| `/sos` | Página de crise — sempre acessível, sem login. Chatbot, respiração, aterramento, contatos de emergência |
| `/para-profissionais` | Landing para profissionais de saúde — funcionalidades, segurança, integração |
| `/ferramentas/regularidade-do-sono` | Ferramenta SEO — guia de regularidade do sono com calculadora |
| `/ferramentas/sinais-precoces` | Ferramenta SEO — sinais prodrômicos do transtorno bipolar |
| `/ferramentas/preparar-consulta` | Ferramenta SEO — checklist para preparar consulta psiquiátrica |
| `/privacidade` | Política de privacidade (LGPD) |
| `/termos` | Termos de uso |
| `/offline` | Fallback PWA offline — CVV 188 sempre visível |
| `/profissional/[token]` | Dashboard read-only para profissionais — protegido por token + PIN |

### Autenticadas (dashboard do usuário)

| Rota | Objetivo |
|------|----------|
| `/hoje` | Dashboard diário — saudação, status do dia, Stability Score (gauge SVG), SafetyNudge, termômetro de humor, narrativa AI, conquistas, medicação |
| `/checkin` | Check-in rápido — humor (1-5), energia, ansiedade, irritabilidade, sono, medicação, sinais de alerta. Timeline de snapshots do dia |
| `/sono` | Hub de sono — média, regularidade, tendência, qualidade, sparkline 14 noites, histórico com tags (cochilo/incompleto/excluído) |
| `/sono/novo` | Formulário de novo registro de sono (horários, duração, qualidade, notas) |
| `/sono/tendencias` | Tendências de sono — regularidade, desvio padrão, alertas de disfunção |
| `/insights` | Analytics avançado — termômetro, predição de episódios, cycling analysis, heatmap, narrativa AI (GPT-5.4), alertas clínicos, gasto × humor |
| `/diario` | Histórico de check-ins (30 dias) — cards com humor/energia/ansiedade/irritabilidade |
| `/diario/novo` | Entrada detalhada no diário — humor expandido, sinais de alerta, medicação per-dose |
| `/diario/tendencias` | Tendências do diário — filtro 30/90 dias, heatmap por dia da semana |
| `/avaliacao-semanal` | Avaliação semanal — ASRM (mania) + PHQ-9 (depressão) + FAST short (funcionalidade), multi-step |
| `/life-chart` | Life Chart NIMH — eventos (mudança de medicação, estressor, hospitalização, etc.), agrupados por mês |
| `/financeiro` | Gasto × humor — importação CSV, tendência, categorias, correlação Spearman, anomalias (z-score), transações noturnas |
| `/medicamentos` | Rastreamento de medicação — add/edit medicamentos, horários, adesão per-dose, ativo/inativo |
| `/cognitivo` | Microtarefas cognitivas — Tempo de Reação (5 trials) + Digit Span (até 11 dígitos), histórico de 5 sessões |
| `/exercicios` | Hub de exercícios — respiração (box, 4-7-8, alternada) e aterramento (5-4-3-2-1) |
| `/exercicios/respiracao/[tipo]` | Exercício de respiração guiado — animação + timer + haptic feedback |
| `/exercicios/aterramento/[tipo]` | Exercício de aterramento — passo a passo com timer |
| `/sons` | Sons ambiente — white/pink/brown noise, chuva |
| `/circadiano` | Perfil circadiano — cronotipo, variabilidade, 6 dicas de terapia escuro/luz |
| `/planejador` | Agenda semanal — integração Google Calendar, blocos de atividade |
| `/perfil` | Perfil socioeconômico — acesso a cuidado, fonte de medicação, moradia → recomendações CAPS/SUS/CRAS |
| `/plano-de-crise` | Plano de crise — contatos de emergência, sinais de alerta, estratégias de coping |
| `/plano-de-crise/editar` | Formulário para editar plano de crise |
| `/consentimentos` | Centro de consentimento LGPD — 11 escopos, toggles, referências legais |
| `/acesso-profissional` | Compartilhamento com profissional — gerar token + PIN, expiração, audit log, revogar |
| `/meu-diario` | Diário pessoal (texto livre, separado dos check-ins) |
| `/conteudos` | Biblioteca educativa — artigos por slug |
| `/cursos` | Cursos estruturados — multi-lição |
| `/familias` | Guia para familiares e cuidadores |
| `/noticias` | Notícias e pesquisas recentes |
| `/integracoes` | Dashboard de integrações — Apple Health, Health Connect, Google Calendar, Mobills |
| `/relatorio` | Exportação clínica mensal (30/90 dias, JSON, rate limited) |
| `/conta` | Configurações da conta — e-mail, exportação LGPD, excluir conta (step-up auth) |
| `/conta/lembretes` | Preferências de lembretes — timing, frequência, modo privacidade |
| `/feedback` | Envio de feedback — prioridade + categoria |
| `/como-usar` | Tutorial do app |
| `/onboarding` | Onboarding pós-cadastro — 7 steps, 3 tracks (recém-diagnosticado/veterano/cuidador) |
| `/mais` | Hub de navegação — 5 categorias (Registros, Avaliações, Bem-estar, Aprendizado, Configurações), 22 módulos |
| `/escolher-visual` | Seletor de tema (light/dark/auto) |

### Administrativas

| Rota | Objetivo |
|------|----------|
| `/admin` | Dashboard geral — stats de usuários, atividade diária/semanal, alertas |
| `/admin/users` | Gestão de usuários — busca, filtro, ativar/desativar |
| `/admin/clinical` | Métricas clínicas agregadas — tendências populacionais |
| `/admin/safety` | Incidentes de segurança — timeline SOS, escalações |
| `/admin/engagement` | Engajamento — DAU/WAU/MAU, heatmap de features, retenção |
| `/admin/compliance` | LGPD/audit — trilha de acesso, logs profissionais, histórico de consentimento |
| `/admin/feedback` | Gestão de feedback dos usuários |

---

## 2. Fluxos de Usuário

### Fluxo 1: Cadastro e Onboarding

1. Usuário acessa `/` (landing page) → clica "Começar grátis" ou "Criar conta"
2. Redireciona para `/cadastro` → preenche e-mail, senha, confirma senha
3. Marca checkbox obrigatório de idade (18+) e consentimento LGPD (dados de saúde)
4. Aceita termos e política de privacidade (links inline)
5. Submete → criação de conta → redireciona para `/onboarding`
6. **Onboarding (7 steps)**:
   - **Welcome**: Apresentação do app
   - **Perfil**: Escolhe track (recém-diagnosticado / veterano / cuidador)
   - **Objetivo**: Seleciona objetivo principal (baseado no perfil)
   - **Âncora**: Recebe tarefa-âncora personalizada (ex: "Registrar seu sono")
   - **Semana**: Visualiza milestones da primeira semana
   - **Consentimento**: Aceita escopos (health_data e terms_of_use obrigatórios, demais opcionais)
   - **Pronto**: Confirmação → redireciona para `/hoje`

### Fluxo 2: Login (e-mail ou Google OAuth)

1. Acessa `/login`
2. **E-mail**: preenche e-mail + senha → POST `/api/auth/login` → sucesso → `/hoje` (ou `/onboarding` se !onboarded)
3. **Google**: clica "Entrar com Google" → redirect OAuth → callback → criação/vinculação de conta → `/hoje`
4. **Esqueci senha**: clica link → `/recuperar-senha` → digita e-mail → recebe link por e-mail → define nova senha

### Fluxo 3: Check-in Diário

1. Usuário acessa `/checkin` (via BottomNav "Check-in" ou card no `/hoje`)
2. Seleciona humor (1-5), energia (1-5), ansiedade (1-5), irritabilidade (1-5)
3. Informa horas de sono (ou usa auto-preenchimento via Health Auto Export)
4. Marca medicação (Sim/Não/Não sei)
5. Opcionalmente marca sinais de alerta (20 opções, 6 visíveis por padrão, expansível)
6. Submete → salva snapshot → exibe feedback contextual personalizado:
   - Humor elevado + energia alta → alerta de possível hipomania
   - Sono curto (<6h) → aviso específico
   - Múltiplos sinais de alerta → destaque quantitativo
7. Redireciona para `/hoje` com status atualizado

### Fluxo 4: Registro de Sono

1. Acessa `/sono` → vê resumo (média, regularidade, tendência, sparkline)
2. Clica "Novo registro" → `/sono/novo`
3. Preenche horário de dormir, horário de acordar, qualidade (1-5), notas
4. Submete → sistema classifica:
   - <1h = cochilo (excluído de métricas, tag roxo)
   - ≥1h = sono real (incluído em métricas)
   - 1-4.5h = tag "incompleto?" como sugestão
5. Retorna ao `/sono` com histórico atualizado

### Fluxo 5: Avaliação Semanal

1. Acessa `/avaliacao-semanal` (via `/mais` ou alerta no `/hoje`)
2. Sistema verifica se já existe avaliação para a semana atual → aviso se existir
3. **Step 1 — ASRM**: 5 itens sobre mania (escala 0-4)
4. **Step 2 — PHQ-9**: 9 itens sobre depressão (escala 0-3)
5. **Step 3 — FAST short**: 7 itens sobre funcionalidade
6. **Step 4 — Revisão**: resumo das respostas + verificação de segurança
7. Se PHQ-9 item 9 (ideação suicida) ≥ 1 → SafetyNudge aparece com recursos de crise
8. Submete → salva avaliação → retorna ao dashboard

### Fluxo 6: SOS / Crise

1. Usuário pressiona botão SOS (flutuante no `/hoje`, ou acessa `/sos` diretamente — **sem login**)
2. Tela principal com 6 opções:
   - **Preciso conversar** → abre chatbot AI (com detecção de crise)
   - **Respiração guiada** → exercício 4-7-8 com animação
   - **Aterramento** → técnica 5-4-3-2-1 guiada
   - **Chamar alguém** → contatos de confiança + CVV 188 + SAMU 192
   - **Chamar 192 SAMU** → link tel: direto
   - **SOS em espera** → modo companion pós-ligação CVV
3. No chatbot: modo texto e modo voz (hands-free com STT + TTS contínuo)
4. Detecção de crise analisa mensagens → se detecta risco → resposta template fixa (sem LLM)
5. Todas as ações são logadas via POST `/api/sos`

### Fluxo 7: Compartilhamento com Profissional

1. Acessa `/acesso-profissional`
2. Clica "Criar novo acesso" → gera token (24 bytes) + PIN (6 dígitos)
3. Escolhe expiração (7/30/60/90 dias) e se compartilha eventos SOS
4. Compartilha link + PIN com profissional (via mensagem, consulta, etc.)
5. Profissional acessa `/profissional/[token]` → digita PIN → vê dashboard read-only
6. Usuário pode revogar acesso a qualquer momento + visualizar audit log

### Fluxo 8: Insights e Narrativa AI

1. Acessa `/insights` (via BottomNav)
2. Seleciona período (7/15/30/90 noites)
3. Visualiza: termômetro de humor, alertas clínicos, predição de episódios, cycling, heatmap
4. Se consentimento AI ativo → narrativa gerada pelo GPT-5.4 com evidence chips
5. Pode dar feedback (útil/não útil) na narrativa
6. Se SafetyNudge ativado → recursos de crise visíveis

---

## 3. Perfil de Usuário (Deduzido)

### Quem é o usuário-alvo

**Brasileiros adultos (18+) diagnosticados com transtorno bipolar**, usando iPhone como dispositivo principal.

### Características

- **Nível técnico**: Variado, mas provavelmente baixo a médio — o app prioriza linguagem simples e evita jargão clínico sem explicação
- **Contexto socioeconômico**: Diverso — o perfil socioeconômico (`/perfil`) adapta recomendações para SUS, CAPS, CRAS e BPC, indicando que parte significativa dos usuários depende do sistema público de saúde
- **Contexto clínico**: Pacientes em acompanhamento psiquiátrico (regular ou irregular), alguns sem acompanhamento profissional — o app oferece orientações para diferentes níveis de acesso a cuidado
- **Objetivo principal**: Automonitoramento de humor, sono e medicação para identificar padrões, prevenir episódios e melhorar a comunicação com profissionais de saúde
- **Motivação emocional**: Senso de controle sobre uma condição imprevisível; validação de que estão "fazendo algo" pela própria saúde
- **Contexto familiar**: Parte dos usuários são cuidadores/familiares (track de onboarding dedicado)
- **Idioma**: Português brasileiro exclusivamente
- **Dispositivo**: iPhone (mobile-first, PWA com safe-area, iOS install banner)

### O que o usuário espera

- Registrar rapidamente como está se sentindo (check-in < 2 minutos)
- Entender tendências do seu humor e sono ao longo do tempo
- Receber alertas quando algo parece fora do padrão
- Ter acesso rápido a recursos de crise (SOS sempre acessível)
- Compartilhar dados com psiquiatra de forma segura
- Aprender sobre sua condição com conteúdo confiável

---

## 4. Problemas de UX Evidentes

### 4.1 Sobrecarga de funcionalidades no menu `/mais`

O hub `/mais` apresenta **22 módulos em 5 categorias** de uma só vez. Para um usuário com transtorno bipolar — que pode estar em estado depressivo com baixa energia cognitiva ou em estado maníaco com dificuldade de foco — essa quantidade de opções é potencialmente esmagadora. Não há priorização visual clara do que é mais importante ou mais usado.

### 4.2 Fluxo de check-in potencialmente longo

O check-in exige seleção de **5 escalas obrigatórias** (humor, energia, ansiedade, irritabilidade, sono) + medicação + sinais de alerta (20 opções). Em dias ruins, preencher tudo pode parecer um fardo. Não há opção de "check-in mínimo" (ex: só humor + sono) para dias de baixa energia.

### 4.3 Avaliação semanal densa

O fluxo ASRM (5 itens) + PHQ-9 (9 itens) + FAST (7 itens) = **21 perguntas** em uma única sessão. Não há indicação de tempo estimado, e o progresso entre os 3 instrumentos não fica claro visualmente (apenas dots). Usuários em depressão podem abandonar no meio.

### 4.4 Navegação fragmentada entre sono e diário

Existem rotas separadas para `/sono`, `/sono/novo`, `/sono/tendencias`, `/diario`, `/diario/novo`, `/diario/tendencias`. A diferença entre "diário de check-in" e "meu diário" (texto livre) pode confundir. São 3 conceitos de "diário" no app (check-in snapshots, diário de humor, diário pessoal).

### 4.5 Feedback pós-ação inconsistente

Após o check-in, há feedback contextual detalhado (mensagens personalizadas). Porém, após registro de sono ou avaliação semanal, o feedback é mínimo ou ausente. A experiência pós-ação não é uniforme.

### 4.6 Narrativa AI com barreira de consentimento

A narrativa AI exige um checkbox de consentimento explícito antes de ser gerada. Embora necessário por LGPD, isso cria fricção a cada visualização. Usuários que já consentiram no onboarding podem achar redundante ver o checkbox toda vez.

### 4.7 Empty states genéricos

Os empty states seguem o padrão "Nenhum registro nos últimos X dias. [Criar primeiro registro]" — funcional mas frio. Não há orientação sobre o que o usuário ganha ao preencher, nem gamificação neste ponto.

### 4.8 Falta de orientação contextual para novos usuários

Após o onboarding, o `/hoje` apresenta muitos widgets de uma vez (Stability Score, SafetyNudge, termômetro, narrativa, conquistas, medicação). Não há tour guiado ou tooltips explicando cada seção. Um usuário recém-diagnosticado pode não entender o que é o "Stability Score" ou o "termômetro de humor".

### 4.9 Exercícios e sons sem integração com fluxo de crise

Os exercícios de respiração e aterramento existem em `/exercicios` e no `/sos`, mas são componentes separados. O `/sos` tem versões "quick" (QuickBreathing, GroundingGuide), enquanto `/exercicios` tem versões completas. A fragmentação pode confundir e reduz a descoberta.

### 4.10 Dados financeiros com barreira alta de entrada

O módulo `/financeiro` exige importação de CSV. Não há integração direta com bancos brasileiros (Open Finance) nem entrada manual simplificada. Para a maioria dos usuários, importar CSV é tecnicamente difícil.

---

## 5. Oportunidades de Melhoria de UX

### 5.1 Check-in adaptativo por estado

Implementar um "check-in mínimo" (apenas humor + medicação, 2 toques) para dias de baixa energia, com opção de expandir. Detectar padrões de uso: se o usuário pula check-ins em dias consecutivos, sugerir o modo mínimo ao invés de abandonar completamente.

### 5.2 Menu `/mais` contextualizado

Reorganizar o `/mais` para mostrar as 3-5 funcionalidades mais usadas pelo usuário no topo (baseado em frequência de uso). Agrupar o restante em seções colapsáveis. Adicionar badges de "novo" para features não exploradas.

### 5.3 Progresso visual na avaliação semanal

Adicionar barra de progresso numérica ("Pergunta 7 de 21"), tempo estimado ("~5 minutos"), e opção de salvar rascunho para continuar depois. Agrupar visualmente os 3 instrumentos com nome e ícone distintos.

### 5.4 Unificar conceitos de diário

Consolidar a nomenclatura: "Check-in" (snapshots rápidos), "Diário" (texto livre), "Histórico" (visualização). Evitar "Diário de Check-in" como rótulo — é confuso. No `/mais`, usar ícones mais distintos para cada tipo.

### 5.5 Feedback pós-ação consistente

Após cada registro (sono, avaliação, diário), exibir um feedback contextual similar ao do check-in: insight rápido sobre os dados registrados, streak atualizado, e link para próxima ação sugerida.

### 5.6 Consentimento AI persistente

Após o primeiro consentimento explícito para narrativa AI, salvar a preferência e não exigir checkbox a cada visualização. Manter um link "Gerenciar consentimentos" visível, mas remover a fricção recorrente.

### 5.7 Empty states motivacionais

Trocar "Nenhum registro" por mensagens contextuais: "Seu primeiro check-in vai começar a construir o termômetro de humor — leva só 1 minuto." Mostrar preview visual do que o widget mostrará com dados.

### 5.8 Tour guiado pós-onboarding

Implementar tooltips contextuais (coach marks) na primeira visita ao `/hoje`: explicar Stability Score, termômetro, SafetyNudge, e como acessar o SOS. Usar o perfil do onboarding (recém-diagnosticado = mais explicações).

### 5.9 Entrada financeira simplificada

Adicionar opção de registro manual rápido de gastos (valor + categoria + data) além do CSV. Isso reduz a barreira de entrada significativamente e permite correlação humor × gasto sem setup técnico.

### 5.10 Streaks e conquistas mais visíveis

As conquistas estão no `/hoje` mas sem destaque. Adicionar notificação/toast quando o usuário desbloqueia uma conquista, e micro-celebrações visuais (confetti, badge pulsante) para reforçar o hábito.

---

## 6. Ideias de Experimentos (A/B)

### Experimento 1: Check-in mínimo vs. completo

- **Hipótese**: Oferecer um check-in mínimo (2 campos) como default aumentará a taxa de preenchimento diário em 30%+.
- **Variante A (controle)**: Check-in completo (5 escalas + medicação + sinais de alerta)
- **Variante B**: Check-in mínimo (humor + medicação) com botão "Expandir" para campos adicionais
- **Métrica**: Taxa de check-in diário (% de dias com pelo menos 1 snapshot), retenção D7/D30
- **Segmentação**: Separar por perfil de onboarding (recém-diagnosticado vs. veterano)

### Experimento 2: Onboarding curto vs. completo

- **Hipótese**: Reduzir o onboarding de 7 para 3 steps (perfil + consentimento + pronto) aumentará a conversão cadastro → primeiro check-in.
- **Variante A (controle)**: 7 steps (welcome → profile → goal → anchor → week → consent → ready)
- **Variante B**: 3 steps (welcome+profile → consent → primeiro check-in inline)
- **Métrica**: % de usuários que completam onboarding, tempo até primeiro check-in, retenção D7
- **Risco**: Variante B pode perder personalização (goal/anchor). Monitorar satisfação.

### Experimento 3: Notificação de streak vs. insight

- **Hipótese**: Notificações push com micro-insight ("Seu humor melhorou 15% esta semana") geram mais re-engajamento que notificações de streak ("5 dias seguidos!").
- **Variante A**: Push com contagem de streak + emoji de fogo
- **Variante B**: Push com micro-insight derivado dos dados recentes
- **Métrica**: Taxa de abertura do push, check-in dentro de 2h após push, retenção semanal

### Experimento 4: Dashboard simplificado vs. completo

- **Hipótese**: Mostrar apenas 3 widgets no `/hoje` (status do dia + próxima ação + SOS) e colapsar o restante aumentará o engajamento com as ações primárias.
- **Variante A (controle)**: Dashboard completo (7+ widgets visíveis)
- **Variante B**: Dashboard focado (3 widgets + "Ver mais análises" expansível)
- **Métrica**: Cliques em "Registrar agora", tempo na página, scroll depth, taxa de uso de SOS

### Experimento 5: Linguagem clínica vs. coloquial nos alertas

- **Hipótese**: Trocar linguagem clínica ("Possíveis sinais mistos detectados") por linguagem coloquial ("Notamos que você está sentindo coisas opostas ao mesmo tempo — isso é comum no bipolar") aumentará a compreensão e ação do usuário.
- **Variante A (controle)**: Alertas com terminologia clínica atual
- **Variante B**: Alertas reescritos em linguagem cotidiana com explicação contextual
- **Métrica**: Taxa de clique nos alertas, uso de recursos sugeridos (CVV, exercícios), feedback qualitativo

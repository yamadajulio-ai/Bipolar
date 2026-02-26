# Backlog do Produto — Empresa Bipolar

## Epico 0: Calendario de Estabilidade (Core MVP)

- [x] Como **usuario**, quero criar blocos de atividades no planejador semanal para organizar minha rotina.
- [x] Como **usuario**, quero classificar blocos como ancora, flexivel ou risco para priorizar estabilidade.
- [x] Como **usuario**, quero configurar recorrencia (nenhuma/diaria/semanal) para blocos repetitivos.
- [x] Como **usuario**, quero criar excecoes para cancelar ou alterar ocorrencias especificas de blocos recorrentes.
- [x] Como **usuario**, quero navegar entre semanas no planejador para planejar com antecedencia.
- [x] Como **sistema**, quero detectar conflitos de horario entre blocos e exibir alertas.
- [x] Como **sistema**, quero alertar sobre atividades apos o horario limite (noites tardias).
- [x] Como **sistema**, quero alertar sobre violacao do periodo de wind-down antes de dormir.
- [x] Como **sistema**, quero proteger ancoras alertando quando blocos flexiveis conflitam com elas.
- [x] Como **sistema**, quero alertar quando o limite de noites tardias por semana e excedido.
- [x] Como **usuario**, quero configurar regras de estabilidade (horario limite, wind-down, protecao de ancoras).
- [x] Como **usuario**, quero ver a tela "Hoje" com proximo bloco, ancoras e orcamento de energia.
- [x] Como **usuario**, quero fazer check-in em 30 segundos (humor, energia, ansiedade, irritabilidade, sono, medicacao).
- [x] Como **usuario**, quero ver insights de regularidade de sono, ancoras IPSRT, carga de energia e noites de risco.
- [x] Como **sistema**, quero exibir observacoes suaves (nao alarmistas) sobre padroes detectados.

## Epico 0.1: Setup uma vez, roda sempre (v3.1.0)

- [x] Como **usuario**, quero salvar minha semana como template para reaplicar em outras semanas.
- [x] Como **usuario**, quero aplicar um template com opcoes de mesclar/substituir/preencher.
- [x] Como **usuario**, quero criar rotinas persistentes que repetem automaticamente.
- [x] Como **usuario**, quero pausar ou remover rotinas sem perder o bloco original.
- [x] Como **usuario**, quero copiar blocos de uma semana anterior para a semana atual.
- [x] Como **usuario**, quero adicionar blocos rapidamente digitando texto livre (quick-add).
- [x] Como **sistema**, quero detectar categoria automaticamente por keywords pt-BR sem IA.
- [x] Como **usuario**, quero smart defaults ao mudar categoria no modal.
- [x] Como **usuario novo**, quero configurar minha semana base no primeiro acesso.
- [x] Como **sistema**, quero buscar blocos recorrentes criados antes da semana visualizada.

## Épico 1: Autenticação e Conta

- [x] Como **usuário**, quero me cadastrar com e-mail e senha para acessar o aplicativo.
- [x] Como **usuário**, quero fazer login de forma segura para acessar meus dados.
- [x] Como **usuário**, quero fazer logout para encerrar minha sessão.
- [x] Como **usuário**, quero excluir minha conta para remover todos os meus dados permanentemente.
- [x] Como **sistema**, quero limitar tentativas de login para prevenir ataques de força bruta.
- [x] Como **sistema**, quero armazenar senhas com hash seguro para proteger dados dos usuários.

## Épico 2: Diário Expandido de Humor e Sono

- [x] Como **usuário**, quero registrar meu humor diário (1-5) para acompanhar padrões.
- [x] Como **usuário**, quero registrar minhas horas de sono para observar regularidade.
- [x] Como **usuário**, quero adicionar uma nota curta opcional ao meu registro diário.
- [x] Como **usuário**, quero ver o histórico dos meus registros dos últimos 30 dias.
- [x] Como **usuário**, quero registrar meu nível de energia (1-5) para perceber padrões.
- [x] Como **usuário**, quero registrar meu nível de ansiedade (1-5) para acompanhar ao longo do tempo.
- [x] Como **usuário**, quero registrar irritabilidade (1-5) como sinal precoce de episódios.
- [x] Como **usuário**, quero marcar se tomei medicação (sim/não/não lembro) sem especificar qual.
- [x] Como **usuário**, quero marcar sinais de alerta (checklist) para identificar padrões precocemente.
- [x] Como **sistema**, quero validar que humor esteja entre 1-5 e sono entre 0-24h.

## Épico 3: Painel de Tendências

- [x] Como **usuário**, quero ver gráficos de humor e sono ao longo do tempo para identificar padrões.
- [x] Como **usuário**, quero selecionar períodos (7/14/30/90 dias) para analisar diferentes janelas.
- [x] Como **usuário**, quero ver distribuição de humor (quantos dias em cada nível).
- [x] Como **sistema**, quero alertar quando sono diminui 3+ dias consecutivos.
- [x] Como **sistema**, quero alertar quando humor está persistentemente elevado (≥4 por 3+ dias).
- [x] Como **sistema**, quero alertar quando humor está persistentemente baixo (≤2 por 3+ dias).
- [x] Como **sistema**, quero incluir disclaimer em todos os alertas automáticos.

## Épico 4: Módulo de Sono

- [x] Como **usuário**, quero registrar horário de dormir e acordar para medir regularidade.
- [x] Como **usuário**, quero avaliar qualidade do sono (1-5) para identificar noites ruins.
- [x] Como **usuário**, quero registrar número de despertares noturnos.
- [x] Como **usuário**, quero marcar rotina pré-sono (tela, cafeína, leitura, respiração, etc.).
- [x] Como **usuário**, quero ver tendências de sono ao longo do tempo.
- [x] Como **sistema**, quero calcular variância de horário de sono e alertar sobre irregularidade.

## Épico 5: Exercícios de Respiração e Aterramento

- [x] Como **usuário**, quero fazer exercício de respiração 4-7-8 com animação visual.
- [x] Como **usuário**, quero fazer respiração quadrada (box breathing) para ansiedade.
- [x] Como **usuário**, quero fazer respiração diafragmática para aterramento.
- [x] Como **usuário**, quero fazer técnica 5-4-3-2-1 (5 sentidos) para aterramento sensorial.
- [x] Como **usuário**, quero fazer relaxamento muscular progressivo para liberar tensão.
- [x] Como **sistema**, quero registrar sessões de exercício para acompanhar frequência.

## Épico 6: Rastreador de Ritmo Social

- [x] Como **usuário**, quero registrar horários-âncora do dia (acordar, contato, atividade, jantar, dormir).
- [x] Como **usuário**, quero ver minha regularidade de ritmo ao longo da semana.
- [x] Como **usuário**, quero ver tendências de regularidade com gráficos.
- [x] Como **sistema**, quero calcular regularidade como métrica clínica (não gamificada).

## Épico 7: SOS de Crise

- [x] Como **usuário**, quero acesso rápido ao SOS em todas as telas (botão visível).
- [x] Como **usuário**, quero ver números de emergência (CVV 188, SAMU 192, UPA 24h) rapidamente.
- [x] Como **usuário**, quero iniciar respiração de emergência com um toque.
- [x] Como **usuário**, quero exercício guiado para quando não consigo dormir.
- [x] Como **usuário**, quero personalizar meu plano de crise (contatos, profissional, medicamentos, hospital).

## Épico 8: Sons Ambiente

- [x] Como **usuário**, quero ouvir ruído branco para foco ou sono.
- [x] Como **usuário**, quero ouvir ruído rosa e marrom para relaxamento.
- [x] Como **usuário**, quero ouvir simulação de chuva para relaxar.
- [x] Como **usuário**, quero controlar volume e programar timer de sono.

## Épico 9: Dashboard Inteligente e Relatório

- [x] Como **usuário**, quero ver status do dia atual no dashboard (registro feito ou não).
- [x] Como **usuário**, quero ver mini-gráfico dos últimos 7 dias.
- [x] Como **usuário**, quero receber sugestões contextuais baseadas em regras simples.
- [x] Como **usuário**, quero gerar relatório mensal imprimível para compartilhar com profissional.

## Épico 10: Cursos Estruturados

- [x] Como **usuário**, quero acessar cursos educacionais com aulas sequenciais.
- [x] Como **usuário**, quero marcar aulas como concluídas para acompanhar meu progresso.
- [x] Como **sistema**, quero exibir progresso como fração (ex: "3 de 8 aulas") sem gamificação.

## Épico 11: Lembretes e Preferências

- [x] Como **usuário**, quero configurar lembretes para registro diário e rotina.
- [x] Como **sistema**, quero usar Notification API do browser (sem push server).

## Épico 12: Legal e Compliance

- [x] Como **empresa**, quero publicar uma política de privacidade conforme LGPD.
- [x] Como **empresa**, quero publicar termos de uso que definam a natureza educacional do serviço.
- [x] Como **empresa**, quero configurar headers de segurança para proteger contra ataques comuns.
- [x] Como **empresa**, quero permitir que usuários excluam seus dados conforme LGPD.

## Priorização (MoSCoW)

| Funcionalidade | Prioridade | Status |
|---|---|---|
| **Calendario de Estabilidade** | Must | Feito |
| Planejador semanal (blocos/recorrencia) | Must | Feito |
| Motor de regras (alertas de estabilidade) | Must | Feito |
| Tela Hoje (autopiloto) | Must | Feito |
| Check-in 30s | Must | Feito |
| Insights (regularidade/carga/risco) | Must | Feito |
| Cadastro/Login seguro | Must | Feito |
| Diario expandido | Must | Feito |
| Modulo de sono | Must | Feito |
| Exercicios de respiracao/aterramento | Must | Feito |
| Rastreador de ritmo social | Must | Feito |
| SOS de crise | Must | Feito |
| Plano de crise personalizado | Must | Feito |
| Biblioteca de conteudos | Must | Feito |
| Area familias | Must | Feito |
| Privacidade e termos | Must | Feito |
| Exclusao de conta | Must | Feito |
| Sons ambiente | Should | Feito |
| Relatorio mensal | Should | Feito |
| Cursos estruturados | Should | Feito |
| Lembretes | Should | Feito |
| **Setup uma vez, roda sempre** | Must | Feito |
| Templates de semana | Must | Feito |
| Rotinas persistentes | Must | Feito |
| Copiar semana | Must | Feito |
| Quick-add deterministico | Must | Feito |
| Smart defaults | Should | Feito |
| Onboarding first-run | Must | Feito |
| Modo escuro | Won't | — |
| Comunidade/chat | Won't | — |

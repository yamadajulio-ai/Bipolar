# PRD — Empresa Bipolar

## Objetivo

Criar uma plataforma web educativa e de auto-organização para pessoas com Transtorno Afetivo Bipolar tipo 1 (TAB1) e suas famílias. O produto não substitui tratamento médico ou psicológico.

## Público-alvo

- Pessoas diagnosticadas com TAB tipo 1
- Familiares e cuidadores
- Profissionais de saúde que desejam indicar um recurso confiável

## Funcionalidades

### Core: Calendario de Estabilidade (MVP)

O modulo central e o **Calendario de Estabilidade**, um planejador semanal TAB-first:

1. **Planejador Semanal** — blocos de atividades (ancora, flexivel, risco), recorrencia (nenhuma/diaria/semanal) e excecoes por data
2. **Motor de regras transparente** — detecta conflitos de horario, noites tardias, violacao de wind-down, protecao de ancoras, limite de noites tardias por semana
3. **Tela "Hoje"** — proximo bloco com contagem regressiva, ancoras do dia, orcamento de energia e acoes rapidas
4. **Check-in 30s** — salva humor, energia, ansiedade, irritabilidade, sono e medicacao via DiaryEntry existente
5. **Insights** — regularidade de sono (variancia de horarios), regularidade de ancoras (IPSRT), carga semanal de energia, noites de risco

### Setup uma vez, roda sempre (v3.1.0)

Reducao drastica da entrada manual:

6. **Templates de Semana** — salvar/aplicar semanas com 3 modos (mesclar/preencher/substituir)
7. **Rotinas Persistentes** — blocos que repetem automaticamente (flag isRoutine, sem modelo novo)
8. **Copiar Semana** — clonar blocos de semana anterior com deteccao de duplicatas
9. **Quick Add** — parser deterministico pt-BR para adicionar blocos por texto (0 IA)
10. **Smart Defaults** — auto-preenchimento de energia/tipo/duracao por categoria
11. **Onboarding First-Run** — setup de horarios base + rotinas comuns no primeiro acesso

### Modulos Complementares (Implementados)

1. **Landing page** com proposito, disclaimers e CTAs (criar conta / entrar)
2. **Cadastro e login** seguros (bcrypt, sessao HttpOnly, rate limiting)
3. **Diario expandido** — humor (1-5), sono, energia, ansiedade, irritabilidade, adesao a medicacao, sinais de alerta
4. **Modulo de sono** — registro detalhado (horarios, qualidade, despertares, rotina pre-sono), tendencias
5. **Exercicios de respiracao** — 4-7-8, quadrada, diafragmatica com animacao visual CSS
6. **Tecnicas de aterramento** — 5 sentidos (5-4-3-2-1), relaxamento muscular progressivo
7. **Rastreador de ritmo social** — baseado na IPSRT, monitora regularidade de horarios
8. **SOS de crise interativo** — botao sempre visivel, interface escura, respiracao rapida, numeros de emergencia
9. **Plano de crise personalizado** — contatos de confianca, profissional, medicamentos, hospital, estrategias
10. **Sons ambiente** — ruido branco/rosa/marrom, chuva (Web Audio API), timer de sono
11. **Relatorio mensal** — resumo imprimivel para compartilhar com profissionais
12. **Cursos estruturados** — 4 cursos com aulas sequenciais (progresso nao gamificado)
13. **Biblioteca de conteudos** — 11+ artigos markdown sobre TAB1
14. **Lembretes gentis** — Notification API do browser para rotina
15. **Area familias** — checklist de apoio, guia de comunicacao
16. **Politica de privacidade** e **termos de uso** em pt-BR
17. **Exclusao de conta** — remocao permanente de dados

### Fora de escopo

- Comunidade / fórum / chat
- Recomendações de IA
- Ferramenta de diagnóstico
- Funcionalidades sociais (perfil público, compartilhamento)
- Gamificação (streaks, rankings, desafios, badges, pontos)
- Recomendação de medicação ou dosagem

## Métricas de sucesso

| Métrica | Meta |
|---------|------|
| Usuários cadastrados | Validar fluxo funcional |
| Blocos criados no planejador por semana | ≥ 5 |
| Check-ins 30s por semana | ≥ 3 |
| Regularidade de ancoras (IPSRT) | Monitorar tendencia |
| Registros no diario por usuario/semana | ≥ 2 |
| Exercicios realizados por semana | ≥ 1 |
| Visitas ao plano de crise | Monitorar (sem meta numerica) |

## Restrições

- Sem gamificação: nenhum streak, ranking, badge ou mensagem motivacional agressiva
- Sem aconselhamento clínico: nenhuma recomendação de medicação ou dosagem
- LGPD: dados de saúde são sensíveis, minimizar coleta, permitir exclusão
- Todo conteúdo em pt-BR
- Linguagem compassiva, respeitosa e não alarmista
- Disclaimers visíveis em todas as páginas

# PRD — MVP Empresa Bipolar

## Objetivo

Criar um MVP web educativo e de auto-organização para pessoas com Transtorno Afetivo Bipolar tipo 1 (TAB1) e suas famílias. O produto não substitui tratamento médico ou psicológico.

## Público-alvo

- Pessoas diagnosticadas com TAB tipo 1
- Familiares e cuidadores
- Profissionais de saúde que desejam indicar um recurso confiável

## Funcionalidades

### Must-have (MVP)

1. **Landing page** com propósito, disclaimers e CTAs (criar conta / entrar)
2. **Cadastro e login** seguros (bcrypt, sessão HttpOnly, rate limiting)
3. **Diário de humor e sono** — criar registro (data, humor 1-5, sono, nota curta) e listar histórico
4. **Biblioteca de conteúdos** — 10 artigos markdown sobre TAB1, listagem com tempo de leitura, página individual com disclaimer
5. **Plano de crise** — sinais de alerta, passos seguros, recursos Brasil (CVV 188, SAMU 192, UPA 24h)
6. **Área famílias** — checklist de apoio, guia de comunicação, o que evitar
7. **Política de privacidade** e **termos de uso** em pt-BR
8. **Exclusão de conta** — endpoint para remoção permanente de dados
9. **Disclaimers** visíveis em todas as áreas relevantes

### Nice-to-have (pós-MVP)

- Gráficos de evolução do humor/sono (recharts)
- Tracking de visualização de conteúdos (ContentView)
- Contatos pessoais de crise salvos pelo usuário
- Exportação do diário em PDF
- Modo escuro
- PWA (Progressive Web App)
- Preferências de notificação
- Filtros avançados no diário (por período)

### Fora de escopo

- Comunidade / fórum / chat
- Rastreamento de medicação
- Recomendações de IA
- Ferramenta de diagnóstico
- Funcionalidades sociais (perfil público, compartilhamento)
- Gamificação (streaks, rankings, desafios)

## Métricas de sucesso

| Métrica | Meta MVP |
|---------|----------|
| Usuários cadastrados | Validar fluxo funcional |
| Registros no diário por usuário/semana | ≥ 2 |
| Visualizações de conteúdo | Distribuição entre artigos |
| Visitas ao plano de crise | Monitorar (sem meta numérica) |

## Restrições

- Sem gamificação: nenhum streak, ranking ou mensagem motivacional agressiva
- Sem aconselhamento clínico: nenhuma recomendação de medicação ou dosagem
- LGPD: dados de saúde são sensíveis, minimizar coleta, permitir exclusão
- Todo conteúdo em pt-BR
- Linguagem compassiva, respeitosa e não alarmista

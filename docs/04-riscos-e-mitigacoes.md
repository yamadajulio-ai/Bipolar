# Riscos e Mitigacoes

## Matriz de Riscos

| Risco | Severidade | Probabilidade | Mitigacao |
|-------|-----------|---------------|-----------|
| **Usuario em episodio maniaco toma decisoes prejudiciais com base no conteudo** | Critica | Media | Todo conteudo incluira avisos de que nao substitui orientacao profissional. Funcionalidades de diario nao oferecerrao interpretacoes ou sugestoes automaticas. O plano de crise sera incentivado como ferramenta preventiva, elaborada em periodos de estabilidade. |
| **Desinformacao sobre medicacao** | Critica | Baixa | A plataforma NAO abordara medicamentos especificos, dosagens ou efeitos colaterais detalhados. Conteudo educacional orientara o usuario a discutir toda questao farmacologica exclusivamente com seu psiquiatra. |
| **Vazamento de dados sensiveis de saude mental** | Critica | Baixa | Criptografia em transito (TLS) e em repouso. Coleta minima de dados (privacy by design). Autenticacao segura. Auditorias periodicas de seguranca. Plano de resposta a incidentes documentado. |
| **Usuario utiliza a plataforma em vez de buscar ajuda profissional** | Alta | Media | Avisos persistentes em todas as telas de que a plataforma nao substitui tratamento. Links para CAPS, CVV (188) e SAMU (192) em posicao de destaque. Conteudo educacional reforcar constantemente a importancia do acompanhamento profissional. |
| **Gamificacao desencadeia comportamento compulsivo ou maniaco** | Alta | N/A (Eliminado) | Decisao de design: nenhuma mecanica de gamificacao sera implementada. Sem pontos, streaks, rankings, conquistas ou notificacoes motivacionais. Este risco e eliminado por decisao arquitetural. |
| **Nao conformidade com a LGPD** | Alta | Baixa | Implementacao de privacy by design desde o inicio. Base legal clara para tratamento de dados sensiveis (consentimento explicito). Politica de privacidade em linguagem acessivel. Canal de atendimento para exercicio dos direitos do titular. Nomeacao de encarregado de dados (DPO). |
| **Conteudo interpretado como orientacao clinica** | Alta | Media | Toda pagina de conteudo educacional incluira disclaimer visivel e padronizado. Linguagem cuidadosamente revisada para informar sem prescrever. Revisao por profissionais de saude mental antes da publicacao. |
| **Usuario em crise sem orientacao adequada** | Critica | Media | Botao de crise acessivel em todas as telas com acesso direto aos numeros CVV (188), SAMU (192) e orientacao para ir ao pronto-socorro mais proximo. Plano de crise incentivado como ferramenta preventiva. Conteudo educacional sobre sinais de alerta e quando buscar ajuda emergencial. |
| **Retencao de dados alem do necessario** | Media | Media | Politica clara de retencao com prazos definidos. Funcionalidade de exclusao de conta e dados pelo proprio usuario. Exclusao automatica de contas inativas apos periodo definido e comunicado. Revisao periodica dos dados armazenados. |
| **Linguagem estigmatizante no conteudo** | Media | Media | Guia de estilo editorial com termos aprovados e termos proibidos (ex: usar "pessoa com transtorno bipolar" em vez de "bipolar" como substantivo). Revisao de todo conteudo por profissionais com experiencia em saude mental e comunicacao inclusiva. Canal de feedback para usuarios reportarem linguagem inadequada. |

## Processo de Gestao de Riscos

Esta matriz sera revisada a cada ciclo de desenvolvimento e sempre que novas funcionalidades forem propostas. Novos riscos identificados serao adicionados e avaliados antes da implementacao de qualquer feature relacionada. A severidade e a probabilidade serao reavaliadas periodicamente com base em dados reais de uso da plataforma.

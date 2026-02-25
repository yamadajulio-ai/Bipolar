# Backlog do Produto — Empresa Bipolar

## Épico 1: Autenticação e Conta

- Como **usuário**, quero me cadastrar com e-mail e senha para acessar o aplicativo.
- Como **usuário**, quero fazer login de forma segura para acessar meus dados.
- Como **usuário**, quero fazer logout para encerrar minha sessão.
- Como **usuário**, quero excluir minha conta para remover todos os meus dados permanentemente.
- Como **sistema**, quero limitar tentativas de login para prevenir ataques de força bruta.
- Como **sistema**, quero armazenar senhas com hash seguro para proteger dados dos usuários.

## Épico 2: Diário de Humor e Sono

- Como **usuário**, quero registrar meu humor diário (1-5) para acompanhar padrões.
- Como **usuário**, quero registrar minhas horas de sono para observar regularidade.
- Como **usuário**, quero adicionar uma nota curta opcional ao meu registro diário.
- Como **usuário**, quero ver o histórico dos meus registros dos últimos 30 dias.
- Como **usuário**, quero que os rótulos de humor sejam neutros (não motivacionais) para evitar pressão.
- Como **sistema**, quero validar que humor esteja entre 1-5 e sono entre 0-24h.

## Épico 3: Biblioteca de Conteúdos

- Como **usuário**, quero ver uma lista de conteúdos educacionais sobre TAB para me informar.
- Como **usuário**, quero ler um artigo completo com layout legível.
- Como **usuário**, quero ver o tempo estimado de leitura para planejar meu tempo.
- Como **sistema**, quero exibir disclaimer educacional em todos os conteúdos.
- Como **profissional indicante**, quero que o conteúdo seja confiável e sem aconselhamento clínico.

## Épico 4: Plano de Crise e Famílias

- Como **usuário**, quero acessar orientações sobre sinais de alerta para reconhecer episódios.
- Como **usuário**, quero ver passos seguros para momentos de crise.
- Como **usuário**, quero ter acesso rápido aos números de emergência (CVV 188, SAMU 192, UPA 24h).
- Como **familiar**, quero um checklist de como apoiar alguém com TAB.
- Como **familiar**, quero um guia sobre comunicação, limites e sinais precoces.
- Como **familiar**, quero saber o que evitar (discutir medicação, minimizar sentimentos).
- Como **sistema**, quero exibir disclaimers sobre buscar apoio profissional.

## Épico 5: Legal e Compliance

- Como **empresa**, quero publicar uma política de privacidade conforme LGPD.
- Como **empresa**, quero publicar termos de uso que definam a natureza educacional do serviço.
- Como **empresa**, quero configurar headers de segurança para proteger contra ataques comuns.
- Como **empresa**, quero permitir que usuários excluam seus dados conforme LGPD.
- Como **empresa**, quero que nenhum dado sensível seja logado em texto.
- Como **empresa**, quero manter um checklist de compliance atualizado.

## Priorização (MoSCoW)

| Funcionalidade | Prioridade |
|---|---|
| Cadastro/Login seguro | Must |
| Diário (criar + listar) | Must |
| Biblioteca de conteúdos | Must |
| Plano de crise | Must |
| Área famílias | Must |
| Privacidade e termos | Must |
| Exclusão de conta | Must |
| Gráficos do diário | Should |
| Filtros avançados | Should |
| Contatos pessoais de crise | Could |
| Exportação PDF | Could |
| Modo escuro | Won't (MVP) |
| Comunidade/chat | Won't (MVP) |

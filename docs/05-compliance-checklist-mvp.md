# Checklist de Compliance — MVP

## LGPD (Lei Geral de Proteção de Dados)

- [x] Política de privacidade publicada e acessível
- [x] Dados coletados são minimizados (apenas e-mail, senha hash, humor, sono, notas curtas)
- [x] Direito de exclusão implementado (endpoint de exclusão de conta)
- [x] Dados de saúde (humor/sono) tratados como dados sensíveis
- [x] Senhas armazenadas com hash (bcrypt, custo 12)
- [x] Contato do encarregado (DPO) informado na política de privacidade
- [ ] Registro de atividades de tratamento de dados (ROPA) — planejado para v2
- [ ] Relatório de impacto à proteção de dados (RIPD) — planejado para v2
- [x] Não compartilhamento de dados com terceiros
- [x] Dados não utilizados para marketing ou venda

## Termos de Uso

- [x] Termos publicados e acessíveis
- [x] Natureza educacional claramente informada
- [x] Disclaimers sobre não substituição de tratamento médico
- [x] Recursos de emergência visíveis (CVV 188, SAMU 192, UPA 24h)
- [x] Limitação de responsabilidade documentada
- [x] Regras de conduta definidas

## Segurança

- [x] Senhas hasheadas com bcrypt (custo 12)
- [x] Sessões em cookies HttpOnly, Secure, SameSite=Lax
- [x] Rate limiting no endpoint de login (5 tentativas / 15 min)
- [x] Validação de inputs com zod em todas as APIs
- [x] Prevenção de SQL injection via Prisma ORM (queries parametrizadas)
- [x] Security headers configurados (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] Dados sensíveis não logados em texto
- [x] Sanitização de HTML no conteúdo markdown (rehype-sanitize)
- [x] Proteção de rotas autenticadas via middleware
- [x] .env.example sem segredos reais

## Conteúdo

- [x] Todos os artigos revisados: sem recomendação de medicação
- [x] Sem instruções clínicas ou dosagens
- [x] Disclaimers presentes em todos os conteúdos
- [x] Números de emergência visíveis em todas as páginas relevantes
- [x] Linguagem compassiva e não alarmista
- [x] Sem incentivo a privação de sono ou substâncias
- [x] Sem gamificação (streaks, rankings, desafios)

## Gestão de Incidentes

- [ ] Plano de resposta a incidentes documentado
- [ ] Template de comunicação de incidentes
- [ ] Canal de reporte de vulnerabilidades
- [ ] Processo de notificação à ANPD em caso de vazamento
- [ ] Backup regular dos dados

### Próximos passos (pós-MVP)

1. Implementar ROPA (Registro de Operações de Tratamento)
2. Realizar RIPD (Relatório de Impacto)
3. Contratar DPO formal
4. Implementar auditoria de acesso a dados
5. Plano de resposta a incidentes completo

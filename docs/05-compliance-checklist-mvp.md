# Checklist de Compliance — MVP

## LGPD (Lei Geral de Proteção de Dados)

- [x] Política de privacidade publicada e acessível
- [x] Dados coletados são minimizados (e-mail, senha hash, humor, sono, diário, avaliações)
- [x] Direito de exclusão implementado (endpoint de exclusão de conta, hard delete/cascade)
- [x] Dados de saúde (humor/sono/diário/avaliações) tratados como dados sensíveis (art. 11)
- [x] Senhas armazenadas com argon2id (OWASP recommended), fallback bcrypt legado
- [x] Contato do encarregado (DPO) informado na política de privacidade
- [x] ROPA — Registro de Operações de Tratamento (v1, docs/lgpd-pack.md, mar/2026)
- [x] RIPD — Relatório de Impacto à Proteção de Dados (v1, docs/lgpd-pack.md, mar/2026)
- [x] Matriz de Retenção de Dados (v1, docs/lgpd-pack.md, mar/2026)
- [x] Mapa de Base Legal (v1, docs/lgpd-pack.md, mar/2026)
- [x] Não compartilhamento de dados com terceiros (exceto processadores documentados no ROPA)
- [x] Dados não utilizados para marketing ou venda
- [x] Consentimento granular: 7+ scopes versionados, Consent Center com toggles
- [x] Transferência internacional documentada (Vercel, Neon, OpenAI, Anthropic, Sentry — EUA)
- [ ] DPA/SCC formalizados com todos os operadores (em andamento)
- [ ] Expansão de consent scopes: assessments, crisis_plan, sos, clinical_export (P1)

## Termos de Uso

- [x] Termos publicados e acessíveis
- [x] Natureza educacional claramente informada
- [x] Disclaimers sobre não substituição de tratamento médico
- [x] Recursos de emergência visíveis (CVV 188, SAMU 192, UPA 24h)
- [x] Limitação de responsabilidade documentada
- [x] Regras de conduta definidas

## Segurança

- [x] Senhas hasheadas com argon2id (OWASP recommended)
- [x] Sessões: iron-session criptografada, HttpOnly, Secure, SameSite=Lax
- [x] Session lifecycle: 7d inactivity + 30d absolute + 1h sliding refresh
- [x] CSRF: 4 camadas (Sec-Fetch-Site + Origin + Referer + double-submit cookie __Host-csrf)
- [x] Rate limiting atômico ($transaction) em 30+ API routes
- [x] Validação de inputs com Zod em todas as APIs
- [x] Prevenção de SQL injection via Prisma ORM (queries parametrizadas)
- [x] CSP enforced (não report-only)
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] Dados sensíveis não logados em texto (Sentry PII scrubbing)
- [x] IP masking /24 IPv4, /64 IPv6 (LGPD minimização)
- [x] Clear-Site-Data no logout
- [x] Proteção de rotas autenticadas via middleware
- [x] SSRF defense: numeric IP parser + push service allowlist
- [x] Cloudflare WAF: 2 rate limiting rules (auth 20/min, AI 10/min)
- [x] .env.example sem segredos reais

## Conteúdo

- [x] Todos os artigos revisados: sem recomendação de medicação
- [x] Sem instruções clínicas ou dosagens
- [x] Disclaimers presentes em todos os conteúdos
- [x] Números de emergência visíveis em todas as páginas relevantes
- [x] Linguagem compassiva e não alarmista
- [x] Sem incentivo a privação de sono ou substâncias
- [x] Gamificação responsável (streaks de adesão, sem rankings competitivos)

## Gestão de Incidentes

- [ ] Plano de resposta a incidentes documentado
- [ ] Template de comunicação de incidentes
- [ ] Canal de reporte de vulnerabilidades
- [ ] Processo de notificação à ANPD em caso de vazamento
- [x] Backup: Cloudflare R2 (bucket suporte-bipolar-backups)

### Próximos passos

1. Formalizar DPA/SCC com processadores (Vercel, Neon, OpenAI, Anthropic, Sentry)
2. Expandir consent scopes (assessments, crisis_plan, sos, clinical_export)
3. Plano de resposta a incidentes completo
4. Drill de restauração Neon
5. Revisão anual pós-Resolução ANPD 19/2024 e 31/2025

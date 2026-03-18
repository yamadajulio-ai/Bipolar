# Briefing: Sistema de Feedback — Suporte Bipolar

## Status: AUDITADO ✅ (GPT Pro — 2026-03-18)

**Escopo aprovado para MVP**: Camada 1 (Formulário) + Camada 2 (Micro-feedback contextual)
**Diferido para fase 2**: Camada 3 (NPS) — requer estado server-side + janela de estabilidade emocional

---

## Contexto

O Suporte Bipolar é um app web (PWA) para brasileiros com transtorno bipolar, mobile-first (iPhone). Hoje o app **não possui nenhum mecanismo de feedback geral** — o único feedback existente são botões "útil/não útil" em alertas financeiros (`AlertFeedback`).

Os emails `contato@suportebipolar.com` e `privacidade@suportebipolar.com` já estão ativos via Cloudflare Email Routing → Gmail.

**Objetivo**: criar canais para que os usuários bipolares possam dar feedback sobre o app de forma acessível, segura e respeitosa ao seu estado emocional.

---

## Público-alvo

- Brasileiros com transtorno bipolar (18+)
- Uso principal via iPhone (mobile-first, PWA)
- Idioma: pt-BR
- **Sensibilidade**: usuários podem estar em estados emocionais variados (depressão, mania, eutimia) — o sistema precisa ser gentil, nunca intrusivo

---

## Stack atual

- Next.js 15 (App Router, Server Components)
- TypeScript, Tailwind CSS
- Prisma + PostgreSQL (Neon)
- Deploy: Vercel (push main → auto-deploy)
- Auth: NextAuth (Google OAuth + credentials)
- Rate limiting existente via `checkRateLimit` (atômico, Prisma `$transaction`)
- Sem biblioteca de toast/modal — usa componente `Alert` inline
- Padrão de feedback existente: `AlertFeedbackButtons` (fire-and-forget, optimistic UI)

---

## MVP: 2 camadas aprovadas

### Camada 1 — Formulário de Feedback (página dedicada)

**Localização**: `/feedback` (novo item na seção "Configurações" do `/mais`)

**Campos**:
- **Categoria** (select): Sugestão, Problema/Bug, Elogio, Outro
  - ⚠️ "Dúvida" removida — canal de feedback não deve virar help desk sem suporte humano
- **Mensagem** (textarea): texto livre, max 2000 caracteres
- **Tela relacionada** (select, opcional): lista das telas do app (Hoje, Check-in, Sono, Insights, etc.)
- **Contato** (toggle): "Posso entrar em contato sobre este feedback?" (default: não)
  - ⚠️ Nota por estrelas removida — redundante com thumbs (camada 2) e futuro NPS (camada 3). Três gramáticas de avaliação aumentam carga cognitiva sem valor analítico proporcional.

**Metadados silenciosos** (coletados automaticamente, não visíveis ao usuário):
- Rota atual (`window.location.pathname`)
- Versão do app (build hash ou package.json version)
- Tipo de cliente (PWA standalone / Safari / Chrome)
- `sourceContext` simples (ex: "mais/feedback")

**Copy de privacidade na tela** (acima do textarea):
> "Para proteger sua privacidade, evite incluir nomes, telefones, medicação, diagnóstico detalhado ou informações de crise. Este campo é para falar sobre o app."

**Protocolo de contenção de crise no texto livre**:
1. Copy claro: "Este canal **não é monitorado em tempo real**."
2. CTA sempre visível: link para SOS/Plano de Crise + "Em risco imediato? CVV 188 · SAMU 192"
3. Detecção simples de alto risco no backend (keywords): NÃO bloqueia envio → marca `priority: "high"`, dispara alerta interno, mostra mensagem acolhedora com caminhos de ajuda
4. Jamais prometer resposta humana rápida se a operação não existir

**Comportamento**:
- Autenticado (requer login)
- Rate limit: 5 feedbacks por hora por usuário
- Confirmação inline após envio (componente Alert success)
- Sem redirecionamento — usuário continua na mesma tela

**API**: `POST /api/feedback`

### Camada 2 — Micro-feedback contextual

Botões thumbs up/down em pontos estratégicos do app:

| Local | Pergunta | contextKey |
|-------|----------|------------|
| Insights (após ver análise) | "Esta análise foi útil?" | `insight:<yyyy-mm-dd>` |
| Conteúdos educativos | "Este conteúdo foi útil?" | `content:<id>` |
| Relatório profissional | "Este relatório ajudou na consulta?" | `report:<id>` |

⚠️ **Pós-SOS removido do MVP** — pedir "esta conversa ajudou?" logo após um fluxo de crise pode soar como QA em cima de sofrimento. Reavaliar na fase 2 com distância temporal (ex: 24h depois).

**Padrão**: idêntico ao `AlertFeedbackButtons` existente (fire-and-forget, upsert)

**API**: `POST /api/feedback/contextual`

---

## Fase 2 (diferida): NPS

**Pré-requisitos antes de implementar**:
1. Estado server-side completo (não só localStorage): `lastShownAt`, `snoozedUntil`, `dismissedForeverAt`, `lastAnsweredAt`
2. Janela de estabilidade emocional ampla: mostrar apenas se últimos check-ins NÃO indicarem depressão severa NEM ativação alta/mania, E sem uso de SOS/plano de crise nos últimos 7 dias
3. Trigger contextual: mostrar após momento de valor (ex: concluiu check-in + leu insight)
4. Cooldowns: 90 dias após resposta, 30 dias após "Agora não", reaparição por janela estável (não cronômetro cego)
5. localStorage apenas como cache de conveniência, não como fonte canônica

---

## Modelo de dados (Prisma) — Corrigido pela auditoria

```prisma
model Feedback {
  id           String   @id @default(cuid())
  userId       String
  category     String   // "suggestion" | "bug" | "praise" | "other"
  message      String
  screen       String?  // tela relacionada (opcional)
  canContact   Boolean  @default(false)
  priority     String   @default("normal") // "normal" | "high" (crise detectada)
  // Metadados silenciosos
  route        String?  // rota atual do usuário
  appVersion   String?  // versão do build
  clientType   String?  // "pwa" | "safari" | "chrome"
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
  @@index([category])
  @@index([priority])
}

model ContextualFeedback {
  id         String   @id @default(cuid())
  userId     String
  contextKey String   // "insight:2026-03-18" | "content:abc123" | "report:xyz789"
  useful     Boolean
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, contextKey])
  @@index([contextKey])
}

// Fase 2 — NPS (não implementar ainda)
// model NPSPromptState {
//   id                 String    @id @default(cuid())
//   userId             String    @unique
//   lastShownAt        DateTime?
//   snoozedUntil       DateTime?
//   dismissedForeverAt DateTime?
//   lastAnsweredAt     DateTime?
//   user               User      @relation(...)
// }
//
// model NPSResponse {
//   id        String   @id @default(cuid())
//   userId    String
//   score     Int      // 0-10
//   comment   String?
//   createdAt DateTime @default(now())
//   user      User     @relation(...)
//   @@index([userId])
//   @@index([createdAt])
// }
```

**Correção da auditoria**: `@@unique([userId, feature, date])` → `@@unique([userId, contextKey])`. A chave anterior colidiria em múltiplos conteúdos/relatórios/conversas SOS no mesmo dia.

---

## Onde o feedback é consultado

**MVP (aprovado)**:
1. **Formulário textual**: registro em banco + alerta por email (mínimo: ID, categoria, usuário, horário, trecho curto — NÃO texto completo por email para evitar duplicação de dado sensível)
2. **Micro-feedback + dados agregados**: apenas banco
3. **Backoffice mínimo** em `/admin/feedback`: read-only, lista + filtros + busca (não precisa ser dashboard completo, precisa ser operacional)

**Por que não só email**: contextual gera volume alto e pouca legibilidade em caixa de entrada. Email completo duplica dado potencialmente sensível em banco + provedor de envio + Cloudflare routing + Gmail.

---

## Segurança e LGPD

- **Tratar pipeline inteiro como potencialmente sensível** — texto livre inevitavelmente receberá informação de saúde
- Cascade delete: se usuário excluir conta, todo feedback é deletado
- Rate limiting em todas as rotas
- Sanitização de input (XSS prevention)
- Export LGPD: incluir Feedback + ContextualFeedback no endpoint `/api/auth/export`
- Campo `canContact` respeita consentimento explícito
- Email de alerta: apenas metadados mínimos (ID, categoria, hora, trecho) — conteúdo integral só via backoffice restrito
- Documentar: finalidade, base legal, retenção, quem acessa, exportação e exclusão
- Se houver triagem por IA/LLM no futuro: entrar no desenho contratual e de privacidade desde o início
- ANPD: dados de saúde são sensíveis; legítimo interesse NÃO se aplica; "tutela da saúde" é restrita a profissionais/autoridade sanitária

---

## Acessibilidade

- Formulário com `htmlFor`, `aria-required`, `role="group"` onde aplicável
- Confirmação com `role="status"` e `aria-live="polite"`
- Micro-feedback: mesmo padrão do `AlertFeedbackButtons` (já acessível)
- Contraste AA em todos os elementos (seguir padrão existente)

---

## Navegação

```
/mais
└── Configurações
    ├── Plano de crise
    ├── Integrações
    ├── Perfil socioeconômico
    ├── Acesso profissional
    ├── Feedback ← NOVO (MVP)
    └── Conta
```

---

## Referências internas

- Padrão existente: `src/app/api/financeiro/feedback/route.ts` (53 lines)
- UI reference: `AlertFeedbackButtons` em `src/app/(app)/financeiro/page.tsx` (lines 648-685)
- Rate limiting: `src/lib/rate-limit.ts`
- Página /mais: `src/app/(app)/mais/page.tsx`
- Conta: `src/app/(app)/conta/page.tsx`
- Layout: `src/app/(app)/layout.tsx`

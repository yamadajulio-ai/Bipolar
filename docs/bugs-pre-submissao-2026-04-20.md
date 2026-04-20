# Bugs identificados em smoke test TestFlight — 2026-04-20

**Build testado:** Suporte Bipolar 1.0 (1) — uploaded 2026-03-31
**Dispositivo:** iPhone 17 Pro Max
**Ambiente:** TestFlight interno
**Data do teste:** 2026-04-20

---

## 0. Env vars Apple com `\n` no final (CAUSA RAIZ — CORRIGIDO 2026-04-20)

### Sintoma
- Apple Sign-In nativo falha com erro genérico "Não foi possível entrar com Apple"
- Apple Sign-In web falha com "Inscrição Não Concluída" no dialog do Apple
- Qualquer validação JWT ou chamada ao Apple API quebra silenciosamente

### Causa raiz
Todas as 5 env vars single-line Apple no Vercel Production foram cadastradas com newline literal (`\n`) no final do valor — provavelmente paste acidental com Enter no campo do dashboard:

```
APPLE_CLIENT_ID="com.suportebipolar.web\n"
APPLE_NATIVE_CLIENT_ID="com.suportebipolar.app\n"
APPLE_KEY_ID="2VJCJ775N5\n"
APPLE_TEAM_ID="7MQYXX5DRU\n"
APPLE_REDIRECT_URI="https://suportebipolar.com/api/auth/apple-login/callback\n"
```

Impacto: JWT audience check em `verifyAppleIdentityToken` comparava `aud=com.suportebipolar.app` (do iOS) com `com.suportebipolar.app\n` → mismatch → 500 → frontend mostra catch-all.

### Fix aplicado
Removido e re-adicionado cada env var via `vercel env add` com `printf` (sem `\n`). Redeploy production forçado para funções pegarem novos valores. `APPLE_PRIVATE_KEY` não alterado — PEM contém newlines legítimos.

### Validação pendente
- [ ] Apple Sign-In nativo: força-close do app, reabre, "Continuar com Apple" → dialog fullscreen nativo → login completa → chega em `/hoje` ou `/onboarding`
- [ ] Se falhar: checar se `APPLE_PRIVATE_KEY` também tem issue de newline
- [ ] Reverificar se os mesmos valores estão corretos em Preview/Development envs (se existirem)

---

## 1. OAuth Google — SFSafariViewController não fecha após login (BLOQUEADOR)

### Sintoma
- Usuário toca "Continuar com Google" → abre SFSafariViewController in-app
- Completa fluxo OAuth no Google
- Safari volta pro app **mas não fecha** — fica mostrando `suportebipolar.com` com barra do Safari no topo
- App funciona "por cima" do Safari, mas contexto é **web (cookies Safari)**, não Capacitor nativo

### Consequências em cadeia
- **Face ID não aparece** em `Menu → Conta` (plugin Capacitor Face ID só funciona em contexto nativo)
- **Barra `suportebipolar.com` visível** no topo da tela (quebra experiência de app nativo — motivo de rejeição App Store)
- Sessão fica em localStorage do Safari in-app, não no WebView do Capacitor → risco de perder sessão ao matar o app

### Causa raiz
Backend `/api/auth/google-login` sempre redireciona callback pro domínio web (`https://suportebipolar.com/...`), sem detectar que origem é Capacitor iOS.

Scheme custom `suportebipolar://` **já está registrado no `Info.plist`** (CFBundleURLSchemes) — só falta o backend usá-lo.

### Correção necessária
1. **Frontend (Capacitor):** adicionar `?native=true` (ou header `X-Client: capacitor-ios`) na chamada inicial do OAuth
2. **Backend `/api/auth/google-login`:**
   - Detectar `?native=true` query param OU User-Agent contendo `CapacitorIOS`
   - Se nativo: redirecionar callback final pra `suportebipolar://auth-success?token=<jwt>`
   - Se web: comportamento atual (redirect pra `/dashboard`)
3. **App Capacitor:** escutar via `App.addListener('appUrlOpen', ...)`, extrair token, estabelecer sessão no WebView nativo, fechar SFSafariViewController (`Browser.close()` do plugin `@capacitor/browser`)

### Workaround imediato pro smoke test
Usar **"Continuar com Apple"** — o plugin `@capacitor-community/apple-sign-in` usa `ASAuthorizationController` nativo (não SFSafariViewController), então fluxo completa em contexto Capacitor real.

**Status:** Bloqueante para submissão pública. Corrigir antes do próximo build TestFlight.

---

## 2. Face ID não aparece em Menu → Conta

### Sintoma
- Usuário vai em `Menu → Conta`
- Seção de Face ID não é renderizada

### Causa raiz
Consequência direta do bug #1 — código que renderiza toggle Face ID checa `Capacitor.isNativePlatform()` e/ou disponibilidade do plugin biometric. Em contexto Safari in-app, retorna `false`.

**Status:** Resolve sozinho quando bug #1 for corrigido. Re-testar após fix do OAuth.

---

## Checklist de smoke test pendente (fazer após login via Apple)

- [ ] **Check-in diário** — humor, sono, energia (fluxo completo, salva no backend)
- [ ] **Medicação** — marcar dose tomada, push notification
- [ ] **Diário** — escrever entrada, salvar, reabrir
- [ ] **Sono** — registrar horas, visualizar histórico
- [ ] **Insights** — gráficos de humor carregam, dados corretos
- [ ] **SOS** — botão de crise abre, contatos de emergência listados
- [ ] **Google Calendar sync** — se ativo, eventos aparecem (depende de OAuth Google, pode estar travado pelo bug #1)
- [ ] **Face ID** (após fix OAuth) — toggle aparece, ativa, bloqueia app ao reabrir

---

## Observações gerais

- Build sobe pra TestFlight sem warnings Xcode críticos
- Ícone, splash screen, launch screen: OK
- Permissions prompts (notificações, Face ID) aparecem no momento correto quando contexto é nativo
- Privacy manifest (`PrivacyInfo.xcprivacy`) presente — validar antes de submissão

---

_Documento atualizável. Atualizar ao encontrar novos bugs ou ao fechar bugs listados._

# Bugs identificados em smoke test TestFlight — 2026-04-20

---

## ✅ RESOLVIDO 2026-04-20: Splash screen + WebView não adaptavam ao dark mode

### Sintoma
- App aberto com iPhone em dark mode: splash screen surgia **branco com logo placeholder ("X" azul)** por ~2s antes do conteúdo
- Após splash, WebView piscava **fundo branco** por 1 frame antes do HTML em dark carregar
- Flash branco também aparecia ao alternar light↔dark com app aberto
- Card do app no multitasking switcher ficava branco independente do tema

### Causa raiz
Três camadas estavam travadas em light:
1. **UIKit host view** (atrás da WebView): `CAPBridgeViewController` default do Capacitor não aplica bg adaptativo
2. **LaunchScreen.storyboard**: `<device appearance="light">` + `<systemColor name="systemBackgroundColor"><color white="1">` forçavam cor fixa, matando a adaptação nativa do iOS
3. **Splash.imageset**: `Contents.json` só tinha variantes `1x/2x/3x` para light — sem `appearances: [{value: "dark"}]`. E a imagem em si era um placeholder ("X" azul) que não representava a marca.

### Fix aplicado
- **Novo `ViewController.swift`** substitui `CAPBridgeViewController` como classe da view no Main.storyboard. Aplica bg dinâmico (`#0d0d0f` dark / white light) na view + WebView + scrollView nos hooks `viewDidLoad`, `viewWillAppear`, `traitCollectionDidChange`.
- **LaunchScreen.storyboard**: removido `appearance="light"` e override de `systemBackgroundColor` — iOS agora usa a cor adaptativa real.
- **Splash.imageset**: regeneradas 6 PNGs 2732x2732 (3 light cream `#f6f3ee`, 3 dark `#0d0d0f`) a partir da logo real `public/logo-square.png` (brain teal + "SUPORTE BIPOLAR"). `Contents.json` declara variantes com `luminosity: dark`.
- **Script reusável**: `scripts/generate-dark-splash.py` faz chroma-key da logo source sobre qualquer bg — rode quando a marca mudar.

### Validação pendente (após próximo build TestFlight)
- [ ] Splash dark em cold start: iPhone dark mode → tap ícone → splash escuro com logo teal, sem branco
- [ ] Splash light em cold start: iPhone light mode → tap ícone → splash cream com logo teal
- [ ] Toggle light↔dark com app aberto: transição suave sem flash branco
- [ ] Multitasking switcher: card do app respeita tema atual

### Arquitetura nova do iOS (importante pra onboarding futuro)
- `/ios/` agora **é versionado** (antes estava em `.gitignore`). Customizações Swift/storyboard/pbxproj persistem entre `npx cap sync ios`.

---


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

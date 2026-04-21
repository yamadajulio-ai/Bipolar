# Bugs identificados em smoke test TestFlight — 2026-04-20

> **Status atual (2026-04-20 noite):** Build 1.0 (6) subiu para ASC com TODOS os fixes desta página aplicados (OAuth bridge, splash dark adaptativo, cores alinhadas, env hardening). Aguardando 10-30min de processamento no App Store Connect. Commits: `971a08d` (OAuth bridge), `1d3612c` (splash), `ecad89d` (cores alinhadas + script hardening + esta doc).
>
> Build anterior testado no smoke era 1.0 (1) de 2026-03-31 — antes de qualquer fix. Por isso bugs #1 e #2 aparecem abaixo como "resolvidos aguardando validação" em vez de "fixados em produção".

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
- **Novo `ViewController.swift`** substitui `CAPBridgeViewController` como classe da view no Main.storyboard. Aplica bg dinâmico (token-accurate: `#171411` dark / `#f6f3ee` cream) na view + WebView + scrollView nos hooks `viewDidLoad`, `viewWillAppear`, `traitCollectionDidChange`.
- **LaunchScreen.storyboard**: removido `appearance="light"` e override de `systemBackgroundColor` — iOS agora usa a cor adaptativa real.
- **Splash.imageset**: regeneradas 6 PNGs 2732x2732 (3 light cream `#f6f3ee`, 3 dark `#171411`) a partir da logo real `public/logo-square.png` (brain teal + "SUPORTE BIPOLAR"). `Contents.json` declara variantes com `luminosity: dark`.
- **Script reusável**: `scripts/generate-dark-splash.py` faz chroma-key da logo source sobre qualquer bg — rode quando a marca mudar.

### Cores alinhadas (checklist zero-flash)
Cada camada da stack de renderização usa a MESMA cor — qualquer divergência reintroduz flash:

| camada | light | dark | fonte |
| --- | --- | --- | --- |
| LaunchScreen.storyboard | systemBg (adaptativo) | systemBg (adaptativo) | iOS default |
| Splash.imageset PNG | `#f6f3ee` | `#171411` | `generate-dark-splash.py` |
| ViewController host + WebView bg | `#f6f3ee` | `#171411` | `ios/App/App/ViewController.swift` |
| CSS body | `#f6f3ee` (`--background` root) | `#171411` (`.dark --background`) | `src/app/globals.css` |

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

## ✅ FIX IMPLEMENTADO 2026-04-20 (commit 971a08d): OAuth Google — SFSafariViewController não fechava

> **Build testado no smoke test era 1.0(1) de 2026-03-31 — anterior ao fix. Validação final depende de novo build TestFlight (vide seção "Próximo TestFlight" abaixo).**

### Sintoma (no build 1.0(1))
- Usuário toca "Continuar com Google" → abre SFSafariViewController in-app
- Completa fluxo OAuth no Google
- Safari volta pro app **mas não fecha** — fica mostrando `suportebipolar.com` com barra do Safari no topo
- App funciona "por cima" do Safari, mas contexto é **web (cookies Safari)**, não Capacitor nativo

### Consequências em cadeia
- **Face ID não aparecia** em `Menu → Conta` (plugin Capacitor Face ID só funciona em contexto nativo) — bug #2 abaixo é consequência direta
- **Barra `suportebipolar.com` visível** no topo da tela (quebra experiência de app nativo — motivo de rejeição App Store)
- Sessão ficava em localStorage do Safari in-app, não no WebView do Capacitor → perde sessão ao matar o app

### Fix aplicado (bridge OAuth via custom scheme)
Arquitetura: OAuth roda no SFSafari (Google bloqueia WebView embedded), mas cookie jar dele é isolada do WebView. Callback assina um bridge token HMAC curto (TTL 2min), redireciona pro custom scheme, app re-entra via `/api/auth/native-session` pra criar a iron-session real no WebView.

| Camada | Arquivo | O que faz |
| --- | --- | --- |
| Frontend | [src/app/(auth)/login/page.tsx:109-128](src/app/(auth)/login/page.tsx#L109-L128) | Se `Capacitor.isNativePlatform()`, abre `Browser.open({ url: …/google-login?native=1 })` |
| Backend login | [src/app/api/auth/google-login/route.ts](src/app/api/auth/google-login/route.ts) | Detecta `?native=1`, seta cookie `google-login-native=1` (sameSite=lax, httpOnly) antes de redirecionar pro Google |
| Backend callback | [src/app/api/auth/google-login/callback/route.ts](src/app/api/auth/google-login/callback/route.ts) | Se cookie nativo presente, responde `302 Location: suportebipolar://auth-success?token=<bridge>` em vez de criar iron-session |
| Bridge token | [src/lib/oauth-native-bridge.ts](src/lib/oauth-native-bridge.ts) | HMAC-SHA256 com subkey derivada de `SESSION_SECRET` (`oauth-native-bridge-v1`), TTL 2min, payload `{uid, onb, exp, typ}` |
| Deep link listener | [src/lib/capacitor/deep-links.ts:29-37](src/lib/capacitor/deep-links.ts#L29-L37) | `App.addListener('appUrlOpen')` detecta `suportebipolar://auth-success`, chama `Browser.close()` e navega WebView pra `/api/auth/native-session?token=…` |
| Bridge → session | [src/app/api/auth/native-session/route.ts](src/app/api/auth/native-session/route.ts) | Verifica HMAC, lookup user por `uid`, cria iron-session cookie no WebView, redireciona pra `/hoje` ou `/onboarding` |
| Listener mount | [src/components/capacitor/NativeAppShell.tsx:116](src/components/capacitor/NativeAppShell.tsx#L116) | Registra `registerDeepLinkHandler` no mount do root layout |
| URL scheme | `ios/App/App/Info.plist` CFBundleURLSchemes → `suportebipolar` | Declara scheme pro iOS resolver custom URL pro bundle |

### Ordem de execução (cold-start + login)
1. User tap "Continuar com Google" no WebView
2. Capacitor abre `Browser.open(…/api/auth/google-login?native=1)` → SFSafari abre
3. Servidor: seta cookie `google-login-native=1`, redireciona pro Google
4. User autentica no Google
5. Google redireciona pro callback: `…/api/auth/google-login/callback?code=…&state=…`
6. Callback lê cookie, chama `signBridgeToken(user.id, onboarded)`, responde `302 Location: suportebipolar://auth-success?token=…`
7. iOS vê scheme `suportebipolar://` registrado → chama `application:openURL:` no app
8. Capacitor dispara `appUrlOpen` event no JS
9. Handler chama `Browser.close()` (fecha SFSafari) e `window.location.href = /api/auth/native-session?token=…`
10. WebView bate no endpoint, verifica HMAC, cria iron-session cookie, redireciona pra `/hoje` ou `/onboarding`

### Validação pendente (após próximo build TestFlight)
- [ ] Cold start → login Google → SFSafari fecha automaticamente → chega em `/hoje` ou `/onboarding` SEM barra `suportebipolar.com`
- [ ] Logout → re-login → fluxo completa de novo (bridge token não é reutilizável, mas user re-autentica)
- [ ] Token inválido/expirado → `/login?error=invalid_token`
- [ ] `suportebipolar://auth-error?error=…` fecha Safari e navega pra `/login?error=…`
- [ ] Face ID em `Menu → Conta` aparece (confirma que contexto é Capacitor nativo — resolve bug #2)

### Workaround temporário (se fix quebrar em produção)
Usar **"Continuar com Apple"** — plugin `@capacitor-community/apple-sign-in` usa `ASAuthorizationController` nativo (nunca abriu SFSafari), então independe desse fix.

---

## ✅ RESOLVIDO (consequência do #1): Face ID não aparecia em Menu → Conta

### Sintoma
- Usuário ia em `Menu → Conta`
- Seção de Face ID não era renderizada

### Causa raiz
Consequência direta do bug #1 — código que renderiza toggle Face ID checa `Capacitor.isNativePlatform()` e/ou disponibilidade do plugin biometric. Em contexto Safari in-app, retorna `false`.

**Resolução automática:** com o fix do #1 em produção, sessão fica no WebView Capacitor, `isNativePlatform()` retorna `true`, toggle aparece. **Validar após próximo build TestFlight.**

---

## Hardening script TestFlight (2026-04-20, mesma sessão)

Defesas aplicadas em [scripts/testflight-upload.sh](scripts/testflight-upload.sh) contra falhas recorrentes:

- **agvtool multi-line**: `agvtool what-version -terse` pode retornar múltiplas linhas em projetos multi-target, o que passava lixo pro `$((CURRENT + 1))`. Agora filtra `head -n1 | tr -d '[:space:]'` e valida `^[0-9]+$` — falha rápido se a saída não for um inteiro limpo.
- **env vars trimadas + validadas**: depois de `source .env.testflight`, `ASC_KEY_ID` e `ASC_ISSUER_ID` passam por `tr -d '[:space:]'` e `${VAR:?…}`. Defesa direta contra o mesmo bug §0 (newline literal no final da env var) — se acontecer no arquivo local, o trim neutraliza; se a var não existir, aborta com mensagem clara em vez de chamar `altool` com credencial vazia.

---

## Build 1.0 (6) — subido 2026-04-20 noite

Sequência executada: `pnpm build` → `cap sync ios` → `agvtool` bump (5→6) → `xcodebuild archive` → `xcodebuild -exportArchive` (destino `upload`) → ASC processando. Notificação por email do Apple quando "Ready to Test".

### Checklist de validação — ordem recomendada no iPhone 17 Pro Max

**Pré-flight (ASC):**
- [ ] Build 1.0 (6) aparece em TestFlight → Builds. Status "Ready to Test" (ou amarelo "Processing" por 10-30min).
- [ ] Export Compliance: clicar o warning amarelo, marcar "No" para encryption (ou "Exempt" — Capacitor só usa HTTPS padrão iOS, não custom crypto).

**Splash (fix `1d3612c` + `ecad89d`):**
- [ ] iPhone em **dark mode** → força-close → tap ícone: splash escuro `#171411` com logo teal, SEM flash branco, SEM placeholder "X".
- [ ] iPhone em **light mode** → força-close → tap ícone: splash cream `#f6f3ee` com logo teal.
- [ ] Transição splash → WebView: sem piscar. Se piscar = ainda tem mismatch, comparar corner pixel do PNG com `--background` do token CSS.
- [ ] Toggle light↔dark com app aberto: transição suave sem flash.
- [ ] Multitasking switcher (swipe up + hold): card do app respeita tema atual.

**OAuth Google bridge (fix `971a08d`):**
- [ ] Logout (Menu → Sair) → tela de login
- [ ] Tap "Continuar com Google" → SFSafari abre fullscreen (barra Safari em cima é normal DENTRO do Safari)
- [ ] Login Google completa (select account + consent)
- [ ] **CRÍTICO:** Safari **fecha sozinho** automaticamente
- [ ] User chega em `/hoje` (ou `/onboarding` se primeira vez) SEM barra `suportebipolar.com` visível
- [ ] URL bar da página interna NÃO aparece em lugar nenhum do app

**Face ID (consequência do OAuth fix):**
- [ ] Menu → Conta → seção Face ID aparece (prova que `Capacitor.isNativePlatform()` retorna `true`)
- [ ] Ativa Face ID → força-close → reabre: prompt biométrico ANTES de mostrar conteúdo
- [ ] 3 falhas biométricas seguidas → logout automático (segurança)

**Apple Sign-In (validação bug §0 env vars):**
- [ ] Logout → "Continuar com Apple" → dialog fullscreen nativo ASAuthorizationController
- [ ] Login completa → chega em `/hoje` ou `/onboarding`
- [ ] Se falhar: checar se `APPLE_PRIVATE_KEY` tem `\n` residual (bug §0 não corrigiu esse especificamente porque PEM tem newlines legítimos)

### Se algo falhar

1. **Safari OAuth não fecha:** bug do fix, não do build. Ordem de debug:
   - Verificar `NativeAppShell` está montado (layout.tsx:129 ✓)
   - Console do Capacitor: `appUrlOpen` dispara ao voltar do Google?
   - Cookie `google-login-native=1` chega no callback? (sameSite=lax, pode quebrar cross-site se Google fizer POST em vez de GET)
   - Response do callback tem `Location: suportebipolar://auth-success?token=…`?
2. **Splash ainda pisca:** comparar hex do corner pixel do PNG novo com `--background` do token CSS (`#171411` dark, `#f6f3ee` light). Se bater e ainda pisca = React hydration demorando → investigar bundle size.
3. **Face ID não aparece mesmo com OAuth ok:** checar `isBiometricAvailable()` no device (alguns iPhones têm Touch ID descoberto, mas 17 Pro Max tem Face ID garantido).

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

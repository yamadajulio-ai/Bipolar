# iOS Build Setup Guide — Suporte Bipolar

## Pre-requisites (Mac Mini M4)
- Xcode 16+ instalado (App Store)
- CocoaPods: `sudo gem install cocoapods`
- Node.js 20+ e pnpm
- Apple Developer account configurada no Xcode (Preferences → Accounts)

## 1. Gerar projeto iOS

```bash
cd ~/Desktop/Projeto\ Rede\ Bipolar

# Instalar dependências
pnpm install

# Gerar app icons
node scripts/generate-app-icons.mjs

# Adicionar plataforma iOS
npx cap add ios

# Sincronizar plugins
npx cap sync ios
```

## 2. Configurar no Xcode

```bash
npx cap open ios
```

### 2a. Signing & Capabilities
1. Selecionar target **App**
2. **Signing**: selecionar team (Julio Cesar de Sousa Yamada)
3. **Bundle Identifier**: `com.suportebipolar.app`
4. Adicionar capabilities:
   - **Push Notifications**
   - **Associated Domains**: adicionar `applinks:suportebipolar.com` e `webcredentials:suportebipolar.com`
   - **Background Modes**: marcar "Remote notifications"

### 2b. Info.plist
Adicionar manualmente as entradas de `ios-template/Info.plist.additions.xml`:
- `NSFaceIDUsageDescription` (obrigatório para Face ID)
- `CFBundleURLTypes` (custom URL scheme `suportebipolar://`)
- `UIBackgroundModes` → `remote-notification`

### 2c. Privacy Manifest
Copiar `ios-template/PrivacyInfo.xcprivacy` para `ios/App/App/PrivacyInfo.xcprivacy`

### 2d. App Icons
Copiar `ios-template/AppIcon.appiconset/` para `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
(substituir o existente)

### 2e. Launch Screen (Splash)
Editar `ios/App/App/Base.lproj/LaunchScreen.storyboard`:
- Adicionar logo (icon-512.png) centralizada
- Background branco (light) / #171411 (dark)
- Usar trait variations para dark mode

## 3. APNs Key

1. Ir a https://developer.apple.com/account/resources/authkeys/list
2. Criar nova key com **Apple Push Notifications service (APNs)**
3. Download do arquivo `.p8`
4. Anotar o **Key ID** e o **Team ID**
5. Configurar no backend (Vercel env vars):
   - `APNS_KEY_ID`
   - `APNS_TEAM_ID`
   - `APNS_KEY_P8` (conteúdo do .p8)

## 4. Universal Links — Cloudflare

O arquivo AASA já está em `public/.well-known/apple-app-site-association`.
Depois de ter o Team ID, substituir `TEAM_ID` pelo valor real.

Verificar que Cloudflare serve o arquivo com `Content-Type: application/json`.
Testar: `curl -I https://suportebipolar.com/.well-known/apple-app-site-association`

## 5. Demo Account (App Store Review)

```bash
node scripts/seed-demo-account.mjs
```

Isso cria a conta `reviewer@suportebipolar.com` com 30 dias de dados de exemplo.

## 6. Build & Test

```bash
# Simulador
npx cap run ios

# Device (precisa estar conectado via USB ou wireless)
npx cap run ios --target=<device-id>
```

## 7. Archive & Submit

1. Xcode → Product → Archive
2. Distribute App → App Store Connect
3. No App Store Connect, preencher:
   - Metadata (ver `docs/app-store-metadata.md`)
   - Screenshots
   - Review Notes (ver `docs/app-store-review-notes.md`)
   - Demo account credentials
4. Submit for Review

## Checklist Final

- [ ] Team ID no AASA file
- [ ] APNs key configurada
- [ ] Info.plist com NSFaceIDUsageDescription
- [ ] PrivacyInfo.xcprivacy copiada
- [ ] App Icons completos no Xcode
- [ ] LaunchScreen.storyboard customizada
- [ ] Push Notifications capability
- [ ] Associated Domains capability
- [ ] Testado no simulador
- [ ] Testado em device real
- [ ] Demo account com dados
- [ ] Version 1.0.0 (Build 1)

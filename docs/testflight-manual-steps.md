# TestFlight — Passos manuais pro teu pai (iPhone 15)

> Tudo que precisa do teu Apple ID, 2FA, ou decisão tua. Sequência ideal.

---

## A. Preparação da sua conta (uma vez só — ~15 min)

### A0. ⚠️ Aceitar PLA atualizado + gerar Distribution cert
**Bloqueio detectado hoje no export:** `No signing certificate "iOS Distribution" found` + `PLA Update available`.

1. Abrir [developer.apple.com/account](https://developer.apple.com/account) e logar com seu Apple ID.
2. Se aparecer banner tipo "Review and accept updated Paid Apps Agreement" / "Program License Agreement update" → **aceitar**. Sem isso, nada de Distribution funciona.
3. Gerar o certificado de Distribution (se Xcode não resolver sozinho depois):
   - Xcode → **Settings (⌘,)** → **Accounts** → seu Apple ID → **Manage Certificates…** → **+** → **Apple Distribution**.
   - Isso cria a chave no Keychain local. Depois o `-allowProvisioningUpdates` no xcodebuild já consegue exportar em modo `app-store-connect`.
4. Teste: `security find-identity -p codesigning -v` deve listar **"Apple Distribution: Julio Cesar de Sousa Yamada"** além do "Apple Development".

### A1. App Store Connect API Key (pro script automatizar uploads)
1. Abra [appstoreconnect.apple.com/access/integrations/api](https://appstoreconnect.apple.com/access/integrations/api).
2. Aba **Team Keys** → **+**.
3. Nome: `ci-upload` · Access: **App Manager**.
4. **Generate**. Baixa o `.p8` (só dá uma vez).
5. No Mac:
   ```bash
   mkdir -p ~/.appstoreconnect/private_keys
   mv ~/Downloads/AuthKey_*.p8 ~/.appstoreconnect/private_keys/
   ```
6. Crie `~/Desktop/Bipolar/.env.testflight` com:
   ```
   ASC_KEY_ID=SEU_KEY_ID_AQUI
   ASC_ISSUER_ID=SEU_ISSUER_ID_AQUI
   FATHER_APPLE_ID_EMAIL=email_do_apple_id_do_seu_pai@exemplo.com
   ```
   (Key ID e Issuer ID estão na mesma página da API Key.)
7. Adicione ao `.gitignore` se ainda não estiver: `.env.testflight`

### A1.5. Rodar o setup automático (depois da A1)
```bash
cd ~/Desktop/Bipolar
node scripts/testflight-setup.mjs
```
Faz sozinho: aguarda build processar → Export Compliance → cria grupo Família → vincula build → preenche What-to-Test → Beta App Review details → submete pra review → adiciona pai como tester.

Flags: `--skip-review` (não submete), `--skip-tester` (não adiciona pai).

### A2. Confirmar app no App Store Connect
Abra [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps**.
Se `Suporte Bipolar` (bundle `com.suportebipolar.app`) aparecer, **pule pro B**.
Se não (improvável — o archive de 2026-03-29 sugere que já foi criado):
1. **+** → **New App** → iOS.
2. Name: `Suporte Bipolar` · Primary Language: Portuguese (Brazil).
3. Bundle ID: selecionar `com.suportebipolar.app`.
4. SKU: `SUPBIP-001` · User Access: Full Access. **Create**.

---

## B. Upload do build novo (sempre que subir nova versão)

```bash
cd ~/Desktop/Bipolar
./scripts/testflight-upload.sh
```

O script faz tudo sozinho: build web, sync, bump build number, archive, export, upload via API Key. Final: "Upload concluído. Processamento no App Store Connect: 10–30 min."

**Primeira rodada manual:** se você já tiver um archive pronto (como agora em `build/App.xcarchive`), pode pular o script e usar o Xcode Organizer → **Distribute App → App Store Connect → Upload**.

---

## C. Responder Export Compliance (a cada versão nova)

Após upload processar:
1. App Store Connect → seu app → aba **TestFlight** → **iOS Builds**.
2. Ao lado do build novo: aviso amarelo "Missing Compliance" → **Manage**.
3. Resposta pronta: `docs/testflight-beta-review.md` seção "Export Compliance".

---

## D. Criar grupo de teste externo (uma vez só)

1. App Store Connect → app → **TestFlight** → sidebar **External Testing**.
2. **+** ao lado de "Groups" → nome: **Família**.
3. Dentro do grupo → aba **Builds** → **+** → selecione o build processado.
4. Vai pedir **Test Information**. Cole o conteúdo de `docs/testflight-beta-review.md` (seções "What to test" e "Test Information").
5. **Save** → **Submit for Review** (só no primeiro build; próximos vão direto).

---

## E. Adicionar seu pai como tester

1. Dentro do grupo **Família** → aba **Testers** → **+** → **Add New Testers**.
2. Preencher:
   - First Name: `Pai`
   - Last Name: *(sobrenome dele)*
   - Email: **⚠️ o email exato do Apple ID dele no iPhone 15** — não adianta um email qualquer.
3. **Add**.

Ele recebe email automaticamente quando o build for aprovado no Beta Review.

---

## F. Do lado do iPhone 15 do seu pai

1. App Store → buscar **TestFlight** → instalar (hélice azul).
2. Abrir uma vez, aceitar termos.
3. Checar email — abrir convite com assunto "You're invited to test Suporte Bipolar".
4. Toca em **View in TestFlight** → **Accept** → **Install**.
5. Ícone aparece na tela inicial com bolinha laranja do lado (é beta, normal).
6. Primeira abertura: vai pedir permissões:
   - **Notificações** → Permitir (senão lembretes não funcionam)
   - **Face ID** → Ok (desbloquear histórico)
   - Fazer cadastro ou **Sign in with Apple**.

---

## G. Ciclo contínuo (cada atualização do app)

```bash
./scripts/testflight-upload.sh
```

Depois:
1. Esperar 10–30 min (processa).
2. Responder Export Compliance (1 clique).
3. O build é distribuído automático pro grupo Família se você configurou
   "Automatically distribute new builds" no grupo. Senão: TestFlight → grupo →
   Builds → + → selecionar novo build.
4. Seu pai recebe notificação do TestFlight no iPhone e atualiza.

**Lembrete:** build expira em **90 dias**. Marque no calendário subir um novo
build antes de expirar, mesmo que nada tenha mudado (só bumpar build number).

---

## Problemas comuns

| Sintoma | Causa provável | Fix |
|---|---|---|
| Script falha em "altool upload" com "Invalid Provider" | Key não é App Manager | Regerar API key com role App Manager |
| "No eligible build found" no grupo de testers | Build ainda processando | Esperar mais 10 min |
| Pai não recebe email | Email errado / não é o Apple ID dele | Confirmar com ele qual o email do Apple ID |
| Bolinha laranja sumiu, app virou "App Store" | TestFlight expirou (90 dias) | Subir build novo |
| Build rejeitado 4.2 | Apple achou que é wrapper | Responder com defesa em `testflight-beta-review.md` |

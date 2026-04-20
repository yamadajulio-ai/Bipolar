#!/bin/bash
# ──────────────────────────────────────────────────────────────
# testflight-upload.sh — Build, archive, export e upload pro TestFlight.
#
# Requer (primeira vez):
#   1. App Store Connect API Key em ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
#   2. Variáveis no .env.testflight (na raiz do projeto):
#        ASC_KEY_ID=XXXXXXXXXX
#        ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#
# Uso:
#   ./scripts/testflight-upload.sh           # bumpa build, arquiva, sobe
#   ./scripts/testflight-upload.sh --no-bump # usa build number atual
#   ./scripts/testflight-upload.sh --dry     # só arquiva, não sobe
# ──────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT/ios/App"
BUILD_DIR="$ROOT/build"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS="$BUILD_DIR/ExportOptions.plist"

DO_BUMP=1
DO_UPLOAD=1
for arg in "$@"; do
  case "$arg" in
    --no-bump) DO_BUMP=0 ;;
    --dry)     DO_UPLOAD=0 ;;
  esac
done

echo "▸ Bipolar · TestFlight upload"
echo "  root: $ROOT"

# ── 1. Build web bundle ───────────────────────────────────────
echo "▸ [1/6] pnpm build"
cd "$ROOT"
pnpm build

# Capacitor exige o offline-fallback no out/
mkdir -p "$ROOT/out"
cp "$ROOT/public/offline-fallback.html" "$ROOT/out/offline-fallback.html"

# ── 2. Sync Capacitor ─────────────────────────────────────────
echo "▸ [2/6] cap sync ios"
npx cap sync ios

# ── 3. Bump build number ──────────────────────────────────────
if [ "$DO_BUMP" = "1" ]; then
  echo "▸ [3/6] agvtool bump"
  cd "$IOS_DIR"
  CURRENT=$(agvtool what-version -terse)
  NEXT=$((CURRENT + 1))
  agvtool new-version -all "$NEXT" >/dev/null
  echo "  build: $CURRENT → $NEXT"
  cd "$ROOT"
else
  cd "$IOS_DIR"
  echo "▸ [3/6] skipping bump (build=$(agvtool what-version -terse))"
  cd "$ROOT"
fi

# ── 4. Archive ────────────────────────────────────────────────
echo "▸ [4/6] xcodebuild archive"
rm -rf "$ARCHIVE_PATH"
cd "$IOS_DIR"
xcodebuild \
  -project App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  archive || {
    echo "❌ archive failed"; exit 1;
  }

# ── 5. Export IPA ─────────────────────────────────────────────
echo "▸ [5/6] xcodebuild -exportArchive"
rm -rf "$EXPORT_PATH"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates || {
    echo "❌ export failed"; exit 1;
  }

IPA="$EXPORT_PATH/App.ipa"
[ -f "$IPA" ] || { echo "❌ IPA not found at $IPA"; exit 1; }
echo "  ipa: $IPA ($(du -h "$IPA" | cut -f1))"

# ── 6. Upload ─────────────────────────────────────────────────
if [ "$DO_UPLOAD" = "0" ]; then
  echo "▸ [6/6] skipping upload (--dry)"
  exit 0
fi

if [ ! -f "$ROOT/.env.testflight" ]; then
  echo "❌ .env.testflight not found. Create with ASC_KEY_ID and ASC_ISSUER_ID."
  exit 1
fi
set -a; . "$ROOT/.env.testflight"; set +a

echo "▸ [6/6] altool upload"
xcrun altool --upload-app \
  -f "$IPA" \
  -t ios \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID"

echo "✅ Upload concluído. Processamento no App Store Connect: 10–30 min."
echo "   Depois: responder Export Compliance e adicionar ao grupo de testers."

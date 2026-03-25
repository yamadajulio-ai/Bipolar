#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ios-setup.sh — First-run setup for iOS build on Mac Mini
# Run this ONCE after cloning the repo on the Mac.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

echo "=== Suporte Bipolar — iOS Setup ==="

# 1. Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not installed. Install via: brew install node"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm not installed. Install via: npm i -g pnpm"; exit 1; }
command -v xcodebuild >/dev/null 2>&1 || { echo "❌ Xcode not installed. Install from App Store."; exit 1; }
command -v pod >/dev/null 2>&1 || { echo "⚠️  CocoaPods not found. Installing..."; sudo gem install cocoapods; }

echo "✅ Prerequisites OK"

# 2. Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# 3. Create webDir placeholder (Capacitor CLI needs it even with server.url)
mkdir -p out
cat > out/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Suporte Bipolar</title>
  <style>
    body { margin:0; display:flex; align-items:center; justify-content:center;
           min-height:100vh; background:#527a6e; color:white;
           font-family:-apple-system,BlinkMacSystemFont,sans-serif; }
  </style>
</head>
<body><div><h1>Suporte Bipolar</h1><p>Carregando...</p></div></body>
</html>
EOF

# 4. Add iOS platform (creates ios/ folder with Xcode project)
echo "📱 Adding iOS platform..."
npx cap add ios

# 5. Sync plugins and web assets
echo "🔄 Syncing Capacitor..."
npx cap sync ios

# 6. Done
echo ""
echo "=== ✅ Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Open Xcode:  npx cap open ios"
echo "  2. Set Signing Team in Xcode → Targets → Signing & Capabilities"
echo "  3. Set Bundle ID: com.suportebipolar.app"
echo "  4. Add Push Notifications capability in Xcode"
echo "  5. Add Face ID Usage Description in Info.plist:"
echo "     NSFaceIDUsageDescription = 'Proteja seus dados de saúde com Face ID'"
echo "  6. Build → Run on simulator or device"
echo ""
echo "For subsequent syncs: pnpm cap:sync"
echo "To open Xcode:        pnpm cap:ios"

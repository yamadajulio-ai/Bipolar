#!/bin/bash
# ============================================================================
# Setup: Financial Ingestion Gateway
# ============================================================================
# Pré-requisitos:
#   - Vercel CLI instalado e autenticado
#   - Acesso ao painel Cloudflare (suportebipolar.com)
#
# NUNCA commitar secrets neste script.
# ============================================================================

set -euo pipefail

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Setup: Financial Ingestion Gateway                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Cloudflare DNS ─────────────────────────────────────
echo "━━━ Step 1: Cloudflare DNS (MX Record) ━━━"
echo ""
echo "Adicione no painel Cloudflare → DNS:"
echo "  Tipo:       MX"
echo "  Nome:       inbound"
echo "  Servidor:   inbound.postmarkapp.com"
echo "  Prioridade: 10"
echo "  Proxy:      DNS only (nuvem cinza)"
echo ""

# ── Step 2: Vercel Env Vars ────────────────────────────────────
echo "━━━ Step 2: Vercel Environment Variables ━━━"
echo ""
echo "Configure manualmente na Vercel Dashboard ou via CLI:"
echo ""
echo "  vercel env add POSTMARK_INBOUND_TOKEN production"
echo "    → Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo ""
echo "  vercel env add POSTMARK_INBOUND_DOMAIN production"
echo "    → Valor: inbound.suportebipolar.com (após MX record)"
echo ""
echo "  vercel env add POSTMARK_INBOUND_HASH production"
echo "    → Obtenha em: Postmark Dashboard → Server → Inbound"
echo ""
echo "  vercel env add PLUGGY_CLIENT_ID production"
echo "  vercel env add PLUGGY_CLIENT_SECRET production"
echo "    → Obtenha em: https://dashboard.pluggy.ai"
echo ""
echo "  vercel env add PLUGGY_SANDBOX production"
echo "    → Valor: true (para sandbox)"
echo ""

# ── Step 3: Verificação ───────────────────────────────────────
echo "━━━ Step 3: Verificação ━━━"
echo ""
echo "Após configurar, verifique com:"
echo "  node -e \"fetch('https://api.postmarkapp.com/server', {"
echo "    headers: { 'Accept':'application/json', 'X-Postmark-Server-Token': process.env.POSTMARK_API_TOKEN }"
echo "  }).then(r=>r.json()).then(d=>console.log(d.InboundHookUrl, d.InboundDomain))\""
echo ""
echo "Feito!"

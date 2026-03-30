#!/bin/bash
# ============================================================================
# Setup: Financial Ingestion Gateway
# ============================================================================
# Este script configura os serviços externos necessários para o gateway
# de ingestão financeira multi-canal.
#
# Pré-requisitos:
#   - Vercel CLI instalado e autenticado
#   - Acesso ao painel Cloudflare (suportebipolar.com)
#   - Acesso ao painel Postmark (já configurado)
#
# O que configura:
#   1. DNS MX record no Cloudflare para email inbound
#   2. Env vars na Vercel (Postmark Inbound + Pluggy)
#   3. Verificação de configuração
# ============================================================================

set -euo pipefail

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Setup: Financial Ingestion Gateway                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Cloudflare DNS ─────────────────────────────────────
echo "━━━ Step 1: Cloudflare DNS (MX Record) ━━━"
echo ""
echo "Para receber emails no endereço importar+xxx@suportebipolar.com,"
echo "adicione um MX record no Cloudflare:"
echo ""
echo "  Tipo:       MX"
echo "  Nome:       inbound  (para inbound.suportebipolar.com)"
echo "  Servidor:   inbound.postmarkapp.com"
echo "  Prioridade: 10"
echo "  Proxy:      DNS only (nuvem cinza, NÃO laranja)"
echo ""
echo "Alternativamente, se quiser usar o domínio principal:"
echo "  Tipo:       MX"
echo "  Nome:       @  (suportebipolar.com)"
echo "  Servidor:   inbound.postmarkapp.com"
echo "  Prioridade: 20  (prioridade MAIOR que o MX existente)"
echo ""
echo "⚠️  CUIDADO: Se já existe MX para email (Postmark outbound),"
echo "    use um subdomínio (inbound.suportebipolar.com) para não"
echo "    interferir com o email transacional existente."
echo ""
read -p "MX record configurado no Cloudflare? (y/n) " -n 1 -r
echo ""

# ── Step 2: Vercel Env Vars ────────────────────────────────────
echo ""
echo "━━━ Step 2: Vercel Environment Variables ━━━"
echo ""

POSTMARK_INBOUND_TOKEN="9180d07dc271de8c5d1b204f2274595878ef8c43b38875e263e96957ec5aa6a5"

echo "Configurando POSTMARK_INBOUND_TOKEN na Vercel..."
vercel env add POSTMARK_INBOUND_TOKEN production <<< "$POSTMARK_INBOUND_TOKEN" 2>/dev/null || \
  echo "  ⚠️  Já existe ou erro — configure manualmente na Vercel Dashboard"

echo "Configurando POSTMARK_INBOUND_DOMAIN na Vercel..."
vercel env add POSTMARK_INBOUND_DOMAIN production <<< "suportebipolar.com" 2>/dev/null || \
  echo "  ⚠️  Já existe ou erro — configure manualmente"

echo "Configurando PLUGGY_SANDBOX na Vercel..."
vercel env add PLUGGY_SANDBOX production <<< "true" 2>/dev/null || \
  echo "  ⚠️  Já existe ou erro — configure manualmente"

echo ""
echo "━━━ Step 3: Pluggy (Manual) ━━━"
echo ""
echo "1. Acesse https://dashboard.pluggy.ai"
echo "2. Crie uma conta (trial gratuito 14 dias, 20 conexões)"
echo "3. No Dashboard, copie:"
echo "   - Client ID"
echo "   - Client Secret"
echo "4. Configure na Vercel:"
echo "   vercel env add PLUGGY_CLIENT_ID production"
echo "   vercel env add PLUGGY_CLIENT_SECRET production"
echo ""

# ── Step 3: Verify Postmark Inbound ────────────────────────────
echo "━━━ Step 4: Verificação ━━━"
echo ""
echo "Verificando Postmark Inbound webhook..."

node -e "
fetch('https://api.postmarkapp.com/server', {
  headers: {
    'Accept': 'application/json',
    'X-Postmark-Server-Token': '748e5bcd-e601-4c12-98f7-70b3ab095993'
  }
}).then(r => r.json()).then(d => {
  console.log('  InboundHookUrl:', d.InboundHookUrl || '❌ NÃO CONFIGURADO');
  console.log('  InboundDomain:', d.InboundDomain || '(usando padrão Postmark)');
  console.log('  InboundAddress:', d.InboundAddress || '(não disponível)');
  if (d.InboundHookUrl) {
    console.log('  ✅ Postmark Inbound OK');
  } else {
    console.log('  ❌ Execute: node -e \"fetch(...)\" para configurar');
  }
});
"

echo ""
echo "━━━ Resumo ━━━"
echo ""
echo "✅ Postmark webhook: https://suportebipolar.com/api/financeiro/inbound-email"
echo "✅ Postmark inbound token configurado"
echo "⏳ Cloudflare MX record: verificar DNS propagação (~5min)"
echo "⏳ Pluggy: criar conta em https://dashboard.pluggy.ai"
echo ""
echo "Após configurar Pluggy, adicione PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET"
echo "na Vercel e faça deploy."
echo ""
echo "Feito! 🎉"

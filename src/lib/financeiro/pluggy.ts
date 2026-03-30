import * as Sentry from "@sentry/nextjs";

/**
 * Pluggy SDK integration for Open Finance bank connections.
 *
 * Pluggy Connect allows users to link their bank accounts,
 * enabling automatic transaction sync without manual CSV exports.
 *
 * Flow:
 * 1. Frontend requests a Connect Token via /api/financeiro/pluggy/connect
 * 2. Pluggy Connect widget opens (hosted by Pluggy)
 * 3. User authorizes bank access
 * 4. Pluggy sends webhook with item ID
 * 5. We fetch transactions and ingest via unified pipeline
 *
 * Env vars:
 * - PLUGGY_CLIENT_ID: from Pluggy dashboard
 * - PLUGGY_CLIENT_SECRET: from Pluggy dashboard
 * - PLUGGY_WEBHOOK_URL: our webhook URL
 * - PLUGGY_SANDBOX: "true" for sandbox mode (default in dev)
 *
 * @see https://docs.pluggy.ai
 */

const PLUGGY_API_URL = "https://api.pluggy.ai";

let cachedToken: { token: string; expiresAt: number } | null = null;

// ── Auth ──────────────────────────────────────────────────────

export function isPluggyConfigured(): boolean {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

async function getApiToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.apiKey,
    expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
  };
  return cachedToken.token;
}

// ── Connect Token ────────────────────────────────────────────

/**
 * Create a Pluggy Connect Token for the frontend widget.
 * The clientUserId ties the connection to our user.
 */
export async function createConnectToken(clientUserId: string): Promise<{
  accessToken: string;
}> {
  const apiToken = await getApiToken();

  const res = await fetch(`${PLUGGY_API_URL}/connect_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiToken,
    },
    body: JSON.stringify({
      clientUserId,
      webhookUrl: process.env.PLUGGY_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/financeiro/pluggy/webhook`,
      options: {
        avoidDuplicates: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    Sentry.captureMessage("Pluggy connect token failed", {
      level: "error",
      extra: { status: res.status, body: err.slice(0, 200) },
    });
    throw new Error("Erro ao conectar com Pluggy");
  }

  return res.json();
}

// ── Fetch Transactions ──────────────────────────────────────

export interface PluggyRawTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  category?: { name?: string };
  account?: { name?: string; bankName?: string };
}

/**
 * Fetch transactions from a Pluggy item (connected bank account).
 */
export async function fetchTransactions(
  itemId: string,
  options?: { from?: string; to?: string },
): Promise<PluggyRawTransaction[]> {
  const apiToken = await getApiToken();

  // First, get accounts for this item
  const accountsRes = await fetch(
    `${PLUGGY_API_URL}/accounts?itemId=${itemId}`,
    { headers: { "X-API-KEY": apiToken } },
  );

  if (!accountsRes.ok) {
    throw new Error(`Failed to fetch Pluggy accounts: ${accountsRes.status}`);
  }

  const accountsData = await accountsRes.json();
  const accounts: Array<{ id: string; name: string; bankName?: string }> = accountsData.results || [];

  // Fetch transactions for each account
  const allTransactions: PluggyRawTransaction[] = [];

  for (const account of accounts) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        accountId: account.id,
        pageSize: "500",
        page: String(page),
      });
      if (options?.from) params.set("from", options.from);
      if (options?.to) params.set("to", options.to);

      const txRes = await fetch(
        `${PLUGGY_API_URL}/transactions?${params}`,
        { headers: { "X-API-KEY": apiToken } },
      );

      if (!txRes.ok) break;

      const txData = await txRes.json();
      const results: PluggyRawTransaction[] = txData.results || [];

      for (const tx of results) {
        allTransactions.push({
          ...tx,
          account: { name: account.name, bankName: account.bankName },
        });
      }

      hasMore = results.length === 500;
      page++;
    }
  }

  return allTransactions;
}

// ── Map to our format ────────────────────────────────────────

export function mapPluggyTransactions(
  raw: PluggyRawTransaction[],
): Array<{
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  accountName?: string;
}> {
  return raw.map((tx) => ({
    id: tx.id,
    date: tx.date.slice(0, 10),
    description: tx.description,
    amount: tx.amount,
    category: tx.category?.name || "Outro",
    accountName: tx.account?.bankName
      ? `${tx.account.bankName} - ${tx.account.name}`
      : tx.account?.name,
  }));
}

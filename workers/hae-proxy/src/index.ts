/**
 * Cloudflare Worker — HAE Proxy
 *
 * Receives large Health Auto Export payloads (up to 100MB),
 * responds IMMEDIATELY to avoid HAE timeout, then processes
 * chunks in background using ctx.waitUntil().
 *
 * Chunks are sent in parallel batches of 5 for speed.
 */

interface Env {
  TARGET_URL: string;
}

const MAX_METRICS_PER_CHUNK = 3;
const MAX_CHUNK_BYTES = 3_500_000; // 3.5MB safety margin
const PARALLEL_BATCH_SIZE = 5;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Only accept POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Forward the Authorization header as-is
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract metrics array
    const data = body?.data as Record<string, unknown> | undefined;
    const metrics = (data?.metrics ?? body?.metrics ?? []) as unknown[];
    const hasDataWrapper = !!data?.metrics;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      // No metrics to split — forward as-is (small payload)
      return forwardRequest(env.TARGET_URL, authHeader, body);
    }

    // If payload is small enough, forward directly
    const fullJson = JSON.stringify(body);
    if (fullJson.length < MAX_CHUNK_BYTES) {
      return forwardRequest(env.TARGET_URL, authHeader, body);
    }

    // Large payload — respond immediately, process in background
    const totalMetrics = metrics.length;

    // Use ctx.waitUntil to process chunks after responding
    ctx.waitUntil(
      processChunksInBackground(env.TARGET_URL, authHeader, metrics, hasDataWrapper)
    );

    // Return immediately so HAE doesn't timeout
    return new Response(
      JSON.stringify({
        proxy: true,
        accepted: true,
        totalMetrics,
        message: `Recebido ${totalMetrics} metricas. Processando em background...`,
      }),
      {
        status: 202, // Accepted
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};

async function processChunksInBackground(
  targetUrl: string,
  authHeader: string,
  metrics: unknown[],
  hasDataWrapper: boolean,
): Promise<void> {
  // Split metrics into chunks
  const chunks: unknown[][] = [];
  for (let i = 0; i < metrics.length; i += MAX_METRICS_PER_CHUNK) {
    chunks.push(metrics.slice(i, i + MAX_METRICS_PER_CHUNK));
  }

  // Process chunks in parallel batches
  for (let batchStart = 0; batchStart < chunks.length; batchStart += PARALLEL_BATCH_SIZE) {
    const batch = chunks.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);

    const promises = batch.map(async (chunk) => {
      const chunkPayload = hasDataWrapper
        ? { data: { metrics: chunk } }
        : { metrics: chunk };

      const chunkJson = JSON.stringify(chunkPayload);

      // If chunk is still too large, send metrics individually
      if (chunkJson.length > MAX_CHUNK_BYTES && chunk.length > 1) {
        for (const metric of chunk) {
          const singlePayload = hasDataWrapper
            ? { data: { metrics: [metric] } }
            : { metrics: [metric] };
          await forwardAndParse(targetUrl, authHeader, singlePayload);
        }
        return;
      }

      await forwardAndParse(targetUrl, authHeader, chunkPayload);
    });

    await Promise.all(promises);
  }
}

async function forwardRequest(
  url: string,
  auth: string,
  body: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

async function forwardAndParse(
  url: string,
  auth: string,
  body: unknown,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: {} };
  }
}

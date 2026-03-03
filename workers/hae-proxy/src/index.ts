/**
 * Cloudflare Worker — HAE Proxy
 *
 * Receives large Health Auto Export payloads (up to 100MB),
 * splits metrics into small chunks (~3 per request),
 * and forwards each chunk to the Vercel API endpoint.
 *
 * This bypasses Vercel's 4.5MB request body limit while keeping
 * the HAE automation config simple (single URL, single API key).
 */

interface Env {
  TARGET_URL: string;
}

const MAX_METRICS_PER_CHUNK = 3;
const MAX_CHUNK_BYTES = 3_500_000; // 3.5MB safety margin

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    // Split metrics into chunks
    const chunks: unknown[][] = [];
    for (let i = 0; i < metrics.length; i += MAX_METRICS_PER_CHUNK) {
      chunks.push(metrics.slice(i, i + MAX_METRICS_PER_CHUNK));
    }

    let totalImported = 0;
    let totalHrvHr = 0;
    let totalMetrics = 0;
    const allMetricTypes = new Set<string>();
    let lastError: string | null = null;
    let successCount = 0;

    for (const chunk of chunks) {
      const chunkPayload = hasDataWrapper
        ? { data: { metrics: chunk } }
        : { metrics: chunk };

      let chunkJson = JSON.stringify(chunkPayload);

      // If chunk is still too large, send metrics individually
      if (chunkJson.length > MAX_CHUNK_BYTES && chunk.length > 1) {
        for (const metric of chunk) {
          const singlePayload = hasDataWrapper
            ? { data: { metrics: [metric] } }
            : { metrics: [metric] };

          const res = await forwardAndParse(env.TARGET_URL, authHeader, singlePayload);
          if (res.ok) {
            totalImported += res.data.imported ?? 0;
            totalHrvHr += res.data.hrvHrEnriched ?? 0;
            totalMetrics += res.data.metricsImported ?? 0;
            for (const t of res.data.metricTypes ?? []) allMetricTypes.add(t);
            successCount++;
          } else {
            lastError = res.error;
          }
        }
        continue;
      }

      const res = await forwardAndParse(env.TARGET_URL, authHeader, chunkPayload);
      if (res.ok) {
        totalImported += res.data.imported ?? 0;
        totalHrvHr += res.data.hrvHrEnriched ?? 0;
        totalMetrics += res.data.metricsImported ?? 0;
        for (const t of res.data.metricTypes ?? []) allMetricTypes.add(t);
        successCount++;
      } else {
        lastError = res.error;
      }
    }

    return new Response(
      JSON.stringify({
        proxy: true,
        chunks: chunks.length,
        successCount,
        imported: totalImported,
        hrvHrEnriched: totalHrvHr,
        metricsImported: totalMetrics,
        metricTypes: [...allMetricTypes],
        lastError,
      }),
      {
        status: successCount > 0 ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};

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

interface ForwardResult {
  ok: boolean;
  data: Record<string, unknown>;
  error?: string;
}

async function forwardAndParse(
  url: string,
  auth: string,
  body: unknown,
): Promise<ForwardResult> {
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
  } catch (err) {
    return {
      ok: false,
      data: {},
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

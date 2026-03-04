/**
 * Cloudflare Worker — HAE Proxy
 *
 * Receives Health Auto Export payloads and forwards to Vercel.
 * If the payload exceeds Vercel's 4.5MB limit, automatically splits
 * by metric and sends each one individually.
 *
 * Requires Workers Paid plan ($5/month) for Standard usage model (30s CPU).
 */

interface Env {
  TARGET_URL: string;
}

const MAX_DIRECT_SIZE = 3_500_000; // 3.5MB threshold (Vercel limit is 4.5MB)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization header missing" }, 401);
    }

    const bodyBytes = await request.arrayBuffer();

    // Small payload → forward directly to Vercel
    if (bodyBytes.byteLength < MAX_DIRECT_SIZE) {
      const res = await fetch(env.TARGET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: bodyBytes,
      });
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Large payload → parse JSON and split by metric
    const text = new TextDecoder().decode(bodyBytes);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const data = body?.data as Record<string, unknown> | undefined;
    const metrics = (data?.metrics ?? body?.metrics ?? []) as unknown[];
    const hasDataWrapper = !!data?.metrics;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return json({ error: "No metrics found in payload" }, 400);
    }

    // Forward each metric individually
    let successCount = 0;
    let totalSleep = 0;
    let totalHrvHr = 0;
    let totalMetrics = 0;

    for (const metric of metrics) {
      const chunk = hasDataWrapper
        ? { data: { metrics: [metric] } }
        : { metrics: [metric] };

      try {
        const res = await fetch(env.TARGET_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(chunk),
        });

        if (res.ok) {
          successCount++;
          try {
            const r = (await res.json()) as Record<string, number>;
            totalSleep += r.sleepNights ?? 0;
            totalHrvHr += r.hrvHrEnriched ?? 0;
            totalMetrics += r.metricsImported ?? 0;
          } catch {
            // ignore
          }
        }
      } catch {
        // continue with next metric
      }
    }

    return json(
      {
        proxy: true,
        chunked: true,
        totalMetrics: metrics.length,
        successCount,
        sleepNights: totalSleep,
        hrvHrEnriched: totalHrvHr,
        metricsImported: totalMetrics,
      },
      successCount > 0 ? 200 : 502,
    );
  },
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

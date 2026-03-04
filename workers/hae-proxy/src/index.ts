/**
 * Cloudflare Worker — HAE Proxy
 *
 * With HAE "Batch Requests" enabled, each request contains a single
 * metric and is small enough for Vercel's 4.5MB limit.
 *
 * This Worker simply streams the request body to Vercel without
 * parsing JSON, using minimal CPU to stay within free tier limits.
 *
 * If Vercel returns 413 (too large), falls back to chunked mode.
 */

interface Env {
  TARGET_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream-forward without JSON parsing (minimal CPU usage)
    const bodyBytes = await request.arrayBuffer();

    const res = await fetch(env.TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: bodyBytes,
    });

    // If Vercel accepted it, return response as-is
    if (res.status !== 413) {
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Payload too large for Vercel — parse and chunk
    const text = new TextDecoder().decode(bodyBytes);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = body?.data as Record<string, unknown> | undefined;
    const metrics = (data?.metrics ?? body?.metrics ?? []) as unknown[];
    const hasDataWrapper = !!data?.metrics;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return new Response(JSON.stringify({ error: "No metrics to chunk" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send metrics one by one
    let successCount = 0;
    for (const metric of metrics) {
      const payload = hasDataWrapper
        ? { data: { metrics: [metric] } }
        : { metrics: [metric] };

      try {
        const chunkRes = await fetch(env.TARGET_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify(payload),
        });
        if (chunkRes.ok) successCount++;
      } catch {
        // continue with next metric
      }
    }

    return new Response(
      JSON.stringify({
        proxy: true,
        chunked: true,
        totalMetrics: metrics.length,
        successCount,
      }),
      {
        status: successCount > 0 ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};

/**
 * Cloudflare Worker — HAE Proxy
 *
 * Receives Health Auto Export payloads and forwards to Vercel.
 * Small payloads (<3.5MB) are forwarded directly.
 * Large payloads are split by metric using memory-efficient text scanning
 * (NO JSON.parse) to stay within the 128MB Worker memory limit.
 */

interface Env {
  TARGET_URL: string;
}

const MAX_DIRECT_SIZE = 3_500_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization header missing" }, 401);
    }

    // Read body as text — single allocation, no ArrayBuffer + decode overhead
    const text = await request.text();

    // Small payload → forward directly to Vercel
    if (text.length < MAX_DIRECT_SIZE) {
      const res = await fetch(env.TARGET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: text,
      });
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Large payload → split by metric WITHOUT JSON.parse ──
    // Scans the raw text to find metric object boundaries using bracket
    // depth tracking. This uses ~1/3 the memory of JSON.parse.

    const metricsIdx = text.indexOf('"metrics"');
    if (metricsIdx === -1) {
      return json({ error: "No metrics key found in payload" }, 400);
    }

    // Detect {"data":{"metrics":[...]}} vs {"metrics":[...]}
    const hasDataWrapper = text.substring(0, metricsIdx).includes('"data"');

    const arrayStart = text.indexOf("[", metricsIdx);
    if (arrayStart === -1) {
      return json({ error: "No metrics array found" }, 400);
    }

    // Scan character by character, tracking depth and string boundaries
    let depth = 0;
    let metricStart = -1;
    let inString = false;
    let escaped = false;

    let successCount = 0;
    let totalMetrics = 0;
    let totalSleep = 0;
    let totalHrvHr = 0;
    let totalHealthMetrics = 0;

    for (let i = arrayStart; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "[") {
        depth++;
      } else if (ch === "]") {
        depth--;
        if (depth === 0) break; // End of metrics array
      } else if (ch === "{") {
        if (depth === 1) metricStart = i; // Top-level metric object
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 1 && metricStart !== -1) {
          // Found complete metric object — extract and forward
          totalMetrics++;
          const metricJson = text.substring(metricStart, i + 1);
          metricStart = -1;

          const payload = hasDataWrapper
            ? `{"data":{"metrics":[${metricJson}]}}`
            : `{"metrics":[${metricJson}]}`;

          try {
            const res = await fetch(env.TARGET_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
              },
              body: payload,
            });

            if (res.ok) {
              successCount++;
              try {
                const r = (await res.json()) as Record<string, number>;
                totalSleep += r.sleepNights ?? 0;
                totalHrvHr += r.hrvHrEnriched ?? 0;
                totalHealthMetrics += r.metricsImported ?? 0;
              } catch {
                // ignore
              }
            }
          } catch {
            // continue with next metric
          }
        }
      }
    }

    return json(
      {
        proxy: true,
        chunked: true,
        totalMetrics,
        successCount,
        sleepNights: totalSleep,
        hrvHrEnriched: totalHrvHr,
        metricsImported: totalHealthMetrics,
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

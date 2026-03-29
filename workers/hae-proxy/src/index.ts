/**
 * Cloudflare Worker — HAE Proxy
 *
 * Receives Health Auto Export payloads and forwards to Vercel.
 * Filters to only metrics we actually use (sleep, HRV, HR, steps, calories, SpO2).
 * Large payloads are split by metric using memory-efficient text scanning.
 */

interface Env {
  TARGET_URL: string;
}

// Only forward metrics the app actually processes (see healthExport.ts)
const ALLOWED_METRICS = new Set([
  // Sleep
  "sleep_analysis", "Sleep Analysis", "sleepAnalysis", "sleep",
  // HRV
  "heart_rate_variability", "Heart Rate Variability", "heartRateVariability",
  "heart_rate_variability_sdnn",
  // Heart Rate
  "resting_heart_rate", "Resting Heart Rate", "restingHeartRate",
  "heart_rate", "Heart Rate", "heartRate",
  // Steps
  "step_count", "Step Count", "stepCount", "steps",
  // Active Energy
  "active_energy", "Active Energy", "activeEnergy", "active_calories",
  // Blood Oxygen
  "blood_oxygen", "Blood Oxygen", "bloodOxygen", "oxygen_saturation",
]);

// Quick check: does this metric JSON contain a known metric name?
function isAllowedMetric(metricJson: string): boolean {
  for (const name of ALLOWED_METRICS) {
    if (metricJson.includes(`"${name}"`)) return true;
  }
  // Fallback: check for sleep stage values (unnamed sleep metrics)
  if (metricJson.includes('"Core"') || metricJson.includes('"Deep"') ||
      metricJson.includes('"REM"') || metricJson.includes('"Asleep"') ||
      metricJson.includes('"InBed"') || metricJson.includes('"Awake"')) {
    return true;
  }
  return false;
}

const MAX_DIRECT_SIZE = 3_500_000;

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization header missing" }, 401);
    }

    const text = await request.text();

    // Small payload → forward directly
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

    // ── Large payload → split by metric, filter, and forward ──

    const metricsIdx = text.indexOf('"metrics"');
    if (metricsIdx === -1) {
      return json({ error: "No metrics key found in payload" }, 400);
    }

    const hasDataWrapper = text.substring(0, metricsIdx).includes('"data"');

    const arrayStart = text.indexOf("[", metricsIdx);
    if (arrayStart === -1) {
      return json({ error: "No metrics array found" }, 400);
    }

    // Scan for metric object boundaries
    let depth = 0;
    let metricStart = -1;
    let inString = false;
    let escaped = false;

    let successCount = 0;
    let totalMetrics = 0;
    let skippedMetrics = 0;
    let totalSleep = 0;
    let totalHrvHr = 0;
    let totalHealthMetrics = 0;
    const errors: string[] = [];

    for (let i = arrayStart; i < text.length; i++) {
      const ch = text[i];

      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === "[") {
        depth++;
      } else if (ch === "]") {
        depth--;
        if (depth === 0) break;
      } else if (ch === "{") {
        if (depth === 1) metricStart = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 1 && metricStart !== -1) {
          totalMetrics++;
          const metricJson = text.substring(metricStart, i + 1);
          metricStart = -1;

          // Skip metrics we don't use
          if (!isAllowedMetric(metricJson)) {
            skippedMetrics++;
            continue;
          }

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
              } catch { /* ignore */ }
            } else {
              const errText = await res.text().catch(() => "");
              errors.push(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
            }
          } catch (err) {
            errors.push(`Fetch error: ${String(err).slice(0, 200)}`);
          }
        }
      }
    }

    const forwarded = totalMetrics - skippedMetrics;
    return json(
      {
        proxy: true,
        chunked: true,
        totalMetrics,
        skippedMetrics,
        forwarded,
        successCount,
        sleepNights: totalSleep,
        hrvHrEnriched: totalHrvHr,
        metricsImported: totalHealthMetrics,
        ...(errors.length > 0 ? { errors: errors.slice(0, 5) } : {}),
      },
      successCount > 0 ? 200 : 502,
    );
  },
};

export default handler;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

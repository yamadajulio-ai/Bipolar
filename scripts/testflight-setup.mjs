#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// testflight-setup.mjs — automação completa pós-upload.
//
// Depois que o build foi enviado via xcodebuild/altool, este script:
//   1. Aguarda o build processar (poll até VALID).
//   2. Marca Export Compliance (usesNonExemptEncryption = false).
//   3. Cria (ou reaproveita) o grupo "Família" de Beta Externo.
//   4. Vincula o build ao grupo.
//   5. Define Beta App Description + What-to-Test + e-mail de feedback.
//   6. Submete pra Beta App Review.
//   7. Adiciona o email do pai como tester.
//
// Requer:
//   - ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
//   - .env.testflight na raiz com ASC_KEY_ID, ASC_ISSUER_ID, FATHER_APPLE_ID_EMAIL
//
// Uso:
//   node scripts/testflight-setup.mjs
//   node scripts/testflight-setup.mjs --skip-review    # não submete (só prepara)
//   node scripts/testflight-setup.mjs --skip-tester    # não adiciona pai
// ──────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── 0. Env ────────────────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(ROOT, ".env.testflight");
  if (!fs.existsSync(envFile)) {
    die(`Falta ${envFile}. Veja docs/testflight-manual-steps.md seção A1.`);
  }
  const env = Object.fromEntries(
    fs
      .readFileSync(envFile, "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => {
        const eq = l.indexOf("=");
        return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
      }),
  );
  for (const k of ["ASC_KEY_ID", "ASC_ISSUER_ID"]) {
    if (!env[k]) die(`Falta ${k} em .env.testflight`);
  }
  return env;
}

const args = new Set(process.argv.slice(2));
const SKIP_REVIEW = args.has("--skip-review");
const SKIP_TESTER = args.has("--skip-tester");

const env = loadEnv();
const KEY_ID = env.ASC_KEY_ID;
const ISSUER_ID = env.ASC_ISSUER_ID;
const FATHER_EMAIL = env.FATHER_APPLE_ID_EMAIL;
const CONTACT_EMAIL = env.CONTACT_EMAIL || "yamadaclubes@gmail.com";
const CONTACT_FIRST = env.CONTACT_FIRST_NAME || "Julio";
const CONTACT_LAST = env.CONTACT_LAST_NAME || "Yamada";
const CONTACT_PHONE = env.CONTACT_PHONE || "";
const DEMO_EMAIL = env.DEMO_ACCOUNT_EMAIL || "reviewer@suportebipolar.com";
const DEMO_PASSWORD = env.DEMO_ACCOUNT_PASSWORD || "";
const BUNDLE_ID = "com.suportebipolar.app";
const GROUP_NAME = "Família";

// ── 1. JWT ────────────────────────────────────────────────────
function getKeyPath() {
  const candidates = [
    path.join(process.env.HOME, ".appstoreconnect", "private_keys", `AuthKey_${KEY_ID}.p8`),
    path.join(process.env.HOME, ".private_keys", `AuthKey_${KEY_ID}.p8`),
    path.join(ROOT, `AuthKey_${KEY_ID}.p8`),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  die(`Chave privada AuthKey_${KEY_ID}.p8 não encontrada em:\n  ${candidates.join("\n  ")}`);
}

function makeJWT() {
  const key = fs.readFileSync(getKeyPath(), "utf8");
  const header = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 1200; // 20 min (max Apple aceita)
  const payload = b64url(
    JSON.stringify({
      iss: ISSUER_ID,
      iat: Math.floor(Date.now() / 1000),
      exp,
      aud: "appstoreconnect-v1",
    }),
  );
  const signer = crypto.createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return { token: `${header}.${payload}.${b64url(sig)}`, exp };
}

function b64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ── 2. HTTP helper ────────────────────────────────────────────
let jwtCache = null;
function currentJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (!jwtCache || jwtCache.exp - now < 120) {
    jwtCache = makeJWT();
  }
  return jwtCache.token;
}

async function api(method, pathOrUrl, body) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://api.appstoreconnect.apple.com${pathOrUrl}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${currentJwt()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { status: 204, data: null, errors: [] };
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return {
    status: res.status,
    ok: res.ok,
    data: json,
    errors: json?.errors ?? [],
  };
}

async function apiOrThrow(method, pathOrUrl, body) {
  const r = await api(method, pathOrUrl, body);
  if (!r.ok && r.status !== 204) {
    const details = r.errors.map((e) => `${e.code ?? e.title}: ${e.detail}`).join(" | ");
    throw Object.assign(new Error(`${method} ${pathOrUrl} → ${r.status} · ${details}`), {
      status: r.status,
      errors: r.errors,
    });
  }
  return r.data;
}

function isAlreadyDone(err, codes = []) {
  if (err.status === 409) return true;
  for (const e of err.errors ?? []) {
    if (codes.includes(e.code)) return true;
  }
  return false;
}

// ── 3. Lookup helpers ─────────────────────────────────────────
async function getApp() {
  const r = await api("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  if (!r.data.length) die(`App ${BUNDLE_ID} não existe no App Store Connect.`);
  return r.data[0];
}

async function latestBuild(appId) {
  const r = await api(
    "GET",
    `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=1&include=preReleaseVersion`,
  );
  if (!r.data.length) die("Nenhum build encontrado. Rodou o upload?");
  return r;
}

async function waitBuildValid(appId, maxMinutes = 30) {
  const started = Date.now();
  while (true) {
    const r = await latestBuild(appId);
    const b = r.data[0];
    const state = b.attributes.processingState;
    const version = b.attributes.version;
    console.log(`  build ${version} · state=${state}`);
    if (state === "VALID") return b;
    if (state === "FAILED" || state === "INVALID") {
      die(`Build no estado ${state} — ver App Store Connect pra detalhes.`);
    }
    if ((Date.now() - started) / 60000 > maxMinutes) {
      die(`Timeout (${maxMinutes} min) aguardando build processar.`);
    }
    await sleep(30_000);
    jwt = null; // refresh token a cada iteração
  }
}

// ── 4. Steps ──────────────────────────────────────────────────
async function setExportCompliance(buildId) {
  console.log("▸ Marcando Export Compliance");
  try {
    await api("PATCH", `/v1/builds/${buildId}`, {
      data: {
        type: "builds",
        id: buildId,
        attributes: { usesNonExemptEncryption: false },
      },
    });
  } catch (e) {
    if (String(e).includes("already set") || String(e).includes("409")) {
      console.log("  (já marcado)");
    } else {
      throw e;
    }
  }
}

async function ensureBetaGroup(appId) {
  console.log(`▸ Verificando grupo "${GROUP_NAME}"`);
  const r = await api("GET", `/v1/betaGroups?filter[app]=${appId}&filter[name]=${encodeURIComponent(GROUP_NAME)}`);
  if (r.data.length) {
    console.log(`  grupo já existe (${r.data[0].id})`);
    return r.data[0];
  }
  console.log("  criando grupo externo");
  const created = await api("POST", "/v1/betaGroups", {
    data: {
      type: "betaGroups",
      attributes: {
        name: GROUP_NAME,
        publicLinkEnabled: false,
        publicLinkLimitEnabled: false,
      },
      relationships: {
        app: { data: { type: "apps", id: appId } },
      },
    },
  });
  return created.data;
}

async function attachBuildToGroup(groupId, buildId) {
  console.log("▸ Vinculando build ao grupo");
  try {
    await api("POST", `/v1/betaGroups/${groupId}/relationships/builds`, {
      data: [{ type: "builds", id: buildId }],
    });
  } catch (e) {
    if (String(e).includes("already") || String(e).includes("ENTITY_ERROR")) {
      console.log("  (já vinculado)");
    } else {
      throw e;
    }
  }
}

async function setBetaTestInfo(buildId) {
  console.log("▸ Definindo Beta Test Information");
  const whatToTest = [
    "First beta. Please test:",
    "1. Sign up with email or Sign in with Apple.",
    "2. Daily check-in flow (/hoje and /checkin).",
    "3. Medication reminder at the time you configure.",
    "4. Face ID unlock on re-open.",
    "5. Crisis support flow (/sos) — text and voice modes.",
    "6. Push notifications (grant permission on first open).",
    "",
    "Known limits: content is in Portuguese (pt-BR); target users are Brazilians with bipolar disorder.",
  ].join("\n");
  try {
    await api("POST", "/v1/buildBetaDetails", {
      data: {
        type: "buildBetaDetails",
        attributes: { autoNotifyEnabled: true },
        relationships: { build: { data: { type: "builds", id: buildId } } },
      },
    });
  } catch (_) {
    // já existe — ok
  }
  const r = await api("GET", `/v1/builds/${buildId}/betaBuildLocalizations`);
  const existing = r.data.find((l) => l.attributes.locale === "en-US");
  if (existing) {
    await api("PATCH", `/v1/betaBuildLocalizations/${existing.id}`, {
      data: {
        type: "betaBuildLocalizations",
        id: existing.id,
        attributes: { whatsNew: whatToTest },
      },
    });
  } else {
    await api("POST", "/v1/betaBuildLocalizations", {
      data: {
        type: "betaBuildLocalizations",
        attributes: { locale: "en-US", whatsNew: whatToTest },
        relationships: { build: { data: { type: "builds", id: buildId } } },
      },
    });
  }
}

async function setBetaAppReviewDetails(appId) {
  console.log("▸ Preenchendo Beta App Review Details");
  const attributes = {
    contactEmail: CONTACT_EMAIL,
    contactFirstName: CONTACT_FIRST,
    contactLastName: CONTACT_LAST,
    contactPhone: CONTACT_PHONE,
    demoAccountName: DEMO_EMAIL,
    demoAccountPassword: DEMO_PASSWORD,
    demoAccountRequired: Boolean(DEMO_PASSWORD),
    notes:
      "Reviewer account has 30 days of seeded mood/sleep/medication data. Sign in with Apple also available. App is a wellness companion for bipolar disorder — not a medical device.",
  };
  const r = await api("GET", `/v1/apps/${appId}/betaAppReviewDetail`);
  await api("PATCH", `/v1/betaAppReviewDetails/${r.data.id}`, {
    data: { type: "betaAppReviewDetails", id: r.data.id, attributes },
  });
}

async function submitForReview(buildId) {
  if (SKIP_REVIEW) {
    console.log("▸ --skip-review: não submetendo");
    return;
  }
  console.log("▸ Submetendo pra Beta App Review");
  try {
    await api("POST", "/v1/betaAppReviewSubmissions", {
      data: {
        type: "betaAppReviewSubmissions",
        relationships: { build: { data: { type: "builds", id: buildId } } },
      },
    });
  } catch (e) {
    const msg = String(e);
    if (
      msg.includes("ENTITY_ERROR.ATTRIBUTE.INVALID") ||
      msg.includes("not in a valid processing state") ||
      msg.includes("422")
    ) {
      console.log("  (build já em review)");
    } else {
      throw e;
    }
  }
}

async function addTester(groupId) {
  if (SKIP_TESTER) {
    console.log("▸ --skip-tester: não adicionando");
    return;
  }
  if (!FATHER_EMAIL) {
    console.log("▸ FATHER_APPLE_ID_EMAIL não definido em .env.testflight — pule ou edite .env e rode de novo");
    return;
  }
  console.log(`▸ Adicionando tester ${FATHER_EMAIL}`);

  async function linkExisting() {
    const r = await api(
      "GET",
      `/v1/betaTesters?filter[email]=${encodeURIComponent(FATHER_EMAIL)}&limit=1`,
    );
    if (!r.data.length) return false;
    const testerId = r.data[0].id;
    try {
      await api("POST", `/v1/betaGroups/${groupId}/relationships/betaTesters`, {
        data: [{ type: "betaTesters", id: testerId }],
      });
      console.log("  ✅ tester existente vinculado ao grupo");
    } catch (e) {
      console.log(`  ⚠️ tester existe (${testerId}) mas não pôde ser vinculado: ${String(e).slice(0, 140)}`);
    }
    return true;
  }

  try {
    await api("POST", "/v1/betaTesters", {
      data: {
        type: "betaTesters",
        attributes: {
          email: FATHER_EMAIL,
          firstName: "Pai",
          lastName: "Yamada",
        },
        relationships: {
          betaGroups: { data: [{ type: "betaGroups", id: groupId }] },
        },
      },
    });
    console.log("  ✅ convite enviado por email");
  } catch (e) {
    const msg = String(e);
    if (msg.includes("already exists")) {
      await linkExisting();
      return;
    }
    // Apple returns 409 "Tester(s) cannot be assigned" until the group's first
    // build clears Beta App Review. Treat as a deferred step, not a failure.
    if (msg.includes("Tester(s) cannot be assigned") || msg.includes("state of another resource")) {
      console.log("  ⏳ Apple bloqueia adicionar testers até a primeira Beta Review aprovar.");
      console.log("     Re-rode este script após a aprovação — o tester será vinculado automaticamente.");
      return;
    }
    throw e;
  }
}

// ── util ──────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

// ── main ──────────────────────────────────────────────────────
(async () => {
  console.log("▸ Suporte Bipolar · TestFlight setup");
  const app = await getApp();
  console.log(`  app: ${app.attributes.name} (${app.id})`);

  console.log("▸ Aguardando build processar…");
  const build = await waitBuildValid(app.id);
  console.log(`  ✅ build ${build.attributes.version} · VALID`);

  await setExportCompliance(build.id);
  const group = await ensureBetaGroup(app.id);
  await attachBuildToGroup(group.id, build.id);
  await setBetaTestInfo(build.id);
  await setBetaAppReviewDetails(app.id);
  await submitForReview(build.id);
  await addTester(group.id);

  console.log("\n✅ Setup concluído.");
  console.log("   Beta Review (primeira vez): 12–48h.");
  console.log("   Após aprovação, teu pai recebe email do TestFlight automaticamente.");
})().catch((e) => die(String(e.stack ?? e)));

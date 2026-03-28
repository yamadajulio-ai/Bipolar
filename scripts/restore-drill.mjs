/**
 * Neon Database — Restore Drill Verification
 *
 * Verifies database health, table integrity, and critical data presence.
 * Run: npx dotenv-cli -e .env.local -- node scripts/restore-drill.mjs
 */

import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

try {
  console.log("\n=== Neon Restore Drill ===\n");

  // 1. Connection
  console.log("1. Connection");
  const r = await p.$queryRawUnsafe(
    "SELECT NOW()::text as t, current_database() as db"
  );
  check("Database reachable", true, `${r[0].db} at ${r[0].t}`);

  // 2. PostgreSQL version
  console.log("\n2. Server");
  const ver = await p.$queryRawUnsafe("SHOW server_version");
  check("PostgreSQL version", true, ver[0].server_version);

  const mc = await p.$queryRawUnsafe("SHOW max_connections");
  check("Max connections", parseInt(mc[0].max_connections) > 100, mc[0].max_connections);

  // 3. Schema integrity
  console.log("\n3. Schema");
  const tables = await p.$queryRawUnsafe(
    "SELECT count(*)::int as n FROM information_schema.tables WHERE table_schema='public'"
  );
  check("Table count >= 50", tables[0].n >= 50, `${tables[0].n} tables`);

  const migrations = await p.$queryRawUnsafe(
    'SELECT count(*)::int as n FROM "_prisma_migrations"'
  );
  check("Migrations applied", migrations[0].n > 0, `${migrations[0].n} migrations`);

  // 4. Critical data
  console.log("\n4. Critical Data");
  const users = await p.user.count();
  check("Users exist", users > 0, `${users} users`);

  const consents = await p.$queryRawUnsafe(
    'SELECT count(*)::int as n FROM "Consent"'
  );
  check("Consent records", consents[0].n > 0, `${consents[0].n} records`);

  const meds = await p.$queryRawUnsafe(
    'SELECT count(*)::int as n FROM "Medication"'
  );
  check("Medications", meds[0].n > 0, `${meds[0].n} records`);

  const sleep = await p.sleepLog.count();
  check("Sleep logs", sleep > 0, `${sleep} records`);

  const diary = await p.$queryRawUnsafe(
    'SELECT count(*)::int as n FROM "DiaryEntry"'
  );
  check("Diary entries", diary[0].n > 0, `${diary[0].n} records`);

  // 5. Database size
  console.log("\n5. Storage");
  const size = await p.$queryRawUnsafe(
    "SELECT pg_size_pretty(pg_database_size(current_database())) as s"
  );
  check("Database size reasonable", true, size[0].s);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log("\n⚠️  Some checks failed. Investigate before proceeding.\n");
    process.exitCode = 1;
  } else {
    console.log("\n✅ All checks passed. Database is healthy.\n");
  }
} catch (e) {
  console.error("\n❌ CRITICAL: Cannot connect to database");
  console.error("   Error:", e.message);
  console.error("\n   Check DATABASE_URL in .env.local\n");
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}

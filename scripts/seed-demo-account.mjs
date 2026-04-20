/**
 * Seed demo account for App Store review.
 * Creates reviewer@suportebipolar.com with 30 days of realistic data.
 *
 * Run:
 *   export $(grep ^DATABASE_URL .env.production.local | xargs)
 *   export $(grep ^DEMO_ACCOUNT_PASSWORD .env.testflight | xargs)
 *   node scripts/seed-demo-account.mjs
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'reviewer@suportebipolar.com';
const TIMEZONE = 'America/Sao_Paulo';

function localDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('sv-SE', { timeZone: TIMEZONE });
}

function utcDate(daysAgo, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function moodPattern(day) {
  if (day >= 23) return { mood: 2, energy: 2, anxiety: 3, irritability: 2 };
  if (day >= 16) return { mood: 3, energy: 3, anxiety: 2, irritability: 1 };
  if (day >= 10) return { mood: 4, energy: 4, anxiety: 2, irritability: 2 };
  if (day >= 5) return { mood: 3, energy: 3, anxiety: 2, irritability: 1 };
  return { mood: 3, energy: 3, anxiety: 2, irritability: 1 };
}

function vary(val, min = 1, max = 5) {
  const delta = Math.random() > 0.5 ? 1 : Math.random() > 0.5 ? -1 : 0;
  return Math.max(min, Math.min(max, val + delta));
}

function sleepPattern(day) {
  if (day >= 23) return { hours: 9 + Math.random(), quality: 40 + Math.floor(Math.random() * 20) };
  if (day >= 10 && day < 16) return { hours: 5.5 + Math.random(), quality: 50 + Math.floor(Math.random() * 20) };
  return { hours: 7 + Math.random() * 1.5, quality: 65 + Math.floor(Math.random() * 25) };
}

async function main() {
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!password || password.length < 8) {
    console.error('❌ DEMO_ACCOUNT_PASSWORD env var missing or too short');
    process.exit(1);
  }

  console.log('▸ Seeding demo account for App Store review…');

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
    console.log('  (wiped previous reviewer account)');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: 'App Reviewer',
      onboarded: true,
      onboardingGoal: 'detect',
      authProvider: 'email',
    },
  });
  console.log(`  user ${user.email} (${user.id})`);

  const scopes = ['health_data', 'terms_of_use', 'ai_narrative', 'push_notifications'];
  for (const scope of scopes) {
    await prisma.consent.create({ data: { userId: user.id, scope, version: 1 } });
  }

  for (let day = 29; day >= 0; day--) {
    const date = localDate(day);
    const pattern = moodPattern(day);
    const m = vary(pattern.mood);
    const e = vary(pattern.energy);
    const a = vary(pattern.anxiety);
    const i = vary(pattern.irritability);
    const sleep = sleepPattern(day);

    const entry = await prisma.diaryEntry.create({
      data: {
        userId: user.id,
        date,
        mood: m,
        sleepHours: Math.round(sleep.hours * 10) / 10,
        energyLevel: e,
        anxietyLevel: a,
        irritability: i,
        mode: 'AUTO_FROM_SNAPSHOT',
        snapshotCount: 1,
        firstSnapshotAt: utcDate(day, 9),
        lastSnapshotAt: utcDate(day, 9),
      },
    });

    await prisma.moodSnapshot.create({
      data: {
        userId: user.id,
        diaryEntryId: entry.id,
        capturedAt: utcDate(day, 9),
        localDate: date,
        mood: m,
        energy: e,
        anxiety: a,
        irritability: i,
        clientRequestId: randomUUID(),
      },
    });
  }
  console.log('  ✓ 30 days of diary + mood snapshots');

  for (let day = 29; day >= 0; day--) {
    const date = localDate(day);
    const sleep = sleepPattern(day);
    const bedHour = 22 + Math.floor(Math.random() * 2);
    const bedMin = Math.floor(Math.random() * 60);
    const totalMin = bedHour * 60 + bedMin + Math.round(sleep.hours * 60);
    const wakeHour = Math.floor((totalMin / 60) % 24);
    const wakeMin = totalMin % 60;

    await prisma.sleepLog.create({
      data: {
        userId: user.id,
        date,
        bedtime: `${String(bedHour).padStart(2, '0')}:${String(bedMin).padStart(2, '0')}`,
        wakeTime: `${String(wakeHour).padStart(2, '0')}:${String(wakeMin).padStart(2, '0')}`,
        totalHours: Math.round(sleep.hours * 10) / 10,
        quality: sleep.quality,
        source: 'manual',
      },
    });
  }
  console.log('  ✓ 30 days of sleep logs');

  const meds = [
    { name: 'Lítio', dosageText: '600mg', riskRole: 'mood_stabilizer', time: '08:00' },
    { name: 'Quetiapina XR', dosageText: '300mg', riskRole: 'antipsychotic', time: '22:00' },
    { name: 'Clonazepam', dosageText: '0.5mg', riskRole: 'anxiolytic', asNeeded: true },
  ];

  const startDate = localDate(29);
  for (const m of meds) {
    const med = await prisma.medication.create({
      data: {
        userId: user.id,
        name: m.name,
        dosageText: m.dosageText,
        riskRole: m.riskRole,
        isAsNeeded: !!m.asNeeded,
        startDate,
      },
    });
    if (m.asNeeded) continue;
    const schedule = await prisma.medicationSchedule.create({
      data: { medicationId: med.id, timeLocal: m.time, effectiveFrom: startDate },
    });
    for (let day = 29; day >= 0; day--) {
      const date = localDate(day);
      const taken = Math.random() > 0.13;
      const [hh, mm] = m.time.split(':').map(Number);
      await prisma.medicationLog.create({
        data: {
          userId: user.id,
          medicationId: med.id,
          scheduleId: schedule.id,
          date,
          status: taken ? 'TAKEN' : 'MISSED',
          scheduledTimeLocal: m.time,
          takenAt: taken ? utcDate(day, hh, mm) : null,
          source: 'FULL_DIARY',
        },
      });
    }
  }
  console.log('  ✓ medications (Lítio / Quetiapina / Clonazepam PRN) + 30d adherence');

  await prisma.reminderSettings.create({
    data: {
      userId: user.id,
      wakeReminder: '07:00',
      sleepReminder: '22:00',
      diaryReminder: '21:00',
      enabled: true,
      privacyMode: true,
    },
  });

  const seen = new Set();
  for (let week = 0; week < 4; week++) {
    const daysAgo = week * 7 + ((new Date().getDay() + 7) % 7);
    const date = localDate(daysAgo);
    if (seen.has(date)) continue;
    seen.add(date);
    const pattern = moodPattern(daysAgo);

    const asrmBase = pattern.mood >= 4 ? 3 : 1;
    const asrm = Array.from({ length: 5 }, () => vary(asrmBase, 0, 4));

    const phq9Base = pattern.mood <= 2 ? 2 : 0;
    const phq9 = Array.from({ length: 9 }, () => vary(phq9Base, 0, 3));

    const fast = { work: 2, social: 2, selfcare: 3, finances: 2, cognition: 2, leisure: 2 };
    const fastValues = Object.values(fast);
    const fastAvg = fastValues.reduce((a, b) => a + b, 0) / fastValues.length;

    await prisma.weeklyAssessment.create({
      data: {
        userId: user.id,
        date,
        asrmScores: JSON.stringify(asrm),
        asrmTotal: asrm.reduce((a, b) => a + b, 0),
        phq9Scores: JSON.stringify(phq9),
        phq9Total: phq9.reduce((a, b) => a + b, 0),
        phq9Item9: phq9[8],
        fastScores: JSON.stringify(fast),
        fastAvg,
      },
    });
  }
  console.log(`  ✓ ${seen.size} weekly assessments`);

  console.log('\n✅ Demo account seeded.');
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log('   Password: (see DEMO_ACCOUNT_PASSWORD in .env.testflight)');
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Seed demo account for App Store review.
 * Creates reviewer@suportebipolar.com with 30 days of realistic data.
 *
 * Run: node scripts/seed-demo-account.mjs
 * Requires: DATABASE_URL env var (or .env file)
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'reviewer@suportebipolar.com';
const DEMO_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$demo_review_salt$demo_review_hash'; // Replace with real hash before submission
const TIMEZONE = 'America/Sao_Paulo';

function localDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('sv-SE', { timeZone: TIMEZONE });
}

function utcDate(daysAgo, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Realistic bipolar mood patterns: slight euthymic baseline with natural variation
function moodPattern(day) {
  // Days 0-7: mild depression recovering
  if (day >= 23) return { mood: 2, energy: 2, anxiety: 3, irritability: 2 };
  // Days 8-14: euthymic baseline
  if (day >= 16) return { mood: 3, energy: 3, anxiety: 2, irritability: 1 };
  // Days 15-20: slight hypomania trend
  if (day >= 10) return { mood: 4, energy: 4, anxiety: 2, irritability: 2 };
  // Days 21-25: coming down
  if (day >= 5) return { mood: 3, energy: 3, anxiety: 2, irritability: 1 };
  // Days 26-30: stable euthymic
  return { mood: 3, energy: 3, anxiety: 2, irritability: 1 };
}

// Natural variation (+/- 1)
function vary(val, min = 1, max = 5) {
  const delta = Math.random() > 0.5 ? 1 : Math.random() > 0.5 ? -1 : 0;
  return Math.max(min, Math.min(max, val + delta));
}

function sleepPattern(day) {
  // Correlate with mood: hypomania = less sleep, depression = more
  if (day >= 23) return { hours: 9 + Math.random(), quality: 40 + Math.floor(Math.random() * 20) }; // depression: oversleeping
  if (day >= 10 && day < 16) return { hours: 5.5 + Math.random(), quality: 50 + Math.floor(Math.random() * 20) }; // hypomania: less sleep
  return { hours: 7 + Math.random() * 1.5, quality: 65 + Math.floor(Math.random() * 25) }; // euthymic: normal
}

async function main() {
  console.log('Seeding demo account for App Store review...\n');

  // Delete existing demo account if present
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
    console.log('Deleted existing demo account.');
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: DEMO_PASSWORD_HASH,
      name: 'App Reviewer',
      onboarded: true,
      onboardingGoal: 'detect',
      authProvider: 'email',
    },
  });
  console.log(`Created user: ${user.email} (${user.id})`);

  // Create consents
  const consentScopes = ['health_data', 'terms_of_use', 'push_notifications', 'assessments', 'crisis_plan', 'sos_chatbot', 'clinical_export'];
  for (const scope of consentScopes) {
    await prisma.consent.create({
      data: {
        userId: user.id,
        scope,
        granted: true,
        version: 1,
      },
    });
  }
  console.log(`Created ${consentScopes.length} consent records.`);

  // Create 30 days of diary entries + mood snapshots
  for (let day = 0; day < 30; day++) {
    const date = localDate(day);
    const pattern = moodPattern(day);
    const m = vary(pattern.mood);
    const e = vary(pattern.energy);

    const entry = await prisma.diaryEntry.create({
      data: {
        userId: user.id,
        date,
        mood: m,
        sleepHours: 7,
        energyLevel: e,
        anxietyLevel: vary(pattern.anxiety),
        irritability: vary(pattern.irritability),
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
        anxiety: vary(pattern.anxiety),
        irritability: vary(pattern.irritability),
        clientRequestId: randomUUID(),
      },
    });
  }
  console.log('Created 30 days of mood data.');

  // Create 30 days of sleep logs
  for (let day = 0; day < 30; day++) {
    const date = localDate(day);
    const sleep = sleepPattern(day);
    const bedHour = 22 + Math.floor(Math.random() * 2);
    const bedMin = Math.floor(Math.random() * 60);
    const wakeHour = bedHour + Math.floor(sleep.hours) - 24;
    const wakeMin = Math.floor((sleep.hours % 1) * 60);

    await prisma.sleepLog.create({
      data: {
        userId: user.id,
        date,
        bedtime: `${String(bedHour).padStart(2, '0')}:${String(bedMin).padStart(2, '0')}`,
        wakeTime: `${String(Math.max(5, wakeHour)).padStart(2, '0')}:${String(wakeMin).padStart(2, '0')}`,
        totalHours: Math.round(sleep.hours * 10) / 10,
        quality: sleep.quality,
        source: 'manual',
      },
    });
  }
  console.log('Created 30 days of sleep data.');

  // Create 4 weekly assessments (last 4 Sundays)
  for (let week = 0; week < 4; week++) {
    const daysAgo = week * 7 + ((new Date().getDay() + 7) % 7); // last N Sundays
    const date = localDate(daysAgo);
    const pattern = moodPattern(daysAgo);

    // ASRM: higher during hypomania window
    const asrmBase = pattern.mood >= 4 ? 8 : 3;
    const asrm = [
      vary(Math.min(asrmBase, 4), 0, 4),
      vary(Math.min(asrmBase - 1, 4), 0, 4),
      vary(Math.min(asrmBase - 1, 4), 0, 4),
      vary(Math.min(asrmBase - 2, 4), 0, 4),
      vary(Math.min(asrmBase - 2, 4), 0, 4),
    ];

    // PHQ-9: higher during depression window
    const phq9Base = pattern.mood <= 2 ? 2 : 0;
    const phq9 = Array.from({ length: 9 }, () => vary(phq9Base, 0, 3));

    await prisma.weeklyAssessment.create({
      data: {
        userId: user.id,
        date,
        asrmAnswers: JSON.stringify(asrm),
        asrmTotal: asrm.reduce((a, b) => a + b, 0),
        phq9Answers: JSON.stringify(phq9),
        phq9Total: phq9.reduce((a, b) => a + b, 0),
        phq9Item9: phq9[8],
        fastAnswers: JSON.stringify([2, 2, 3, 2, 2, 2]),
        fastTotal: 13,
      },
    });
  }
  console.log('Created 4 weekly assessments.');

  console.log('\nDemo account seeded successfully!');
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log('Password: [set a real password hash before submission]');
  console.log('\nRemember to generate a proper password hash with argon2.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

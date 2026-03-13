const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const r = await p.integrationKey.findFirst({
    where: { service: 'health_auto_export' },
    select: { lastPayloadDebug: true }
  });

  if (!r || !r.lastPayloadDebug) {
    console.log('No payload');
    return;
  }

  const data = JSON.parse(r.lastPayloadDebug);
  console.log('Timestamp:', data._timestamp || 'N/A (old deploy)');

  if (data._parsedNights) {
    console.log('\n=== PARSED NIGHTS (server result) ===');
    data._parsedNights.forEach(function(n, i) {
      console.log(i + ':', 'date=' + n.date, 'bed=' + n.bedtime, 'wake=' + n.wakeTime, 'hours=' + n.totalHours, 'q=' + n.quality, 'awakenings=' + n.awakenings);
    });
  } else {
    console.log('No _parsedNights — old deploy still active, or payload pre-fix');
  }

  // Also check what's in the DB now
  const logs = await p.sleepLog.findMany({
    where: { date: { gte: '2026-03-12', lte: '2026-03-13' } },
    orderBy: { date: 'asc' }
  });
  console.log('\n=== DB SLEEP LOGS (Mar 12-13) ===');
  logs.forEach(function(l) {
    console.log('date=' + l.date, 'bed=' + l.bedtime, 'wake=' + l.wakeTime, 'hours=' + l.totalHours, 'updated=' + l.createdAt.toISOString());
  });
}

main().then(function() { p.$disconnect(); });

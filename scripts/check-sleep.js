const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const key = await p.integrationKey.findFirst({
    where: { service: 'health_auto_export' },
    select: { lastPayloadDebug: true }
  });

  if (!key || !key.lastPayloadDebug) {
    console.log('No payload saved');
    return;
  }

  var raw = key.lastPayloadDebug;
  console.log('Payload size:', raw.length, 'chars');

  // Try to parse, if truncated try to fix
  var data;
  try {
    data = JSON.parse(raw);
  } catch(e) {
    console.log('JSON truncated, attempting partial parse...');
    // Find sleep entries by regex
    var regex = /"startDate"\s*:\s*"([^"]+)"\s*,\s*"endDate"\s*:\s*"([^"]*)"[^}]*"value"\s*:\s*"([^"]*)"/g;
    var match;
    var entries = [];
    while ((match = regex.exec(raw)) !== null) {
      entries.push({ start: match[1], end: match[2], value: match[3] });
    }
    if (entries.length === 0) {
      // Try alternate field order
      regex = /"value"\s*:\s*"([^"]+)"[^}]*"startDate"\s*:\s*"([^"]+)"\s*,\s*"endDate"\s*:\s*"([^"]*)"/g;
      while ((match = regex.exec(raw)) !== null) {
        entries.push({ start: match[2], end: match[3], value: match[1] });
      }
    }
    if (entries.length === 0) {
      // Most generic: find all startDate/value pairs
      regex = /"startDate"\s*:\s*"([^"]+)"/g;
      var starts = [];
      while ((match = regex.exec(raw)) !== null) starts.push(match[1]);
      regex = /"value"\s*:\s*"([^"]+)"/g;
      var values = [];
      while ((match = regex.exec(raw)) !== null) values.push(match[1]);
      regex = /"endDate"\s*:\s*"([^"]+)"/g;
      var ends = [];
      while ((match = regex.exec(raw)) !== null) ends.push(match[1]);

      console.log('\nFound', starts.length, 'startDates,', ends.length, 'endDates,', values.length, 'values');
      var count = Math.min(starts.length, values.length, ends.length);
      for (var i = 0; i < count; i++) {
        entries.push({ start: starts[i], end: ends[i], value: values[i] });
      }
    }

    if (entries.length > 0) {
      console.log('\nFound', entries.length, 'sleep entries (partial):');
      entries.forEach(function(e) {
        console.log(' ', e.start, '->', e.end, '|', e.value);
      });
    } else {
      console.log('Could not extract sleep entries from truncated payload');
      console.log('First 500 chars:', raw.substring(0, 500));
    }
    return;
  }

  // Full parse succeeded
  var sleepMetric = data._sleepMetric;
  if (sleepMetric) {
    console.log('\n=== SLEEP METRIC ===');
    console.log('Name:', sleepMetric.name, '| Entries:', sleepMetric.data.length);
    console.log('Metrics count in payload:', data._metricsCount);
    console.log('\nAll sleep entries:');
    sleepMetric.data.forEach(function(e, i) {
      console.log(i + ':', (e.startDate || e.date || '?'), '->', (e.endDate || '?'),
        '| value:', e.value, '| source:', (e.source || '?'));
    });
  } else {
    console.log('No _sleepMetric in payload. Keys:', Object.keys(data));
  }
}

main().then(function() { return p.$disconnect(); });

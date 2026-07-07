/**
 * MISTER — Opponent Tracker
 * 
 * Tracks opponents across the season: styles, weaknesses, results,
 * key players, and how our game model matched up.
 * 
 * Generates opponent reports that feed into match preparation
 * and training data.
 * 
 * Usage:
 *   node src/analysis/opponent_tracker.js --list                    List all opponents
 *   node src/analysis/opponent_tracker.js --report "SV Hafen United" Full report
 *   node src/analysis/opponent_tracker.js --add-result              Add match result
 *   node src/analysis/opponent_tracker.js --weaknesses              All weaknesses summary
 *   node src/analysis/opponent_tracker.js --patterns                Pattern analysis
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { ensureDir, writeJSON, readJSON, fileExists, generateId } = require('../utils/helpers');

const OPPONENTS_FILE = path.join(process.cwd(), 'data/opponents/opponents.json');
const RESULTS_FILE = path.join(process.cwd(), 'data/opponents/results.json');

async function main() {
  const action = process.argv.find(a => a.startsWith('--'))?.replace('--', '');

  switch (action) {
    case 'list':
      await listOpponents();
      break;
    case 'report':
      await opponentReport();
      break;
    case 'add-result':
      await addResult();
      break;
    case 'weaknesses':
      await weaknessesSummary();
      break;
    case 'patterns':
      await patternAnalysis();
      break;
    case 'export':
      await exportData();
      break;
    default:
      printUsage();
  }
}

async function listOpponents() {
  if (!fileExists(OPPONENTS_FILE)) {
    console.log('No opponent data found.');
    return;
  }

  const opponents = readJSON(OPPONENTS_FILE);
  let results = [];
  if (fileExists(RESULTS_FILE)) {
    results = readJSON(RESULTS_FILE);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           Opponent Tracker                                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  for (const opp of opponents) {
    const oppResults = results.filter(r => r.opponent === opp.name);
    const wins = oppResults.filter(r => r.result === 'W').length;
    const draws = oppResults.filter(r => r.result === 'D').length;
    const losses = oppResults.filter(r => r.result === 'L').length;

    console.log(`║  ${opp.name}`);
    console.log(`║  Style: ${opp.style.substring(0, 50)}`);
    console.log(`║  Record: ${wins}W ${draws}D ${losses}L (${oppResults.length} matches)`);
    console.log(`║  Weaknesses: ${opp.weaknesses.length} identified`);
    console.log(`║  ─────────────────────────────────────────────────────────`);
  }

  console.log('╚════════════════════════════════════════════════════════════╝');
}

async function opponentReport() {
  const oppName = process.argv.find(a => a.startsWith('--report='))?.split('=')[1];

  if (!oppName || !fileExists(OPPONENTS_FILE)) {
    console.log('Usage: --report "SV Hafen United"');
    return;
  }

  const opponents = readJSON(OPPONENTS_FILE);
  const opp = opponents.find(o => o.name.toLowerCase().includes(oppName.toLowerCase()));

  if (!opp) {
    console.log(`Opponent "${oppName}" not found.`);
    return;
  }

  let results = [];
  if (fileExists(RESULTS_FILE)) {
    results = readJSON(RESULTS_FILE).filter(r => r.opponent === opp.name);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  OPPONENT REPORT: ${opp.name}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n  Style: ${opp.style}`);
  console.log(`  Formation: ${opp.formation || 'Unknown'}`);

  console.log(`\n  STRENGTHS:`);
  for (const s of opp.strengths) {
    console.log(`    ✓ ${s}`);
  }

  console.log(`\n  WEAKNESSES (exploitable):`);
  for (const w of opp.weaknesses) {
    console.log(`    ✗ ${w}`);
  }

  console.log(`\n  KEY PLAYERS:`);
  for (const p of opp.key_players) {
    console.log(`    ${p.name} (${p.pos})`);
    console.log(`      ${p.note}`);
  }

  if (opp.last_match) {
    console.log(`\n  LAST MATCH: ${opp.last_match}`);
  }

  if (results.length > 0) {
    console.log(`\n  MATCH HISTORY:`);
    for (const r of results) {
      console.log(`    ${r.date} — ${r.result} ${r.score || ''} — ${r.notes || ''}`);
    }
  }

  // Game model matchup analysis
  console.log(`\n  GAME MODEL MATCHUP:`);
  console.log(`    Our pressing vs their build-up:`);
  if (opp.weaknesses.some(w => w.toLowerCase().includes('pressure') || w.toLowerCase().includes('press'))) {
    console.log(`      → Advantage: They're weak to pressure. First touch pressure all day.`);
  } else {
    console.log(`      → Neutral: Test their build-up in first 10 minutes.`);
  }

  console.log(`    Our channel runs vs their CBs:`);
  if (opp.weaknesses.some(w => w.toLowerCase().includes('cb') || w.toLowerCase().includes('channel') || w.toLowerCase().includes('turn'))) {
    console.log(`      → Advantage: Their CBs are vulnerable. Hartmann in the channel.`);
  } else {
    console.log(`      → Test: Check CB recovery speed in first 10 minutes.`);
  }

  console.log(`    Our flank overload vs their fullbacks:`);
  if (opp.weaknesses.some(w => w.toLowerCase().includes('fullback') || w.toLowerCase().includes('wing') || w.toLowerCase().includes('flank'))) {
    console.log(`      → Advantage: Fullbacks exposed. Krüger pins, Wendt drifts, 2v1s.`);
  } else {
    console.log(`      → Standard: Run the overload pattern, adjust if covered.`);
  }

  console.log(`\n${'═'.repeat(70)}`);
}

async function addResult() {
  const opponent = process.argv.find(a => a.startsWith('--opponent='))?.split('=')[1];
  const result = process.argv.find(a => a.startsWith('--result='))?.split('=')[1]; // W/D/L
  const score = process.argv.find(a => a.startsWith('--score='))?.split('=')[1];
  const notes = process.argv.find(a => a.startsWith('--notes='))?.split('=')[1] || '';
  const date = process.argv.find(a => a.startsWith('--date='))?.split('=')[1] || new Date().toISOString().split('T')[0];

  if (!opponent || !result) {
    console.log('Usage: --add-result --opponent "SV Hafen United" --result W --score "3-1" --notes "Channel runs worked"');
    return;
  }

  const entry = {
    id: generateId('result'),
    opponent,
    result: result.toUpperCase(),
    score,
    notes,
    date,
    addedAt: new Date().toISOString(),
  };

  let results = [];
  if (fileExists(RESULTS_FILE)) {
    results = readJSON(RESULTS_FILE);
  }
  results.push(entry);
  writeJSON(RESULTS_FILE, results);

  console.log(`✓ Result added: ${result} vs ${opponent} (${score})`);
  log.metric('opponent', 'result_added', { opponent, result });
}

async function weaknessesSummary() {
  if (!fileExists(OPPONENTS_FILE)) {
    console.log('No opponent data.');
    return;
  }

  const opponents = readJSON(OPPONENTS_FILE);
  const allWeaknesses = [];

  for (const opp of opponents) {
    for (const w of opp.weaknesses) {
      allWeaknesses.push({ opponent: opp.name, weakness: w });
    }
  }

  // Categorize weaknesses
  const categories = {
    'GK/Build-up': allWeaknesses.filter(w => /gk|keeper|build|pressure|distribution/i.test(w.weakness)),
    'CB/Defense': allWeaknesses.filter(w => /cb|center back|turn|recover|channel/i.test(w.weakness)),
    'Fullback/Flank': allWeaknesses.filter(w => /fullback|wing|flank|wide|track back/i.test(w.weakness)),
    'Midfield': allWeaknesses.filter(w => /midfield|6|press|shield/i.test(w.weakness)),
    'Block/Shape': allWeaknesses.filter(w => /block|shape|press|structure|passive/i.test(w.weakness)),
    'Other': allWeaknesses.filter(w => !/gk|cb|fullback|wing|flank|midfield|block|shape|press/i.test(w.weakness)),
  };

  console.log('\nOpponent Weaknesses Summary');
  console.log('═'.repeat(60));

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    console.log(`\n${category}:`);
    for (const item of items) {
      console.log(`  ${item.opponent}: ${item.weakness}`);
    }
  }

  // Our patterns that exploit these
  console.log('\n═'.repeat(60));
  console.log('\nOur Exploitation Patterns:');
  console.log('  GK/Build-up weakness → First touch pressure, force long ball');
  console.log('  CB/Defense weakness → Channel runs, Hartmann peels');
  console.log('  Fullback/Flank weakness → Flank overload, Krüger pins, Wendt drifts');
  console.log('  Midfield weakness → Riedel marks their 6, Schäfer presses');
  console.log('  Block/Shape weakness → Build patience, switch point of attack');
}

async function patternAnalysis() {
  if (!fileExists(OPPONENTS_FILE)) {
    console.log('No opponent data.');
    return;
  }

  const opponents = readJSON(OPPONENTS_FILE);
  let results = [];
  if (fileExists(RESULTS_FILE)) {
    results = readJSON(RESULTS_FILE);
  }

  console.log('\nPattern Analysis: Our Game Model vs Opponents');
  console.log('═'.repeat(60));

  // For each opponent, identify which of our patterns to use
  for (const opp of opponents) {
    console.log(`\n${opp.name}:`);
    console.log(`  Style: ${opp.style.substring(0, 60)}`);

    const patterns = [];

    if (opp.weaknesses.some(w => /gk|pressure|build/i.test(w))) {
      patterns.push('First Touch Pressure → force mistakes');
    }
    if (opp.weaknesses.some(w => /cb|channel|turn|recover/i.test(w))) {
      patterns.push('Channel Runs → Hartmann peels, Fass-type CB exposed');
    }
    if (opp.weaknesses.some(w => /fullback|wing|flank|track/i.test(w))) {
      patterns.push('Flank Overload → 2v1s on the wing');
    }
    if (opp.weaknesses.some(w => /block|mid|compact|passive/i.test(w))) {
      patterns.push('Build Patience → circulate, wait for trigger');
    }
    if (opp.weaknesses.some(w => /counter|fast|rapid/i.test(w))) {
      patterns.push('Compact Rest-Defence → no overlapping, 18-20m');
    }

    for (const p of patterns) {
      console.log(`  → ${p}`);
    }

    const oppResults = results.filter(r => r.opponent === opp.name);
    if (oppResults.length > 0) {
      const avgResult = oppResults.map(r => r.result === 'W' ? 1 : r.result === 'D' ? 0 : -1);
      const avg = avgResult.reduce((a, b) => a + b, 0) / avgResult.length;
      console.log(`  Record: ${avg > 0 ? 'Positive' : avg < 0 ? 'Negative' : 'Even'} (${oppResults.length} matches)`);
    }
  }
}

async function exportData() {
  const outputPath = process.argv.find(a => a.startsWith('--export='))?.split('=')[1] || 'opponent_export.json';
  const opponents = fileExists(OPPONENTS_FILE) ? readJSON(OPPONENTS_FILE) : [];
  const results = fileExists(RESULTS_FILE) ? readJSON(RESULTS_FILE) : [];
  writeJSON(outputPath, { exportedAt: new Date().toISOString(), opponents, results });
  console.log(`✓ Exported to ${outputPath}`);
}

function printUsage() {
  console.log('MISTER — Opponent Tracker');
  console.log('');
  console.log('Usage:');
  console.log('  --list                              List all opponents');
  console.log('  --report "SV Hafen United"          Full tactical report');
  console.log('  --add-result --opponent "Name" --result W --score "3-1"');
  console.log('  --weaknesses                        All weaknesses categorized');
  console.log('  --patterns                          Pattern analysis vs each opponent');
  console.log('  --export file.json                  Export all data');
}

main().catch(err => {
  log.error('opponent', 'Opponent tracker error', { error: err.message });
  process.exit(1);
});

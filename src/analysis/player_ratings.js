/**
 * MISTER — Player Ratings & Performance Tracker
 * 
 * Tracks player performance across matches using the club's game model
 * as the evaluation framework. Every match produces structured ratings
 * that feed back into training data.
 * 
 * Ratings are based on how well the player executed the club's principles,
 * not generic football stats. This is the Moneyball approach applied to
 * tactical alignment.
 * 
 * Usage:
 *   node src/analysis/player_ratings.js --match "Hafen Rückrunde" --ratings ratings.json
 *   node src/analysis/player_ratings.js --season                    Full season summary
 *   node src/analysis/player_ratings.js --player "Hartmann"         Player history
 *   node src/analysis/player_ratings.js --add-match                 Interactive entry
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { ensureDir, writeJSON, readJSON, fileExists, generateId, mean, stdDev, percentile } = require('../utils/helpers');

const RATINGS_DIR = path.join(process.cwd(), 'data/ratings');
const RATINGS_FILE = path.join(RATINGS_DIR, 'all_ratings.json');

// Rating criteria based on club principles
const RATING_CRITERIA = {
  pressing: {
    description: 'Press from the front — first defender intensity',
    weight: 0.2,
    scale: '1-5 (1=passive, 5=relentless)',
  },
  verticality: {
    description: 'Forward-first mentality in possession',
    weight: 0.15,
    scale: '1-5 (1=sideways only, 5=always forward)',
  },
  compact_block: {
    description: 'Positional discipline in rest-defence',
    weight: 0.15,
    scale: '1-5 (1=disconnected, 5=always compact)',
  },
  flank_overload: {
    description: 'Creation/exploitation of 2v1 situations',
    weight: 0.15,
    scale: '1-5 (1=no overloads, 5=constant 2v1s)',
  },
  transition: {
    description: 'Speed of transition (win it → shot/cross)',
    weight: 0.15,
    scale: '1-5 (1=slow/recycling, 5=two-touch finish)',
  },
  execution: {
    description: 'Technical execution of assigned role',
    weight: 0.10,
    scale: '1-5 (1=poor, 5=excellent)',
  },
  discipline: {
    description: 'Adherence to game model (no freelancing)',
    weight: 0.10,
    scale: '1-5 (1=ignored plan, 5=perfect execution)',
  },
  fitness: {
    description: 'Physical output and stamina',
    weight: 0.05,
    scale: '1-5 (1=gassed early, 5=90 min engine)',
  },
};

async function main() {
  const action = process.argv.find(a => a.startsWith('--'))?.replace('--', '');

  switch (action) {
    case 'add-match':
      await addMatchRatings();
      break;
    case 'season':
      await seasonSummary();
      break;
    case 'player':
      await playerHistory();
      break;
    case 'match':
      await matchDetail();
      break;
    case 'export':
      await exportRatings();
      break;
    default:
      printUsage();
  }
}

async function addMatchRatings() {
  const ratingsFile = process.argv.find(a => a.startsWith('--ratings='))?.split('=')[1];
  const matchName = process.argv.find(a => a.startsWith('--match='))?.split('=')[1] || `Match ${new Date().toLocaleDateString()}`;

  let playerRatings = [];

  if (ratingsFile && fileExists(ratingsFile)) {
    playerRatings = readJSON(ratingsFile);
  } else {
    // Load club profile to get player list
    const clubPath = path.join(process.cwd(), 'data/club_profile.json');
    if (!fileExists(clubPath)) {
      log.error('ratings', 'Club profile not found');
      process.exit(1);
    }
    const club = readJSON(clubPath);

    // Generate template ratings (neutral 3.0)
    playerRatings = club.players.map(p => ({
      name: p.name,
      position: p.pos,
      ratings: Object.keys(RATING_CRITERIA).reduce((acc, k) => { acc[k] = 3.0; return acc; }, {}),
      notes: '',
    }));
  }

  // Calculate weighted scores
  const processed = playerRatings.map(pr => {
    const weighted = Object.entries(pr.ratings).reduce((acc, [key, val]) => {
      const criterion = RATING_CRITERIA[key];
      return acc + (val * (criterion?.weight || 0));
    }, 0);

    return {
      ...pr,
      weightedScore: parseFloat(weighted.toFixed(2)),
    };
  });

  const matchEntry = {
    id: generateId('match'),
    matchName,
    date: new Date().toISOString(),
    players: processed.sort((a, b) => b.weightedScore - a.weightedScore),
  };

  // Append to ratings log
  ensureDir(RATINGS_DIR);
  let allRatings = [];
  if (fileExists(RATINGS_FILE)) {
    allRatings = readJSON(RATINGS_FILE);
  }
  allRatings.push(matchEntry);
  writeJSON(RATINGS_FILE, allRatings);

  // Print match report
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  Match Ratings: ${matchName.substring(0, 40).padEnd(40)}  ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  console.log(`║  Player                    Pos    Score  Press  Vert  Comp ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);

  for (const p of matchEntry.players) {
    const name = p.name.substring(0, 22).padEnd(22);
    const pos = p.position.substring(0, 4).padEnd(4);
    const score = p.weightedScore.toFixed(2).padStart(5);
    const press = p.ratings.pressing?.toFixed(1) || 'N/A';
    const vert = p.ratings.verticality?.toFixed(1) || 'N/A';
    const comp = p.ratings.compact_block?.toFixed(1) || 'N/A';
    console.log(`║  ${name}  ${pos}  ${score}  ${press.padStart(5)}  ${vert.padStart(5)}  ${comp.padStart(5)} ║`);
  }

  console.log(`╚════════════════════════════════════════════════════════════╝`);

  // Man of the match
  const motm = matchEntry.players[0];
  console.log(`\n  ⭐ Man of the Match: ${motm.name} (${motm.weightedScore.toFixed(2)})`);

  log.metric('ratings', 'match_avg_score', mean(matchEntry.players.map(p => p.weightedScore)));
  log.metric('ratings', 'motm_score', motm.weightedScore);
}

async function seasonSummary() {
  if (!fileExists(RATINGS_FILE)) {
    console.log('No ratings data. Add match ratings first.');
    return;
  }

  const allRatings = readJSON(RATINGS_FILE);
  console.log(`\nSeason Summary (${allRatings.length} matches)\n`);

  // Aggregate per player
  const playerAgg = {};

  for (const match of allRatings) {
    for (const p of match.players) {
      if (!playerAgg[p.name]) {
        playerAgg[p.name] = {
          name: p.name,
          position: p.position,
          matches: 0,
          scores: [],
          criteriaScores: {},
        };
      }
      playerAgg[p.name].matches++;
      playerAgg[p.name].scores.push(p.weightedScore);

      for (const [key, val] of Object.entries(p.ratings)) {
        if (!playerAgg[p.name].criteriaScores[key]) {
          playerAgg[p.name].criteriaScores[key] = [];
        }
        playerAgg[p.name].criteriaScores[key].push(val);
      }
    }
  }

  // Calculate averages
  const players = Object.values(playerAgg).map(p => {
    const avgScore = mean(p.scores);
    const consistency = 5 - stdDev(p.scores); // Higher = more consistent
    const bestScore = Math.max(...p.scores);
    const worstScore = Math.min(...p.scores);

    const criteriaAvgs = {};
    for (const [key, vals] of Object.entries(p.criteriaScores)) {
      criteriaAvgs[key] = parseFloat(mean(vals).toFixed(2));
    }

    return {
      ...p,
      avgScore: parseFloat(avgScore.toFixed(2)),
      consistency: parseFloat(consistency.toFixed(2)),
      bestScore: parseFloat(bestScore.toFixed(2)),
      worstScore: parseFloat(worstScore.toFixed(2)),
      criteriaAvgs,
    };
  }).sort((a, b) => b.avgScore - a.avgScore);

  // Print table
  console.log('Player                    Pos  Matches  Avg   Best  Worst  Consistency');
  console.log('─'.repeat(85));

  for (const p of players) {
    const name = p.name.substring(0, 22).padEnd(22);
    const pos = p.position.substring(0, 4).padEnd(4);
    console.log(`${name}  ${pos}  ${String(p.matches).padStart(3)}     ${p.avgScore.toFixed(2)}  ${p.bestScore.toFixed(2)}  ${p.worstScore.toFixed(2)}    ${p.consistency.toFixed(2)}`);
  }

  // Season insights
  console.log('\n─ Season Insights ─');
  const topPresser = players.reduce((best, p) => 
    (p.criteriaAvgs.pressing || 0) > (best.criteriaAvgs.pressing || 0) ? p : best);
  const topVertical = players.reduce((best, p) =>
    (p.criteriaAvgs.verticality || 0) > (best.criteriaAvgs.verticality || 0) ? p : best);
  const mostConsistent = players.reduce((best, p) =>
    p.consistency > best.consistency ? p : best);

  console.log(`  Top Presser: ${topPresser.name} (${topPresser.criteriaAvgs.pressing?.toFixed(2)}/5)`);
  console.log(`  Most Vertical: ${topVertical.name} (${topVertical.criteriaAvgs.verticality?.toFixed(2)}/5)`);
  console.log(`  Most Consistent: ${mostConsistent.name} (consistency: ${mostConsistent.consistency.toFixed(2)})`);

  // Export for training data
  const exportPath = path.join(RATINGS_DIR, 'season_summary.json');
  writeJSON(exportPath, { generatedAt: new Date().toISOString(), players });
  log.info('ratings', 'Season summary exported', { path: exportPath });
}

async function playerHistory() {
  const playerName = process.argv.find(a => a.startsWith('--player='))?.split('=')[1];

  if (!playerName) {
    console.log('Usage: --player "Hartmann"');
    return;
  }

  if (!fileExists(RATINGS_FILE)) {
    console.log('No ratings data.');
    return;
  }

  const allRatings = readJSON(RATINGS_FILE);
  const history = [];

  for (const match of allRatings) {
    const player = match.players.find(p => p.name.toLowerCase().includes(playerName.toLowerCase()));
    if (player) {
      history.push({
        match: match.matchName,
        date: match.date,
        score: player.weightedScore,
        ratings: player.ratings,
        notes: player.notes,
      });
    }
  }

  if (history.length === 0) {
    console.log(`No ratings found for "${playerName}"`);
    return;
  }

  console.log(`\n${history[0].ratings ? history[0].ratings : 'Player'} History: ${playerName}`);
  console.log(`(${history.length} matches)\n`);

  for (const h of history) {
    const date = new Date(h.date).toLocaleDateString();
    console.log(`${date} — ${h.match}: ${h.score.toFixed(2)}/5.00`);
    if (h.notes) console.log(`  Notes: ${h.notes}`);
  }

  const scores = history.map(h => h.score);
  console.log(`\n  Average: ${mean(scores).toFixed(2)}`);
  console.log(`  Best: ${Math.max(...scores).toFixed(2)}`);
  console.log(`  Worst: ${Math.min(...scores).toFixed(2)}`);
}

async function matchDetail() {
  const matchName = process.argv.find(a => a.startsWith('--match='))?.split('=')[1];

  if (!matchName || !fileExists(RATINGS_FILE)) {
    console.log('Usage: --match "Hafen Rückrunde"');
    return;
  }

  const allRatings = readJSON(RATINGS_FILE);
  const match = allRatings.find(m => m.matchName.toLowerCase().includes(matchName.toLowerCase()));

  if (!match) {
    console.log(`Match "${matchName}" not found.`);
    return;
  }

  console.log(`\nMatch: ${match.matchName}`);
  console.log(`Date: ${new Date(match.date).toLocaleString()}\n`);

  for (const p of match.players) {
    console.log(`${p.name} (${p.position}) — ${p.weightedScore.toFixed(2)}/5.00`);
    for (const [key, val] of Object.entries(p.ratings)) {
      const criterion = RATING_CRITERIA[key];
      if (criterion) {
        console.log(`  ${key.padEnd(20)} ${val.toFixed(1)}/5  (${criterion.description})`);
      }
    }
    if (p.notes) console.log(`  Notes: ${p.notes}`);
    console.log();
  }
}

async function exportRatings() {
  const outputPath = process.argv.find(a => a.startsWith('--export='))?.split('=')[1] || 'ratings_export.json';
  if (!fileExists(RATINGS_FILE)) {
    console.log('No ratings data.');
    return;
  }
  const data = readJSON(RATINGS_FILE);
  writeJSON(outputPath, { exportedAt: new Date().toISOString(), matches: data.length, data });
  console.log(`✓ Exported ${data.length} matches to ${outputPath}`);
}

function printUsage() {
  console.log('MISTER — Player Ratings & Performance Tracker');
  console.log('');
  console.log('Usage:');
  console.log('  --add-match --match "Hafen Rückrunde" [--ratings file.json]');
  console.log('  --season                              Full season summary');
  console.log('  --player "Hartmann"                   Player match history');
  console.log('  --match "Hafen Rückrunde"             Detailed match report');
  console.log('  --export ratings.json                 Export all ratings');
  console.log('');
  console.log('Rating Criteria (based on club game model):');
  for (const [key, c] of Object.entries(RATING_CRITERIA)) {
    console.log(`  ${key.padEnd(20)} ${(c.weight * 100).toFixed(0)}%  ${c.description}`);
  }
}

module.exports = { RATING_CRITERIA, addMatchRatings, seasonSummary };

main().catch(err => {
  log.error('ratings', 'Player ratings error', { error: err.message });
  process.exit(1);
});

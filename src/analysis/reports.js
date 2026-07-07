/**
 * MISTER — Match Report & Season Summary Generator
 *
 * Generates structured reports after matches and a season summary
 * that can be saved, shared with staff, or fed back into training data.
 *
 * Usage:
 *   node src/analysis/reports.js --match m07                    Match report
 *   node src/analysis/reports.js --season                       Season summary
 *   node src/analysis/reports.js --match m07 --export reports/   Export to file
 *   node src/analysis/reports.js --season --html season.html     Export as HTML
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { readJSON, fileExists, writeJSON, ensureDir, mean, stdDev } = require('../utils/helpers');

const RESULTS_FILE = path.join(process.cwd(), 'data/opponents/results.json');
const RATINGS_FILE = path.join(process.cwd(), 'data/ratings/all_ratings.json');
const PLAYERS_FILE = path.join(process.cwd(), 'data/players.json');
const OPPONENTS_FILE = path.join(process.cwd(), 'data/opponents/opponents.json');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

/**
 * Generate a detailed match report.
 */
function generateMatchReport(matchId) {
  const results = fileExists(RESULTS_FILE) ? readJSON(RESULTS_FILE) : [];
  const ratings = fileExists(RATINGS_FILE) ? readJSON(RATINGS_FILE) : [];
  const players = fileExists(PLAYERS_FILE) ? readJSON(PLAYERS_FILE) : [];
  const opponents = fileExists(OPPONENTS_FILE) ? readJSON(OPPONENTS_FILE) : [];

  const match = results.find(r => r.id === matchId);
  if (!match) {
    console.error(`Match ${matchId} not found in results.json`);
    return null;
  }

  const opponent = opponents.find(o => o.name === match.opponent);
  const matchRatings = ratings.filter(r => r.match_id === matchId);
  const playerMap = new Map(players.map(p => [p.id, p]));

  // Player ratings for this match
  const playerPerformances = matchRatings
    .map(r => {
      const player = playerMap.get(r.player_id);
      if (!player) return null;
      return {
        name: player.name,
        pos: player.pos,
        number: player.number,
        overall: r.overall,
        ratings: r.ratings,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.overall - a.overall);

  // Top performer
  const topPerformer = playerPerformances[0];
  
  // Weakest performer
  const weakestPerformer = playerPerformances[playerPerformances.length - 1];

  // Team averages per criterion
  const criteriaAverages = {};
  if (matchRatings.length > 0) {
    const criteria = Object.keys(matchRatings[0].ratings);
    for (const c of criteria) {
      criteriaAverages[c] = round(mean(matchRatings.map(r => r.ratings[c])), 2);
    }
  }

  // Tactical analysis
  const tacticalAnalysis = {
    pressing: {
      success: match.pressing_success,
      assessment: match.pressing_success >= 65 ? 'Effective — first-touch pressure working' :
                  match.pressing_success >= 50 ? 'Moderate — press triggered but bypassed at times' :
                  'Ineffective — opponent played around the press',
    },
    transition: {
      avgSpeed: match.transition_speed_avg,
      assessment: match.transition_speed_avg <= 3.0 ? 'Sharp — two-touch rule followed' :
                  match.transition_speed_avg <= 4.0 ? 'Moderate — some recycling' :
                  'Slow — too much recycling, transition lock not firing',
    },
    flankOverload: {
      count: match.flank_overloads,
      assessment: match.flank_overloads >= 10 ? 'High utilization — primary weapon working' :
                  match.flank_overloads >= 6 ? 'Moderate — creating some 2v1s' :
                  'Low — flank overload not being created',
    },
    channelRuns: {
      count: match.channel_runs,
      assessment: match.channel_runs >= 6 ? 'Active — Hartmann peeling into channels regularly' :
                  match.channel_runs >= 3 ? 'Moderate — some channel runs' :
                  'Low — channel runs missing, pocket not opening for 10',
    },
  };

  // Key moments (from notes)
  const keyMoments = match.notes;

  return {
    matchId: match.id,
    date: match.date,
    opponent: match.opponent,
    venue: match.venue,
    result: match.result,
    score: match.score,
    xg: { for: match.xg_for, against: match.xg_against },
    possession: match.possession,
    shots: { total: match.shots, onTarget: match.shots_on_target },
    tacticalAnalysis,
    teamAverages: criteriaAverages,
    topPerformer: topPerformer ? {
      name: topPerformer.name,
      pos: topPerformer.pos,
      overall: topPerformer.overall,
      strengths: getTopCriteria(topPerformer.ratings, 2),
    } : null,
    weakestPerformer: weakestPerformer ? {
      name: weakestPerformer.name,
      pos: weakestPerformer.pos,
      overall: weakestPerformer.overall,
      weaknesses: getBottomCriteria(weakestPerformer.ratings, 2),
    } : null,
    playerPerformances,
    opponentInfo: opponent ? {
      style: opponent.style,
      weaknessesExploited: opponent.weaknesses.filter(w => match.notes.toLowerCase().includes(w.toLowerCase().split(' ')[0])),
    } : null,
    notes: match.notes,
    recommendations: generateMatchRecommendations(tacticalAnalysis, match),
  };
}

/**
 * Generate season summary report.
 */
function generateSeasonSummary() {
  const results = fileExists(RESULTS_FILE) ? readJSON(RESULTS_FILE) : [];
  const ratings = fileExists(RATINGS_FILE) ? readJSON(RATINGS_FILE) : [];
  const players = fileExists(PLAYERS_FILE) ? readJSON(PLAYERS_FILE) : [];
  const playerMap = new Map(players.map(p => [p.id, p]));

  if (results.length === 0) {
    console.log('No matches played yet.');
    return null;
  }

  const wins = results.filter(r => r.result === 'W').length;
  const draws = results.filter(r => r.result === 'D').length;
  const losses = results.filter(r => r.result === 'L').length;
  const goalsFor = results.reduce((sum, r) => sum + r.goals_for, 0);
  const goalsAgainst = results.reduce((sum, r) => sum + r.goals_against, 0);

  // Season averages
  const seasonAverages = {
    pressing: round(mean(results.map(r => r.pressing_success)), 1),
    transition: round(mean(results.map(r => r.transition_speed_avg)), 1),
    flankOverload: round(mean(results.map(r => r.flank_overloads)), 1),
    channelRuns: round(mean(results.map(r => r.channel_runs)), 1),
    possession: round(mean(results.map(r => r.possession)), 1),
    xgFor: round(mean(results.map(r => r.xg_for)), 2),
    xgAgainst: round(mean(results.map(r => r.xg_against)), 2),
  };

  // Player season averages
  const playerSeason = {};
  for (const r of ratings) {
    if (!playerSeason[r.player_id]) {
      playerSeason[r.player_id] = { ratings: [], overall: [] };
    }
    playerSeason[r.player_id].overall.push(r.overall);
    for (const [c, v] of Object.entries(r.ratings)) {
      if (!playerSeason[r.player_id].ratings[c]) playerSeason[r.player_id].ratings[c] = [];
      playerSeason[r.player_id].ratings[c].push(v);
    }
  }

  const playerSummary = Object.entries(playerSeason)
    .map(([pid, data]) => {
      const player = playerMap.get(pid);
      if (!player) return null;
      const avgOverall = round(mean(data.overall), 1);
      const consistency = round(stdDev(data.overall), 2);
      const criteriaAverages = {};
      for (const [c, values] of Object.entries(data.ratings)) {
        criteriaAverages[c] = round(mean(values), 1);
      }
      return {
        id: pid,
        name: player.name,
        pos: player.pos,
        number: player.number,
        matchesPlayed: data.overall.length,
        avgOverall,
        consistency, // lower = more consistent
        criteriaAverages,
        bestCriterion: getTopCriteria(criteriaAverages, 1)[0],
        worstCriterion: getBottomCriteria(criteriaAverages, 1)[0],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgOverall - a.avgOverall);

  // Opponent record
  const oppRecord = {};
  for (const r of results) {
    if (!oppRecord[r.opponent]) oppRecord[r.opponent] = { W: 0, D: 0, L: 0, goalsFor: 0, goalsAgainst: 0 };
    oppRecord[r.opponent][r.result]++;
    oppRecord[r.opponent].goalsFor += r.goals_for;
    oppRecord[r.opponent].goalsAgainst += r.goals_against;
  }

  // Trends (first half vs second half)
  const half = Math.floor(results.length / 2);
  const firstHalf = results.slice(0, half);
  const secondHalf = results.slice(half);
  const trends = {
    pressing: round(mean(secondHalf.map(r => r.pressing_success)) - mean(firstHalf.map(r => r.pressing_success)), 1),
    transition: round(mean(secondHalf.map(r => r.transition_speed_avg)) - mean(firstHalf.map(r => r.transition_speed_avg)), 1),
    flankOverload: round(mean(secondHalf.map(r => r.flank_overloads)) - mean(firstHalf.map(r => r.flank_overloads)), 1),
  };

  return {
    matches: results.length,
    record: { W: wins, D: draws, L: losses },
    goals: { for: goalsFor, against: goalsAgainst, diff: goalsFor - goalsAgainst },
    seasonAverages,
    trends: {
      pressing: trends.pressing > 0 ? `Improving (+${trends.pressing}%)` : `Declining (${trends.pressing}%)`,
      transition: trends.transition < 0 ? `Improving (${trends.transition}s faster)` : `Slowing (+${trends.transition}s)`,
      flankOverload: trends.flankOverload > 0 ? `Increasing (+${trends.flankOverload}/match)` : `Decreasing (${trends.flankOverload}/match)`,
    },
    playerSummary,
    opponentRecord: Object.entries(oppRecord).map(([name, rec]) => ({ opponent: name, ...rec })),
    bestPerformance: results.reduce((best, r) => 
      (r.result === 'W' && r.goals_for - r.goals_against > (best.goals_for - best.goals_against || 0)) ? r : best, results[0]),
    worstPerformance: results.reduce((worst, r) =>
      (r.result === 'L' && r.goals_against - r.goals_for > (worst.goals_against - worst.goals_for || 0)) ? r : worst, results[0]),
  };
}

// ── Helpers ──

function getTopCriteria(ratings, n) {
  return Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, score]) => ({ criterion: name.replace(/_/g, ' '), score }));
}

function getBottomCriteria(ratings, n) {
  return Object.entries(ratings)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([name, score]) => ({ criterion: name.replace(/_/g, ' '), score }));
}

function round(num, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(num * f) / f;
}

function generateMatchRecommendations(tactical, match) {
  const recs = [];
  
  if (tactical.pressing.success < 55) {
    recs.push('Pressing was ineffective. Review pressing trigger timing. Consider mid-block approach for similar opponents.');
  }
  if (tactical.transition.avgSpeed > 4.0) {
    recs.push('Transition lock not firing. Drill: two-touch finish scenarios in next session.');
  }
  if (tactical.flankOverload.count < 6) {
    recs.push('Flank overloads underutilized. Drill: right-side 2v1 pattern (Krüger-Wendt-Heil).');
  }
  if (tactical.channelRuns.count < 4) {
    recs.push('Channel runs missing. Hartmann needs to peel into the channel more often to open pockets for Wendt.');
  }
  if (match.result === 'W' && match.goals_for - match.goals_against >= 2) {
    recs.push('Dominant win. Maintain the same approach. No changes needed for next match.');
  }
  if (match.result === 'L') {
    recs.push('Loss — review footage and identify root cause. Check if the game model was followed or if adjustments are needed.');
  }
  
  return recs;
}

/**
 * Render match report as formatted text.
 */
function renderMatchReport(report) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  MATCH REPORT: ${report.date} — ${report.opponent} (${report.venue})`);
  lines.push(`  Result: ${report.result} ${report.score} | xG: ${report.xg.for} - ${report.xg.against} | Possession: ${report.possession}%`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  lines.push('TACTICAL ANALYSIS:');
  for (const [key, data] of Object.entries(report.tacticalAnalysis)) {
    lines.push(`  ${key.toUpperCase()}: ${data.assessment}`);
  }
  lines.push('');
  
  if (report.topPerformer) {
    lines.push(`TOP PERFORMER: ${report.topPerformer.name} (${report.topPerformer.pos}) — ${report.topPerformer.overall}/5`);
    lines.push(`  Strengths: ${report.topPerformer.strengths.map(s => `${s.criterion} (${s.score})`).join(', ')}`);
  }
  if (report.weakestPerformer) {
    lines.push(`NEEDS IMPROVEMENT: ${report.weakestPerformer.name} (${report.weakestPerformer.pos}) — ${report.weakestPerformer.overall}/5`);
    lines.push(`  Weaknesses: ${report.weakestPerformer.weaknesses.map(s => `${s.criterion} (${s.score})`).join(', ')}`);
  }
  lines.push('');
  
  lines.push('PLAYER RATINGS:');
  for (const p of report.playerPerformances) {
    lines.push(`  ${p.pos} ${p.name} (#${p.number}): ${p.overall}/5`);
  }
  lines.push('');
  
  lines.push('RECOMMENDATIONS:');
  for (const r of report.recommendations) {
    lines.push(`  → ${r}`);
  }
  lines.push('');
  lines.push(`NOTES: ${report.notes}`);
  
  return lines.join('\n');
}

/**
 * Render season summary as formatted text.
 */
function renderSeasonSummary(summary) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  SEASON SUMMARY — FC Metall Nord');
  lines.push(`  Record: ${summary.record.W}W ${summary.record.D}D ${summary.record.L}L | Goals: ${summary.goals.for}-${summary.goals.against} (${summary.goals.diff > 0 ? '+' : ''}${summary.goals.diff})`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  lines.push('SEASON AVERAGES:');
  lines.push(`  Pressing success: ${summary.seasonAverages.pressing}%`);
  lines.push(`  Transition speed: ${summary.seasonAverages.transition}s`);
  lines.push(`  Flank overloads: ${summary.seasonAverages.flankOverload}/match`);
  lines.push(`  Channel runs: ${summary.seasonAverages.channelRuns}/match`);
  lines.push(`  Possession: ${summary.seasonAverages.possession}%`);
  lines.push(`  xG: ${summary.seasonAverages.xgFor} for, ${summary.seasonAverages.xgAgainst} against`);
  lines.push('');
  
  lines.push('TRENDS (2nd half vs 1st half):');
  lines.push(`  Pressing: ${summary.trends.pressing}`);
  lines.push(`  Transition: ${summary.trends.transition}`);
  lines.push(`  Flank overload: ${summary.trends.flankOverload}`);
  lines.push('');
  
  lines.push('PLAYER RANKINGS (by avg overall):');
  for (const p of summary.playerSummary) {
    lines.push(`  ${p.pos} ${p.name} (#${p.number}): ${p.avgOverall}/5 (${p.matchesPlayed} matches, consistency: ${p.consistency})`);
    lines.push(`    Best: ${p.bestCriterion.criterion} (${p.bestCriterion.score}) | Worst: ${p.worstCriterion.criterion} (${p.worstCriterion.score})`);
  }
  lines.push('');
  
  lines.push('OPPONENT RECORD:');
  for (const o of summary.opponentRecord) {
    lines.push(`  ${o.opponent}: ${o.W}W ${o.D}D ${o.L}L (${o.goalsFor}-${o.goalsAgainst})`);
  }
  lines.push('');
  
  lines.push(`BEST PERFORMANCE: ${summary.bestPerformance.date} vs ${summary.bestPerformance.opponent} (${summary.bestPerformance.result} ${summary.bestPerformance.score})`);
  lines.push(`WORST PERFORMANCE: ${summary.worstPerformance.date} vs ${summary.worstPerformance.opponent} (${summary.worstPerformance.result} ${summary.worstPerformance.score})`);
  
  return lines.join('\n');
}

/**
 * Main CLI entry point.
 */
async function main() {
  const matchId = process.argv.find(a => a.startsWith('--match='))?.split('=')[1];
  const seasonMode = process.argv.includes('--season');
  const exportPath = process.argv.find(a => a.startsWith('--export='))?.split('=')[1];
  const htmlMode = process.argv.includes('--html');

  if (matchId) {
    const report = generateMatchReport(matchId);
    if (!report) return;
    console.log(renderMatchReport(report));
    if (exportPath) {
      ensureDir(exportPath);
      const filePath = path.join(exportPath, `match_${matchId}.json`);
      writeJSON(filePath, report);
      log.info('reports', 'Match report exported', { path: filePath });
    }
  } else if (seasonMode) {
    const summary = generateSeasonSummary();
    if (!summary) return;
    console.log(renderSeasonSummary(summary));
    if (exportPath) {
      ensureDir(exportPath);
      const filePath = path.join(exportPath, 'season_summary.json');
      writeJSON(filePath, summary);
      log.info('reports', 'Season summary exported', { path: filePath });
    }
  } else {
    console.log('Usage:');
    console.log('  node src/analysis/reports.js --match m07         Match report');
    console.log('  node src/analysis/reports.js --season            Season summary');
    console.log('  node src/analysis/reports.js --match m07 --export reports/');
  }
}

if (require.main === module) {
  main().catch(err => { log.error('reports', err.message); process.exit(1); });
}

module.exports = { generateMatchReport, generateSeasonSummary, renderMatchReport, renderSeasonSummary };

/**
 * MISTER — Tactical Suggestions Engine
 *
 * Analyzes match results, player ratings, and opponent data to generate
 * automatic tactical recommendations for the coaching staff.
 *
 * Usage:
 *   node src/analysis/suggestions.js                    All suggestions
 *   node src/analysis/suggestions.js --category pressing  Filter by category
 *   node src/analysis/suggestions.js --match m07          Suggestions after specific match
 *   node src/analysis/suggestions.js --export suggestions.json
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { readJSON, fileExists, writeJSON, mean } = require('../utils/helpers');

const RESULTS_FILE = path.join(process.cwd(), 'data/opponents/results.json');
const RATINGS_FILE = path.join(process.cwd(), 'data/ratings/all_ratings.json');
const PLAYERS_FILE = path.join(process.cwd(), 'data/players.json');
const OPPONENTS_FILE = path.join(process.cwd(), 'data/opponents/opponents.json');

/**
 * Generate all tactical suggestions based on available data.
 */
async function generateSuggestions() {
  const suggestions = [];

  // Load data
  const results = fileExists(RESULTS_FILE) ? readJSON(RESULTS_FILE) : [];
  const ratings = fileExists(RATINGS_FILE) ? readJSON(RATINGS_FILE) : [];
  const players = fileExists(PLAYERS_FILE) ? readJSON(PLAYERS_FILE) : [];
  const opponents = fileExists(OPPONENTS_FILE) ? readJSON(OPPONENTS_FILE) : [];

  if (results.length === 0) {
    console.log('No match results found. Play some matches first.');
    return [];
  }

  // ── 1. Pressing effectiveness trends ──
  suggestions.push(...analyzePressing(results));

  // ── 2. Transition speed analysis ──
  suggestions.push(...analyzeTransition(results));

  // ── 3. Flank overload utilization ──
  suggestions.push(...analyzeFlankOverload(results));

  // ── 4. Player performance alerts ──
  if (ratings.length > 0 && players.length > 0) {
    suggestions.push(...analyzePlayerTrends(ratings, players, results));
  }

  // ── 5. Opponent-specific preparation ──
  suggestions.push(...analyzeOpponentPrep(results, opponents));

  // ── 6. Build patience vs force it ──
  suggestions.push(...analyzeBuildPatience(results));

  // ── 7. Discipline & card risk ──
  suggestions.push(...analyzeDiscipline(results, ratings, players));

  // ── 8. Formation / shape adjustments ──
  suggestions.push(...analyzeShape(results));

  return suggestions;
}

/**
 * Pressing effectiveness over time.
 */
function analyzePressing(results) {
  const out = [];
  const recent = results.slice(-3);
  const avgPress = mean(recent.map(r => r.pressing_success));
  const trend = recent[recent.length - 1].pressing_success - recent[0].pressing_success;

  if (avgPress < 55) {
    out.push({
      id: 'sug-press-01',
      category: 'pressing',
      priority: 'high',
      title: 'Pressing effectiveness declining',
      detail: `Average pressing success in last 3 matches: ${avgPress.toFixed(0)}%. Target: 65%+. The opponent may have found a way to play around our first-touch pressure. Consider adjusting the pressing trigger — maybe delay the collapse by one beat to cut the second pass, not the first.`,
      evidence: recent.map(r => `${r.date} vs ${r.opponent}: ${r.pressing_success}%`),
      action: 'Adjust pressing trigger timing in next training session. Drill: 6v4 build-up disruption.',
    });
  } else if (trend > 10) {
    out.push({
      id: 'sug-press-02',
      category: 'pressing',
      priority: 'medium',
      title: 'Pressing improving — maintain intensity',
      detail: `Pressing success improved by ${trend.toFixed(0)}% over last 3 matches. The first-touch pressure is working. Maintain the intensity but watch for fatigue — pressing drops in the last 15 minutes.`,
      evidence: recent.map(r => `${r.date} vs ${r.opponent}: ${r.pressing_success}%`),
      action: 'Continue current pressing scheme. Add fitness focus for last-15-min intensity.',
    });
  }

  // Specific pressing failure
  const worstPress = results.reduce((min, r) => r.pressing_success < min.pressing_success ? r : min);
  if (worstPress.pressing_success < 45) {
    out.push({
      id: 'sug-press-03',
      category: 'pressing',
      priority: 'high',
      title: `Worst pressing game: vs ${worstPress.opponent}`,
      detail: `Pressing success was only ${worstPress.pressing_success}% against ${worstPress.opponent}. ${worstPress.notes}`,
      evidence: [`${worstPress.date}: ${worstPress.pressing_success}% pressing, ${worstPress.result} ${worstPress.score}`],
      action: `Review footage of ${worstPress.opponent} match. Identify how they beat the press — was it GK bypass, CB long balls, or midfielder dropping deep?`,
    });
  }

  return out;
}

/**
 * Transition speed analysis.
 */
function analyzeTransition(results) {
  const out = [];
  const recent = results.slice(-3);
  const avgTrans = mean(recent.map(r => r.transition_speed_avg));
  const target = 3.0; // seconds

  if (avgTrans > target + 1) {
    out.push({
      id: 'sug-trans-01',
      category: 'transition',
      priority: 'high',
      title: 'Transition lock not firing — too much recycling',
      detail: `Average transition speed: ${avgTrans.toFixed(1)}s (target: ≤${target}s). The two-touch rule is not being followed. Players are recycling possession instead of shooting or crossing within two touches of winning the ball.`,
      evidence: recent.map(r => `${r.date} vs ${r.opponent}: ${r.transition_speed_avg}s`),
      action: 'Drill: transition lock scenarios — win ball in opponent half, two touches max, shot or cross. 10 reps per session.',
    });
  } else if (avgTrans <= target) {
    out.push({
      id: 'sug-trans-02',
      category: 'transition',
      priority: 'low',
      title: 'Transition speed on target',
      detail: `Average transition speed: ${avgTrans.toFixed(1)}s — meeting the ≤${target}s target. The transition lock is working.`,
      evidence: recent.map(r => `${r.date} vs ${r.opponent}: ${r.transition_speed_avg}s`),
      action: 'Maintain current transition discipline. No changes needed.',
    });
  }

  return out;
}

/**
 * Flank overload utilization.
 */
function analyzeFlankOverload(results) {
  const out = [];
  const recent = results.slice(-3);
  const avgFlank = mean(recent.map(r => r.flank_overloads));
  const avgChannel = mean(recent.map(r => r.channel_runs));

  if (avgFlank < 6) {
    out.push({
      id: 'sug-flank-01',
      category: 'flank_overload',
      priority: 'medium',
      title: 'Flank overloads underutilized',
      detail: `Only ${avgFlank.toFixed(0)} flank overloads per match in last 3 games. Target: 10+. The right-wing 2v1 (Krüger pins, Wendt drifts, Heil underlaps) is our primary weapon — it's not being created.`,
      evidence: recent.map(r => `${r.date} vs ${r.opponent}: ${r.flank_overloads} overloads, ${r.channel_runs} channel runs`),
      action: 'Drill: right-side overload pattern — Krüger pins FB, Wendt drifts wide, Heil underlaps. 15 reps. Also check if Wendt is drifting too late.',
    });
  }

  if (avgChannel < 4) {
    out.push({
      id: 'sug-flank-02',
      category: 'flank_overload',
      priority: 'medium',
      title: 'Channel runs missing',
      detail: `Only ${avgChannel.toFixed(0)} channel runs per match. Hartmann should be peeling into the channel between CB and FB regularly — this drags a marker and opens the pocket for Wendt.`,
      evidence: recent.map(r => `${r.date} vs ${r.opponent}: ${r.channel_runs} channel runs`),
      action: 'Drill: Hartmann channel runs — CB receives, Hartmann peels into channel. 10 reps from both sides.',
    });
  }

  return out;
}

/**
 * Player performance trends — declining/improving players.
 */
function analyzePlayerTrends(ratings, players, results) {
  const out = [];
  const playerMap = new Map(players.map(p => [p.id, p]));

  // Group ratings by player
  const byPlayer = {};
  for (const r of ratings) {
    if (!byPlayer[r.player_id]) byPlayer[r.player_id] = [];
    byPlayer[r.player_id].push(r);
  }

  for (const [pid, playerRatings] of Object.entries(byPlayer)) {
    if (playerRatings.length < 3) continue;
    const player = playerMap.get(pid);
    if (!player) continue;

    const sorted = playerRatings.sort((a, b) => {
      const ma = results.find(m => m.id === a.match_id);
      const mb = results.find(m => m.id === b.match_id);
      return new Date(ma?.date || 0) - new Date(mb?.date || 0);
    });

    const recent3 = sorted.slice(-3);
    const prev3 = sorted.slice(-6, -3);
    
    if (prev3.length > 0) {
      const recentAvg = mean(recent3.map(r => r.overall));
      const prevAvg = mean(prev3.map(r => r.overall));
      const delta = recentAvg - prevAvg;

      if (delta < -0.3) {
        out.push({
          id: `sug-player-${pid}-decline`,
          category: 'player_performance',
          priority: 'high',
          title: `${player.name} (${player.pos}) — declining form`,
          detail: `${player.name}'s overall rating dropped ${Math.abs(delta).toFixed(1)} points (from ${prevAvg.toFixed(1)} to ${recentAvg.toFixed(1)}). Check: fitness, confidence, or tactical mismatch. Recent ratings: ${recent3.map(r => r.overall).join(', ')}.`,
          evidence: recent3.map((r, i) => `Match ${i+1}: overall ${r.overall}`),
          action: `1-on-1 with ${player.name}. Review footage. Consider rest or role adjustment. If pressing is the issue, adjust the pressing trigger to reduce his defensive load.`,
        });
      } else if (delta > 0.3) {
        out.push({
          id: `sug-player-${pid}-rise`,
          category: 'player_performance',
          priority: 'low',
          title: `${player.name} (${player.pos}) — improving form`,
          detail: `${player.name}'s overall rating improved ${delta.toFixed(1)} points (from ${prevAvg.toFixed(1)} to ${recentAvg.toFixed(1)}). Reward the form — keep him in the XI, consider giving more responsibility.`,
          evidence: recent3.map((r, i) => `Match ${i+1}: overall ${r.overall}`),
          action: `Maintain ${player.name} in the starting XI. Consider expanding his role — maybe give him set-piece responsibility or vice-captaincy.`,
        });
      }
    }

    // Check specific criteria weakness
    const lastRating = sorted[sorted.length - 1];
    for (const [criterion, value] of Object.entries(lastRating.ratings)) {
      if (value < 2.5) {
        out.push({
          id: `sug-player-${pid}-${criterion}`,
          category: 'player_performance',
          priority: 'medium',
          title: `${player.name} — weak ${criterion.replace(/_/g, ' ')}`,
          detail: `${player.name} scored ${value}/5 on ${criterion.replace(/_/g, ' ')} in the last match. This is below the acceptable threshold (2.5).`,
          evidence: [`Last match: ${criterion} = ${value}/5`],
          action: `Targeted drill for ${player.name}: ${criterion} focus. See training_profiles.json for drill suggestions.`,
        });
      }
    }
  }

  return out;
}

/**
 * Opponent-specific preparation suggestions.
 */
function analyzeOpponentPrep(results, opponents) {
  const out = [];

  // Group results by opponent
  const byOpp = {};
  for (const r of results) {
    if (!byOpp[r.opponent]) byOpp[r.opponent] = [];
    byOpp[r.opponent].push(r);
  }

  for (const [oppName, matches] of Object.entries(byOpp)) {
    const wins = matches.filter(m => m.result === 'W').length;
    const losses = matches.filter(m => m.result === 'L').length;
    const draws = matches.filter(m => m.result === 'D').length;
    const opp = opponents.find(o => o.name === oppName);

    if (losses > wins && matches.length >= 2) {
      out.push({
        id: `sug-opp-${oppName.replace(/\s/g, '-')}`,
        category: 'opponent_prep',
        priority: 'high',
        title: `${oppName} — losing record (${wins}W ${draws}D ${losses}L)`,
        detail: `We're losing more than winning against ${oppName}. ${opp ? `Their key strength: ${opp.strengths.join(', ')}.` : ''} ${matches[matches.length-1].notes}`,
        evidence: matches.map(m => `${m.date}: ${m.result} ${m.score} (${m.venue})`),
        action: `Priority preparation for next ${oppName} match. Focus on neutralizing their strengths: ${opp ? opp.strengths[0] : 'unknown'}. Review footage from ${matches[matches.length-1].date}.`,
      });
    }

    // Pressing success vs specific opponent
    const avgPressVsOpp = mean(matches.map(m => m.pressing_success));
    if (avgPressVsOpp < 50 && matches.length >= 2) {
      out.push({
        id: `sug-opp-press-${oppName.replace(/\s/g, '-')}`,
        category: 'opponent_prep',
        priority: 'medium',
        title: `Pressing fails against ${oppName}`,
        detail: `Average pressing success vs ${oppName}: ${avgPressVsOpp.toFixed(0)}%. They know how to play around our press. Need a different approach — maybe sit in a mid-block and counter instead.`,
        evidence: matches.map(m => `${m.date}: ${m.pressing_success}% pressing`),
        action: `Consider mid-block approach vs ${oppName}. Drill: compact block absorption + rapid transition. Abandon first-touch pressure for this opponent.`,
      });
    }
  }

  return out;
}

/**
 * Build patience vs forcing it.
 */
function analyzeBuildPatience(results) {
  const out = [];
  const forced = results.filter(r => r.notes && r.notes.toLowerCase().includes('force'));
  
  if (forced.length >= 2) {
    out.push({
      id: 'sug-build-01',
      category: 'build_patience',
      priority: 'medium',
      title: 'Recurring pattern: forcing it against deep blocks',
      detail: `${forced.length} matches where we forced the issue against a defensive block. The game model says: build patience — circulate, wait for the 6 to step, then play through. This principle is not being followed.`,
      evidence: forced.map(r => `${r.date} vs ${r.opponent}: ${r.notes.substring(0, 80)}`),
      action: 'Drill: build patience scenarios — 11v8 vs deep block. Must complete 8 passes before attacking. Teaches circulation and timing.',
    });
  }

  return out;
}

/**
 * Discipline and card risk.
 */
function analyzeDiscipline(results, ratings, players) {
  const out = [];
  
  // Check if any notes mention yellow cards
  const cardMatches = results.filter(r => r.notes && r.notes.toLowerCase().includes('yellow'));
  if (cardMatches.length > 0) {
    for (const m of cardMatches) {
      out.push({
        id: `sug-disc-${m.id}`,
        category: 'discipline',
        priority: 'medium',
        title: `Card risk in ${m.opponent} match`,
        detail: m.notes,
        evidence: [`${m.date}: ${m.result} ${m.score}`],
        action: 'If same player is at risk, prepare substitution plan. Keller as 6 backup at 60min. Adjust pressing to reduce foul risk.',
      });
    }
  }

  // Check discipline ratings
  if (ratings.length > 0 && players.length > 0) {
    const playerMap = new Map(players.map(p => [p.id, p]));
    const lowDiscipline = ratings.filter(r => r.ratings.discipline < 3.0);
    const seen = new Set();
    for (const r of lowDiscipline) {
      if (seen.has(r.player_id)) continue;
      seen.add(r.player_id);
      const player = playerMap.get(r.player_id);
      if (player) {
        out.push({
          id: `sug-disc-player-${r.player_id}`,
          category: 'discipline',
          priority: 'low',
          title: `${player.name} — discipline concern`,
          detail: `${player.name} had a discipline rating below 3.0 in match ${r.match_id}. He may be freelancing or ignoring the game model.`,
          evidence: [`Match ${r.match_id}: discipline = ${r.ratings.discipline}/5`],
          action: `Talk to ${player.name}. Review his positioning vs the game model. If it's creativity, channel it. If it's freelancing, tighten the role.`,
        });
      }
    }
  }

  return out;
}

/**
 * Shape and formation adjustments.
 */
function analyzeShape(results) {
  const out = [];
  const recent = results.slice(-3);
  const avgPoss = mean(recent.map(r => r.possession));
  
  if (avgPoss < 45) {
    out.push({
      id: 'sug-shape-01',
      category: 'shape',
      priority: 'medium',
      title: 'Low possession — consider shape adjustment',
      detail: `Average possession in last 3 matches: ${avgPoss.toFixed(0)}%. If we're intentionally playing direct (verticality), this is fine. But if we're losing the ball too often, consider a double pivot (4-2-3-1) for more control.`,
      evidence: recent.map(r => `${r.date}: ${r.possession}% possession, ${r.result}`),
      action: 'Assess: is low possession intentional (verticality) or a problem? If problem, drill: 4-2-3-1 double pivot in next session.',
    });
  }

  return out;
}

/**
 * Main CLI entry point.
 */
async function main() {
  const filter = process.argv.find(a => a.startsWith('--category='))?.split('=')[1];
  const matchFilter = process.argv.find(a => a.startsWith('--match='))?.split('=')[1];
  const exportPath = process.argv.find(a => a.startsWith('--export='))?.split('=')[1];

  log.info('suggestions', 'Generating tactical suggestions...');

  let suggestions = await generateSuggestions();

  if (filter) {
    suggestions = suggestions.filter(s => s.category === filter);
  }
  if (matchFilter) {
    suggestions = suggestions.filter(s => s.evidence.some(e => e.includes(matchFilter)));
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Print
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MISTER — Tactical Suggestions Engine');
  console.log(`  ${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} generated`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const s of suggestions) {
    const icon = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
    console.log(`${icon} [${s.category.toUpperCase()}] ${s.title}`);
    console.log(`   ${s.detail}`);
    console.log(`   → Action: ${s.action}`);
    console.log(`   Evidence: ${s.evidence.join(' | ')}`);
    console.log('');
  }

  if (exportPath) {
    writeJSON(exportPath, suggestions);
    log.info('suggestions', 'Exported', { path: exportPath, count: suggestions.length });
  }
}

if (require.main === module) {
  main().catch(err => { log.error('suggestions', err.message); process.exit(1); });
}

module.exports = { generateSuggestions };

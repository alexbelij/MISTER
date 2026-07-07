/**
 * MISTER — Eval Harness (BEFORE vs AFTER) — v8 FIXED (uses qvac_wrapper)
 * 
 * Uses qvac_wrapper.js for correct completion() API.
 * 
 * Usage: node src/eval/eval_harness.js [--adapter adapters/adapter.gguf] [--model Qwen3-1.7B]
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { readJSON, writeJSON, ensureDir, mean, timer, generateId } = require('../utils/helpers');

const MODEL = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || config.model.llm;
const ADAPTER = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1] || null;
const HOLDOUT_PATH = config.eval.holdoutPath;
const RESULTS_DIR = config.eval.resultsDir;

const CLUB_TERMS = [
  'pressing trigger', 'rest-defence', 'verticality', 'flank overload',
  'compact block', 'first touch pressure', 'channel run', 'switch isolation',
  'build patience', 'transition lock', 'metronome', 'sweeper-keeper',
  'green light', 'no recycling', '18-20m', 'compact', 'pin', 'underlap',
  'pocket', 'drift', 'isolation', '2v1', 'ball side', 'weak side'
];

const PRINCIPLES = [
  'press from the front', 'verticality forward first',
  'compact rest-defence 18-20m', 'flank overload 2v1',
  'transition speed two touches shot cross', 'trust 1v1 weak side',
  'metronome 6 always available', 'sweeper-keeper high line'
];

async function main() {
  log.info('eval', 'Eval harness starting', { model: MODEL, adapter: ADAPTER || 'none' });

  // Health check
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('eval', 'QVAC provider not running. See .env.example for setup.');
    process.exit(1);
  }

  // Load holdout
  if (!fs.existsSync(HOLDOUT_PATH)) {
    log.error('eval', 'Holdout not found', { path: HOLDOUT_PATH });
    process.exit(1);
  }
  const holdout = readJSON(HOLDOUT_PATH);
  log.info('eval', 'Holdout loaded', { count: holdout.length });

  // Load models using wrapper
  const baseModelId = await qvac.loadLLM(MODEL, { quantization: config.model.quantization });

  let adaptedModelId = null;
  if (ADAPTER && fs.existsSync(ADAPTER)) {
    adaptedModelId = await qvac.loadLLM(MODEL, { quantization: config.model.quantization, lora: ADAPTER });
  }

  const results = [];
  const t = timer();

  for (let i = 0; i < holdout.length; i++) {
    const item = holdout[i];
    log.info('eval', `Q${i + 1}/${holdout.length}`, { prompt: item.prompt.substring(0, 60) });

    // BEFORE: base model via wrapper
    const beforeText = await qvac.chat(baseModelId,
      [{ role: 'user', content: item.prompt }],
      { maxTokens: config.model.maxTokens, temperature: config.model.temperature }
    );

    // AFTER: adapted model
    let afterText = beforeText;
    if (adaptedModelId) {
      afterText = await qvac.chat(adaptedModelId,
        [{ role: 'user', content: item.prompt }],
        { maxTokens: config.model.maxTokens, temperature: config.model.temperature }
      );
    }

    // Score
    const beforeScores = scoreResponse(beforeText, item.reference);
    const afterScores = scoreResponse(afterText, item.reference);

    const result = {
      id: `eval_${i}`,
      prompt: item.prompt,
      tags: item.tags,
      reference: item.reference,
      before: { text: beforeText.substring(0, 500), ...beforeScores, total: beforeScores.total },
      after: { text: afterText.substring(0, 500), ...afterScores, total: afterScores.total },
      delta: {
        terminology: afterScores.terminology - beforeScores.terminology,
        principles: afterScores.principles - beforeScores.principles,
        styleMatch: afterScores.styleMatch - beforeScores.styleMatch,
        total: afterScores.total - beforeScores.total,
      }
    };
    results.push(result);

    log.info('eval', `Q${i + 1} delta`, {
      before: beforeScores.total.toFixed(2),
      after: afterScores.total.toFixed(2),
      delta: (afterScores.total - beforeScores.total).toFixed(2)
    });
  }

  // Aggregate
  const aggregate = {
    model: MODEL,
    adapter: ADAPTER || 'none',
    evaluatedAt: new Date().toISOString(),
    durationMs: t.elapsed(),
    questionsCount: holdout.length,
    beforeAvg: mean(results.map(r => r.before.total)),
    afterAvg: mean(results.map(r => r.after.total)),
    deltaAvg: mean(results.map(r => r.delta.total)),
    beforeTermAvg: mean(results.map(r => r.before.terminology)),
    afterTermAvg: mean(results.map(r => r.after.terminology)),
    deltaTermAvg: mean(results.map(r => r.delta.terminology)),
    beforePrincipleAvg: mean(results.map(r => r.before.principles)),
    afterPrincipleAvg: mean(results.map(r => r.after.principles)),
    deltaPrincipleAvg: mean(results.map(r => r.delta.principles)),
    beforeStyleAvg: mean(results.map(r => r.before.styleMatch)),
    afterStyleAvg: mean(results.map(r => r.after.styleMatch)),
    deltaStyleAvg: mean(results.map(r => r.delta.styleMatch)),
  };

  // Print delta table
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    EVAL DELTA TABLE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Metric              BEFORE    AFTER    DELTA');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Terminology         ${aggregate.beforeTermAvg.toFixed(2)}     ${aggregate.afterTermAvg.toFixed(2)}     ${aggregate.deltaTermAvg >= 0 ? '+' : ''}${aggregate.deltaTermAvg.toFixed(2)}`);
  console.log(`Principle Align     ${aggregate.beforePrincipleAvg.toFixed(2)}     ${aggregate.afterPrincipleAvg.toFixed(2)}     ${aggregate.deltaPrincipleAvg >= 0 ? '+' : ''}${aggregate.deltaPrincipleAvg.toFixed(2)}`);
  console.log(`Style Match         ${aggregate.beforeStyleAvg.toFixed(2)}     ${aggregate.afterStyleAvg.toFixed(2)}     ${aggregate.deltaStyleAvg >= 0 ? '+' : ''}${aggregate.deltaStyleAvg.toFixed(2)}`);
  console.log(`TOTAL               ${aggregate.beforeAvg.toFixed(2)}     ${aggregate.afterAvg.toFixed(2)}     ${aggregate.deltaAvg >= 0 ? '+' : ''}${aggregate.deltaAvg.toFixed(2)}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Verdict
  console.log();
  if (aggregate.deltaAvg > config.eval.goThreshold) {
    console.log('🟢 VERDICT: GO — Fine-tune shows visible improvement in club style.');
  } else if (aggregate.deltaAvg > config.eval.marginalThreshold) {
    console.log('🟡 VERDICT: MARGINAL — Consider more data or epochs.');
  } else {
    console.log('🔴 VERDICT: PIVOT — Switch to RAG + multi-agent fallback.');
  }

  // Save
  ensureDir(RESULTS_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeJSON(path.join(RESULTS_DIR, `eval_${ts}.json`), { aggregate, results });
  writeJSON(path.join(RESULTS_DIR, 'latest.json'), { aggregate, results });
  log.info('eval', 'Results saved', { duration: t.elapsedSeconds() + 's' });

  // Cleanup
  await qvac.unloadModel(baseModelId);
  if (adaptedModelId) await qvac.unloadModel(adaptedModelId);
}

function scoreResponse(text, reference) {
  const lower = text.toLowerCase();
  const lowerRef = reference.toLowerCase();

  const termsUsed = CLUB_TERMS.filter(term => lower.includes(term));
  const terminology = termsUsed.length / CLUB_TERMS.length;

  const principlesHit = PRINCIPLES.filter(p => {
    const keywords = p.split(/\s+/).filter(w => w.length > 3);
    return keywords.some(kw => lower.includes(kw));
  });
  const principles = principlesHit.length / PRINCIPLES.length;

  const textWords = new Set(lower.split(/\s+/).filter(w => w.length > 3));
  const refWords = new Set(lowerRef.split(/\s+/).filter(w => w.length > 3));
  const overlap = [...textWords].filter(w => refWords.has(w)).length;
  const styleMatch = overlap / Math.max(refWords.size, 1);

  const total = (terminology * 0.4) + (principles * 0.35) + (styleMatch * 0.25);

  return { terminology, principles, styleMatch, total };
}

main().catch(err => {
  log.error('eval', 'Error', { error: err.message });
  process.exit(1);
});

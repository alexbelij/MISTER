/**
 * MISTER — Enhanced Eval Harness — v5 FIXED
 * 
 * Uses qvac_wrapper.js: chat(), embed(), cosineSimilarity().
 * Three scoring layers: lexical + embedding cosine + LLM judge.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const rag = require('../inference/rag_engine');
const { readJSON, writeJSON, ensureDir, mean, stdDev, timer } = require('../utils/helpers');

const CLUB_TERMS = [
  'pressing trigger', 'rest-defence', 'verticality', 'flank overload',
  'compact block', 'first touch pressure', 'channel run', 'switch isolation',
  'build patience', 'transition lock', 'metronome', 'sweeper-keeper',
  'green light', 'no recycling', '18-20m', 'compact', 'pin', 'underlap',
  'pocket', 'drift', 'isolation', '2v1', 'ball side', 'weak side',
  'press from the front', 'forward first', 'sprint to position',
  'two touches', 'shot or cross', 'discipline over chasing'
];

const PRINCIPLES = [
  'press from the front', 'verticality forward first',
  'compact rest-defence 18-20m', 'flank overload 2v1',
  'transition speed two touches shot cross', 'trust 1v1 weak side',
  'metronome 6 always available', 'sweeper-keeper high line'
];

const LLM_JUDGE_RUBRIC = `Score this football coaching response 1-5 on each:
1. CLUB_VOICE: Uses FC Metall Nord terminology (pressing trigger, channel run, verticality, compact block, transition lock)?
2. TACTICAL_DEPTH: Specific tactical advice, not generic? Names players, patterns?
3. ACTIONABLE: Can a coach use this? Concrete?
4. PRINCIPLE_ALIGNMENT: Aligns with club principles (press, vertical, compact, overload, transition)?
5. COHERENCE: Logically structured?
Respond JSON: {"club_voice":X,"tactical_depth":X,"actionable":X,"principle_alignment":X,"coherence":X}`;

async function main() {
  const adapter = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
  const useLLMJudge = process.argv.includes('--llm-judge');
  const holdoutPath = config.eval.holdoutPath;
  const resultsDir = config.eval.resultsDir;

  log.info('eval', 'Enhanced eval v5', { adapter: adapter || 'none', llmJudge: useLLMJudge });

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) { log.error('eval', 'QVAC provider not running'); process.exit(1); }

  // --- Load holdout ---
  if (!fs.existsSync(holdoutPath)) { log.error('eval', 'Holdout not found', { path: holdoutPath }); process.exit(1); }
  const holdout = readJSON(holdoutPath);
  log.info('eval', 'Holdout loaded', { count: holdout.length });

  // --- Load models ---
  const baseModelId = await qvac.loadLLM(config.model.llm, { quantization: config.model.quantization });

  let adaptedModelId = null;
  if (adapter && fs.existsSync(adapter)) {
    adaptedModelId = await qvac.loadLLM(config.model.llm, { quantization: config.model.quantization, lora: adapter });
  }

  let judgeModelId = null;
  if (useLLMJudge) {
    judgeModelId = await qvac.loadLLM(config.eval.llmJudgeModel, { quantization: config.model.quantization });
  }

  // --- Pre-compute reference embeddings ---
  log.info('eval', 'Pre-computing reference embeddings');
  const refEmbeddings = [];
  for (const item of holdout) {
    refEmbeddings.push(await rag.getEmbedding(item.reference));
  }

  const results = [];
  const t = timer();

  for (let i = 0; i < holdout.length; i++) {
    const item = holdout[i];
    log.info('eval', `Q${i + 1}/${holdout.length}`, { prompt: item.prompt.substring(0, 60) });

    // BEFORE
    const beforeText = await qvac.chat(baseModelId,
      [{ role: 'user', content: item.prompt }],
      { maxTokens: config.model.maxTokens, temperature: config.model.temperature }
    );

    // AFTER
    let afterText = beforeText;
    if (adaptedModelId) {
      afterText = await qvac.chat(adaptedModelId,
        [{ role: 'user', content: item.prompt }],
        { maxTokens: config.model.maxTokens, temperature: config.model.temperature }
      );
    }

    // Layer 1: Lexical
    const beforeLex = lexicalScore(beforeText);
    const afterLex = lexicalScore(afterText);

    // Layer 2: Embedding cosine similarity
    let beforeSem = 0, afterSem = 0;
    if (refEmbeddings[i]) {
      const [beforeEmb, afterEmb] = await Promise.all([
        rag.getEmbedding(beforeText),
        rag.getEmbedding(afterText),
      ]);
      beforeSem = beforeEmb ? qvac.cosineSimilarity(beforeEmb, refEmbeddings[i]) : wordOverlap(beforeText, item.reference);
      afterSem = afterEmb ? qvac.cosineSimilarity(afterEmb, refEmbeddings[i]) : wordOverlap(afterText, item.reference);
    } else {
      beforeSem = wordOverlap(beforeText, item.reference);
      afterSem = wordOverlap(afterText, item.reference);
    }

    // Layer 3: LLM Judge
    let beforeJudge = null, afterJudge = null;
    if (judgeModelId) {
      beforeJudge = await llmJudge(judgeModelId, item.prompt, beforeText);
      afterJudge = await llmJudge(judgeModelId, item.prompt, afterText);
    }

    // Weighted total
    const w = config.eval.scoringWeights;
    const beforeTotal = (beforeLex.terminology * w.terminology) + (beforeLex.principles * w.principles) + (beforeSem * w.styleMatch);
    const afterTotal = (afterLex.terminology * w.terminology) + (afterLex.principles * w.principles) + (afterSem * w.styleMatch);

    results.push({
      id: `eval_${i}`, prompt: item.prompt, tags: item.tags,
      before: { text: beforeText.substring(0, 500), lexical: beforeLex, semantic: beforeSem, llmJudge: beforeJudge, total: beforeTotal },
      after: { text: afterText.substring(0, 500), lexical: afterLex, semantic: afterSem, llmJudge: afterJudge, total: afterTotal },
      delta: {
        terminology: afterLex.terminology - beforeLex.terminology,
        principles: afterLex.principles - beforeLex.principles,
        styleMatch: afterSem - beforeSem,
        total: afterTotal - beforeTotal,
      }
    });

    log.metric('eval', `q${i}_delta`, parseFloat((afterTotal - beforeTotal).toFixed(3)));
  }

  // --- Aggregate ---
  const aggregate = {
    model: config.model.llm, adapter: adapter || 'none',
    evaluatedAt: new Date().toISOString(), durationMs: t.elapsed(),
    questionsCount: holdout.length, llmJudgeUsed: useLLMJudge,
    semanticMethod: 'embedding_cosine_similarity',
    lexical: {
      beforeTerm: mean(results.map(r => r.before.lexical.terminology)),
      afterTerm: mean(results.map(r => r.after.lexical.terminology)),
      deltaTerm: mean(results.map(r => r.delta.terminology)),
      beforePrin: mean(results.map(r => r.before.lexical.principles)),
      afterPrin: mean(results.map(r => r.after.lexical.principles)),
      deltaPrin: mean(results.map(r => r.delta.principles)),
    },
    semantic: {
      before: mean(results.map(r => r.before.semantic)),
      after: mean(results.map(r => r.after.semantic)),
      delta: mean(results.map(r => r.delta.styleMatch)),
    },
    total: {
      before: mean(results.map(r => r.before.total)),
      after: mean(results.map(r => r.after.total)),
      delta: mean(results.map(r => r.delta.total)),
    },
    stdDev: { before: stdDev(results.map(r => r.before.total)), after: stdDev(results.map(r => r.after.total)) },
  };

  // --- Print ---
  printResults(aggregate, results, useLLMJudge);

  // --- Save ---
  ensureDir(resultsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeJSON(path.join(resultsDir, `enhanced_eval_${ts}.json`), { aggregate, results });
  writeJSON(path.join(resultsDir, 'enhanced_latest.json'), { aggregate, results });

  // --- Cleanup ---
  await qvac.unloadModel(baseModelId);
  if (adaptedModelId) await qvac.unloadModel(adaptedModelId);
  if (judgeModelId) await qvac.unloadModel(judgeModelId);

  log.info('eval', 'Complete', { duration: t.elapsedSeconds() + 's', delta: aggregate.total.delta.toFixed(3) });
}

function lexicalScore(text) {
  const lower = text.toLowerCase();
  const termsUsed = CLUB_TERMS.filter(t => lower.includes(t));
  const terminology = termsUsed.length / CLUB_TERMS.length;
  const principlesHit = PRINCIPLES.filter(p => p.split(/\s+/).filter(w => w.length > 3).some(kw => lower.includes(kw)));
  const principles = principlesHit.length / PRINCIPLES.length;
  return { terminology, principles, termsUsed, principlesHit };
}

function wordOverlap(textA, textB) {
  const a = new Set(textA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const b = new Set(textB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  return [...a].filter(w => b.has(w)).length / Math.max(b.size, 1);
}

async function llmJudge(modelId, prompt, response) {
  try {
    const text = await qvac.chat(modelId, [
      { role: 'system', content: LLM_JUDGE_RUBRIC },
      { role: 'user', content: `Question: ${prompt}\n\nResponse: ${response}\n\nScore:` }
    ], { maxTokens: 200, temperature: 0.3 });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { return null; }
}

function printResults(agg, results, useLLMJudge) {
  const fmt = (v) => v.toFixed(2).padStart(6);
  const fmtD = (v) => (v >= 0 ? '+' : '') + v.toFixed(2).padStart(5);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ENHANCED EVAL DELTA TABLE (v5)                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Semantic: Embedding Cosine Similarity (QVAC embed())        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║ Metric              BEFORE    AFTER    DELTA                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ Terminology         ${fmt(agg.lexical.beforeTerm)}   ${fmt(agg.lexical.afterTerm)}   ${fmtD(agg.lexical.deltaTerm)}                  ║`);
  console.log(`║ Principle Align     ${fmt(agg.lexical.beforePrin)}   ${fmt(agg.lexical.afterPrin)}   ${fmtD(agg.lexical.deltaPrin)}                  ║`);
  console.log(`║ Style Match (embed) ${fmt(agg.semantic.before)}   ${fmt(agg.semantic.after)}   ${fmtD(agg.semantic.delta)}                  ║`);
  console.log(`║ TOTAL               ${fmt(agg.total.before)}   ${fmt(agg.total.after)}   ${fmtD(agg.total.delta)}                  ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ Std Dev             ${fmt(agg.stdDev.before)}   ${fmt(agg.stdDev.after)}                              ║`);
  console.log(`║ Duration            ${(agg.durationMs / 1000).toFixed(1)}s${' '.repeat(52 - (agg.durationMs / 1000).toFixed(1).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  console.log();
  if (agg.total.delta > config.eval.goThreshold) console.log('🟢 VERDICT: GO — Fine-tune shows visible improvement');
  else if (agg.total.delta > config.eval.marginalThreshold) console.log('🟡 VERDICT: MARGINAL — More data/epochs needed');
  else console.log('🔴 VERDICT: PIVOT — Switch to RAG + multi-agent fallback');

  console.log('\nPer-Question:');
  console.log('─'.repeat(70));
  for (const r of results) {
    const d = r.delta.total >= 0 ? '+' : '';
    console.log(`  Q${r.id.split('_')[1]}: ${d}${r.delta.total.toFixed(3)} | ${r.prompt.substring(0, 50)}...`);
  }
}

main().catch(err => { log.error('eval', 'Error', { error: err.message }); process.exit(1); });

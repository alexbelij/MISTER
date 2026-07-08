/**
 * MISTER — Fine-tuning Script (QVAC Fabric) — v5 FIXED
 * 
 * Uses qvac_wrapper.js for correct API calls.
 * Supports: loadLLM, finetuneRun, finetuneState, finetuneSuspend, finetuneResume, finetuneCancel
 * 
 * Usage: node src/finetune/finetune.js [--model Qwen3-1.7B] [--epochs 3] [--profile gate]
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { ensureDir, readJSON, fileExists, writeJSON, generateId, timer } = require('../utils/helpers');

// Supports both `--flag=value` and `--flag value` forms (npm run scripts in this repo use the
// space-separated form, e.g. `--profile gate`, which the old `--flag=` startsWith check silently
// ignored — it always fell through to the 'standard' default regardless of which npm script
// (finetune:gate / finetune:deep) was invoked. Fixed 2026-07-08 after a Kaggle GATE run silently
// trained with the heavier 'standard' profile instead of the intended 'gate' profile.
function argValue(flag) {
  const argv = process.argv;
  const eq = argv.find(a => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  return undefined;
}

const MODEL = argValue('--model') || config.model.llm;
const EPOCHS = parseInt(argValue('--epochs') || '0') || config.finetune.defaultEpochs;
const PROFILE = argValue('--profile') || 'standard';
const DATA_DIR = argValue('--data') || config.paths.processed;
const OUTPUT_DIR = config.finetune.outputDir;
// RETRY-ON-CRASH (2026-07-08): --retry-on-crash makes finetune() survive the
// native `@qvac/sdk` worker SIGABRT crash we hit repeatedly on Kaggle P100 GPUs
// (see docs/gate_finetune_run_log.md). On crash we re-invoke finetuneRun with
// `resume: true` (QVAC's operation: 'resume'), which continues from the last
// checkpoint written to checkpointSaveDir instead of losing all progress and
// restarting cold. Capped at MAX_RETRIES attempts (first attempt + retries).
const RETRY_ON_CRASH = process.argv.includes('--retry-on-crash');
const MAX_RETRIES = parseInt(argValue('--max-retries') || '4');
function isWorkerCrash(err) {
  const msg = (err && (err.message || err.toString())) || '';
  return /WORKER_CRASHED|SIGABRT|Bare worker exited/i.test(msg);
}

async function main() {
  const t = timer();
  log.info('finetune', 'Starting MISTER fine-tuning v5', {
    model: MODEL, epochs: EPOCHS, profile: PROFILE, data: DATA_DIR
  });

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('finetune', 'QVAC provider not running. Start it first.');
    log.info('finetune', 'Try: qvac.startQVACProvider() or run the QVAC provider separately.');
    process.exit(1);
  }

  // --- Load training profile ---
  let trainingConfig = { ...config.finetune, epochs: EPOCHS };
  if (PROFILE !== 'custom') {
    try {
      const { getProfile } = require('../utils/config');
      trainingConfig = getProfile(PROFILE);
      log.info('finetune', 'Profile loaded', { profile: PROFILE, epochs: trainingConfig.epochs });
    } catch (e) {
      log.warn('finetune', 'Profile not found, using defaults', { profile: PROFILE });
    }
  }

  // --- Load data ---
  const sftTrainPath = path.join(DATA_DIR, 'sft_train.jsonl');
  const causalPath = path.join(DATA_DIR, 'causal_corpus.jsonl');

  if (!fileExists(sftTrainPath)) {
    log.error('finetune', 'SFT train data not found', { path: sftTrainPath, hint: 'Run: npm run prepare' });
    process.exit(1);
  }

  let sftData = fs.readFileSync(sftTrainPath, 'utf-8').trim().split('\n').filter(l => l.trim()).map(JSON.parse);
  log.info('finetune', 'SFT pairs loaded', { count: sftData.length });

  // BUGFIX (2026-07-08, gate_micro run): every training profile in
  // config/training_profiles.json defines `maxSFTPairs` (e.g. gate_micro=20),
  // but this script never actually applied it — the full dataset on disk was
  // always used regardless of profile, so `gate_micro` trained on the same
  // 93 pairs as `gate`/`standard` and gave the native worker crash no fewer
  // reps to survive. Slice here so the profile's dataset-size knob actually works.
  if (trainingConfig.maxSFTPairs && sftData.length > trainingConfig.maxSFTPairs) {
    log.info('finetune', 'Truncating SFT pairs to profile maxSFTPairs', {
      before: sftData.length, after: trainingConfig.maxSFTPairs,
    });
    sftData = sftData.slice(0, trainingConfig.maxSFTPairs);
  }

  let causalData = [];
  if (fileExists(causalPath)) {
    causalData = fs.readFileSync(causalPath, 'utf-8').trim().split('\n').filter(l => l.trim()).map(JSON.parse);
    log.info('finetune', 'Causal corpus loaded', { count: causalData.length });
    if (trainingConfig.maxSFTPairs && causalData.length > trainingConfig.maxSFTPairs) {
      causalData = causalData.slice(0, trainingConfig.maxSFTPairs);
    }
  }

  // --- Load model using wrapper ---
  let modelId = await qvac.loadLLM(MODEL, {
    quantization: config.model.quantization,
    ctxSize: 2048,
  });

  // --- Get model info ---
  const loadedInfo = await qvac.getLoadedModelInfo(modelId);
  if (loadedInfo) {
    log.info('finetune', 'Model info', {
      type: loadedInfo.modelType,
      handlers: loadedInfo.handlers,
      isDelegated: loadedInfo.isDelegated,
    });
  }

  const catalogInfo = await qvac.getCatalogInfo(config.model.llmCatalogName);
  if (catalogInfo) {
    log.info('finetune', 'Catalog info', { model: MODEL, cacheState: catalogInfo.cacheState });
  }

  // --- Prepare finetune params ---
  ensureDir(OUTPUT_DIR);
  ensureDir(path.join(OUTPUT_DIR, 'checkpoints'));

  const finetuneParams = {
    sft: {
      dataset: sftData,
      assistantLossOnly: trainingConfig.assistantLossOnly,
      epochs: trainingConfig.epochs,
      learningRate: trainingConfig.learningRate,
      loraModules: trainingConfig.loraModules,
    },
    causal: {
      dataset: causalData.map(d => ({ text: d.text })),
      epochs: trainingConfig.causalEpochs || 1,
      learningRate: trainingConfig.causalLearningRate || 5e-5,
    },
    evalSplit: trainingConfig.evalSplit,
    // BUGFIX (2026-07-08, gate_micro run): qvac_wrapper.finetuneRun() reads
    // params.batchSize/params.microBatchSize top-level, but this object never
    // set them, so profile-level batchSize/microBatchSize (e.g. gate_micro's
    // batchSize:1) were silently dropped and had zero effect on the actual run.
    batchSize: trainingConfig.batchSize,
    microBatchSize: trainingConfig.microBatchSize,
    checkpoints: {
      enabled: true,
      dir: path.join(OUTPUT_DIR, 'checkpoints'),
      everyNEpochs: trainingConfig.checkpointEveryNEpochs,
    },
    output: {
      dir: OUTPUT_DIR,
      format: trainingConfig.outputFormat,
      name: 'mister_adapter',
    },
  };

  // --- Run finetune using wrapper ---
  log.info('finetune', 'Starting fine-tuning', {
    sftPairs: sftData.length,
    causalDocs: causalData.length,
    epochs: trainingConfig.epochs,
  });

  const onProgress = (progress) => {
    const { epoch, step, totalSteps, loss, percent } = progress;
    if (step !== undefined && (step % 10 === 0 || step === totalSteps)) {
      log.info('finetune', 'Progress', {
        epoch: epoch || '?', step, total: totalSteps || '?',
        loss: loss ? loss.toFixed(4) : 'N/A',
        percent: percent ? percent.toFixed(1) + '%' : 'N/A',
      });
    }
  };

  let result;
  let attempt = 0;
  let resume = false;
  while (true) {
    attempt += 1;
    try {
      result = await qvac.finetuneRun(modelId, { ...finetuneParams, resume }, onProgress);
      if (attempt > 1) {
        log.info('finetune', 'Recovered after native worker crash', { attempt, resumed: resume });
      }
      break;
    } catch (err) {
      // A native worker SIGABRT kills the entire bare RPC worker process, which
      // also invalidates any modelId that was loaded against it (the registry
      // dies with the worker) — a plain retry with the same modelId fails with
      // MODEL_NOT_FOUND (confirmed on Kaggle kernel v4, 2026-07-08). We detect
      // that as its own recoverable case and reload the model fresh before
      // the next finetuneRun attempt.
      const modelLost = /MODEL_NOT_FOUND|not found/i.test(err.message || '');
      const crashed = isWorkerCrash(err) || modelLost;
      log.error('finetune', 'finetuneRun attempt failed', {
        attempt, crashed, modelLost, error: err.message,
      });
      if (!RETRY_ON_CRASH || !crashed || attempt > MAX_RETRIES) {
        throw err;
      }
      // If a checkpoint dir already has content, resume from it next attempt;
      // otherwise restart cold (nothing to resume from yet).
      const ckptDir = path.join(OUTPUT_DIR, 'checkpoints');
      resume = fileExists(ckptDir) && fs.readdirSync(ckptDir).length > 0;
      const backoffMs = 3000 * attempt;
      log.warn('finetune', 'Retrying after native worker crash', {
        nextAttempt: attempt + 1, resume, backoffMs,
      });
      await new Promise(r => setTimeout(r, backoffMs));
      // Reload the model to get a fresh modelId bound to a live worker before
      // the next attempt — the crashed worker's modelId is no longer valid.
      try {
        modelId = await qvac.loadLLM(MODEL, {
          quantization: config.model.quantization,
          ctxSize: 2048,
        });
        log.info('finetune', 'Reloaded model after crash', { modelId });
      } catch (reloadErr) {
        log.error('finetune', 'Model reload after crash failed', { error: reloadErr.message });
        throw err;
      }
    }
  }

  // --- Result ---
  const adapterPath = result.adapterPath || result.path || path.join(OUTPUT_DIR, 'adapter.gguf');
  const adapterSize = result.adapterSize || (fileExists(adapterPath) ? fs.statSync(adapterPath).size : 0);
  const finalLoss = result.finalLoss || result.loss;
  const trainingTime = t.elapsed();

  log.info('finetune', 'Fine-tuning complete!', {
    adapterPath,
    adapterSize: (adapterSize / 1024 / 1024).toFixed(1) + ' MB',
    finalLoss: finalLoss ? finalLoss.toFixed(4) : 'N/A',
    trainingTime: (trainingTime / 60000).toFixed(1) + ' min',
  });

  log.metric('finetune', 'final_loss', finalLoss || 0);
  log.metric('finetune', 'training_time_ms', trainingTime);
  log.metric('finetune', 'adapter_size_bytes', adapterSize);

  // --- Save adapter metadata ---
  const adapterMeta = {
    id: generateId('adapter'),
    model: MODEL,
    adapterPath,
    adapterSize,
    finalLoss,
    trainingTime,
    epochs: trainingConfig.epochs,
    sftPairs: sftData.length,
    causalDocs: causalData.length,
    trainedAt: new Date().toISOString(),
    profile: PROFILE,
    quantization: config.model.quantization,
    version: '5.0.0',
  };
  writeJSON(path.join(OUTPUT_DIR, 'adapter_meta.json'), adapterMeta);

  // --- Unload model ---
  await qvac.unloadModel(modelId);

  // --- Summary ---
  console.log('\n═══════════════════════════════════════');
  console.log('  Fine-tuning complete!');
  console.log('═══════════════════════════════════════');
  console.log(`  Adapter: ${adapterPath}`);
  console.log(`  Size: ${(adapterSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Final loss: ${finalLoss ? finalLoss.toFixed(4) : 'N/A'}`);
  console.log(`  Training time: ${(trainingTime / 60000).toFixed(1)} min`);
  console.log(`  Profile: ${PROFILE}`);
  console.log('');
  console.log('  Next: Run eval');
  console.log(`  npm run eval -- --adapter ${adapterPath}`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  log.error('finetune', 'Error', { error: err.message, stack: err.stack });
  process.exit(1);
});

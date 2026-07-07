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

const MODEL = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || config.model.llm;
const EPOCHS = parseInt(process.argv.find(a => a.startsWith('--epochs='))?.split('=')[1] || '0') || config.finetune.defaultEpochs;
const PROFILE = process.argv.find(a => a.startsWith('--profile='))?.split('=')[1] || 'standard';
const DATA_DIR = process.argv.find(a => a.startsWith('--data='))?.split('=')[1] || config.paths.processed;
const OUTPUT_DIR = config.finetune.outputDir;

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

  const sftData = fs.readFileSync(sftTrainPath, 'utf-8').trim().split('\n').filter(l => l.trim()).map(JSON.parse);
  log.info('finetune', 'SFT pairs loaded', { count: sftData.length });

  let causalData = [];
  if (fileExists(causalPath)) {
    causalData = fs.readFileSync(causalPath, 'utf-8').trim().split('\n').filter(l => l.trim()).map(JSON.parse);
    log.info('finetune', 'Causal corpus loaded', { count: causalData.length });
  }

  // --- Load model using wrapper ---
  const modelId = await qvac.loadLLM(MODEL, {
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

  const catalogInfo = await qvac.getCatalogInfo(MODEL);
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

  const result = await qvac.finetuneRun(modelId, finetuneParams, (progress) => {
    const { epoch, step, totalSteps, loss, percent } = progress;
    if (step !== undefined && (step % 10 === 0 || step === totalSteps)) {
      log.info('finetune', 'Progress', {
        epoch: epoch || '?', step, total: totalSteps || '?',
        loss: loss ? loss.toFixed(4) : 'N/A',
        percent: percent ? percent.toFixed(1) + '%' : 'N/A',
      });
    }
  });

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

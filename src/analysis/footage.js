/**
 * MISTER — Footage Analysis — v8 FIXED (no duplicate functions)
 * 
 * Uses qvac_wrapper.js: describeImage() (VLM through completion), upscaleImage().
 * 
 * Usage:
 *   node src/analysis/footage.js --image frame.jpg [--adapter adapters/adapter.gguf]
 *   node src/analysis/footage.js --batch images/ --output analysis.json
 *   node src/analysis/footage.js --image frame.jpg --upscale
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { ensureDir, writeJSON, fileExists, generateId } = require('../utils/helpers');

const ANALYSIS_PROMPTS = {
  formation: 'What formation is the team in blue playing? Describe the shape and player positions.',
  pressing: 'Is the team pressing high? Describe the pressing intensity and which players are pressing.',
  space: 'Where is the space on the field? Which areas are open for exploitation?',
  transition: 'Is this a transition moment? Who won the ball and what is the immediate attacking opportunity?',
  defensive_shape: 'Describe the defensive block. Are the lines compact? What is the distance between defensive lines?',
  flank_overload: 'Is there a flank overload? Are there 2v1 or 3v2 situations on either wing?',
  channel_run: 'Is there a channel run? Is a striker peeling into the channel between CB and FB?',
  comprehensive: 'Analyze this football frame tactically. Describe: formation, pressing intensity, space, key patterns, and what the team in possession should do next.',
};

async function main() {
  const imagePath = process.argv.find(a => a.startsWith('--image='))?.split('=')[1];
  const batchDir = process.argv.find(a => a.startsWith('--batch='))?.split('=')[1];
  const analysisType = process.argv.find(a => a.startsWith('--type='))?.split('=')[1] || 'comprehensive';
  const adapter = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
  const outputPath = process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || 'analysis/footage_analysis.json';
  const doUpscale = process.argv.includes('--upscale');

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('footage', 'QVAC provider not running. See .env.example for setup.');
    process.exit(1);
  }

  // --- Load VLM model ---
  const vlmModelId = await qvac.loadVLM(config.model.vlm);
  log.info('footage', 'VLM loaded');

  // --- Optional: load LLM for club interpretation ---
  let llmModelId = null;
  if (adapter && fileExists(adapter)) {
    llmModelId = await qvac.loadLLM(config.model.llm, {
      quantization: config.model.quantization,
      lora: adapter,
    });
    log.info('footage', 'LLM loaded with adapter for club interpretation');
  }

  // --- Optional: load diffusion model for upscaling ---
  let diffusionModelId = null;
  if (doUpscale) {
    try {
      diffusionModelId = await qvac.loadDiffusion();
      log.info('footage', 'Diffusion model loaded for upscaling');
    } catch (e) {
      log.warn('footage', 'Could not load diffusion model', { error: e.message });
    }
  }

  const results = [];

  // --- Single image ---
  if (imagePath && fileExists(imagePath)) {
    const result = await analyzeImage(vlmModelId, llmModelId, diffusionModelId, imagePath, analysisType);
    results.push(result);
    printResult(result);
  }

  // --- Batch ---
  if (batchDir && fileExists(batchDir)) {
    const images = fs.readdirSync(batchDir)
      .filter(f => /\.(jpg|jpeg|png|bmp)$/i.test(f))
      .map(f => path.join(batchDir, f));
    log.info('footage', 'Batch analysis', { count: images.length });
    for (const image of images) {
      const result = await analyzeImage(vlmModelId, llmModelId, diffusionModelId, image, analysisType);
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.error('Usage: node src/analysis/footage.js --image <file.jpg> [--type comprehensive] [--upscale] [--adapter <path>]');
    process.exit(1);
  }

  // --- Save ---
  ensureDir(path.dirname(outputPath));
  writeJSON(outputPath, {
    analyzedAt: new Date().toISOString(),
    vlmModel: config.model.vlm,
    adapterUsed: !!adapter,
    analyses: results,
  });
  log.info('footage', 'All analyses saved', { path: outputPath, count: results.length });
  console.log(`\n✓ ${results.length} analyses saved to ${outputPath}`);

  // --- Cleanup ---
  await qvac.unloadModel(vlmModelId);
  if (llmModelId) await qvac.unloadModel(llmModelId);
  if (diffusionModelId) await qvac.unloadModel(diffusionModelId);
}

/**
 * Analyze a single image using VLM through completion().
 */
async function analyzeImage(vlmModelId, llmModelId, diffusionModelId, imagePath, analysisType) {
  let imageData = fs.readFileSync(imagePath);
  const prompt = ANALYSIS_PROMPTS[analysisType] || ANALYSIS_PROMPTS.comprehensive;

  log.info('footage', 'Analyzing', { image: imagePath, type: analysisType });

  // --- Optional: upscale ---
  if (diffusionModelId) {
    try {
      imageData = await qvac.upscaleImage(diffusionModelId, imageData, 2);
      log.info('footage', 'Image upscaled');
    } catch (e) {
      log.warn('footage', 'Upscale failed, using original', { error: e.message });
    }
  }

  // --- Describe image using VLM through completion() ---
  const visualObservation = await qvac.describeImage(vlmModelId, imageData,
    prompt + ' Respond in tactical language. Use terms like pressing trigger, channel run, compact block, flank overload, transition lock if applicable.',
    { maxTokens: 300, temperature: 0.5 }
  );

  // --- Club interpretation using LLM with adapter ---
  let clubInterpretation = visualObservation;
  if (llmModelId) {
    try {
      const history = [
        { role: 'system', content: 'You are the club brain for FC Metall Nord. Interpret visual analysis through our game model: verticality, pressing from the front, compact rest-defence, flank overloads, transition lock.' },
        { role: 'user', content: `Visual analysis: ${visualObservation}\n\nWhat does this mean for FC Metall Nord?` }
      ];
      clubInterpretation = await qvac.chat(llmModelId, history, { maxTokens: 400, temperature: 0.6 });
    } catch (e) {
      log.warn('footage', 'Club interpretation failed', { error: e.message });
    }
  }

  return {
    id: generateId('analysis'),
    image: imagePath,
    analysisType,
    visualObservation,
    clubInterpretation,
    upscaled: !!diffusionModelId,
    timestamp: new Date().toISOString(),
  };
}

function printResult(result) {
  console.log(`\n✓ Analysis: ${result.image}`);
  console.log(`  Visual: ${result.visualObservation.substring(0, 200)}...`);
  if (result.clubInterpretation !== result.visualObservation) {
    console.log(`  Club: ${result.clubInterpretation.substring(0, 200)}...`);
  }
}

main().catch(err => {
  log.error('footage', 'Error', { error: err.message });
  process.exit(1);
});

/**
 * MISTER — OCR for Handwritten Notes — v5 FIXED
 * 
 * Uses qvac_wrapper.js: ocrImage() with correct blocks API.
 * Fallback: describeImage() through VLM completion.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { ensureDir, writeJSON, fileExists, generateId } = require('../utils/helpers');

async function main() {
  const imagePath = process.argv.find(a => a.startsWith('--image='))?.split('=')[1];
  const batchDir = process.argv.find(a => a.startsWith('--batch='))?.split('=')[1];
  const outputPath = process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || 'data/ocr_output.json';
  const toSFT = process.argv.includes('--to-sft');

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) { log.error('ocr', 'QVAC provider not running'); process.exit(1); }

  // --- Load VLM model (for OCR and fallback) ---
  const modelId = await qvac.loadVLM(config.model.vlm);
  log.info('ocr', 'VLM model loaded');

  const results = [];

  if (imagePath && fileExists(imagePath)) {
    const result = await processNote(modelId, imagePath);
    results.push(result);
    console.log(`\n✓ OCR: ${imagePath}`);
    console.log(`  Text: ${result.text.substring(0, 200)}...`);
  }

  if (batchDir && fileExists(batchDir)) {
    const images = fs.readdirSync(batchDir).filter(f => /\.(jpg|jpeg|png|bmp|heic)$/i.test(f)).map(f => path.join(batchDir, f));
    log.info('ocr', 'Batch OCR', { count: images.length });
    for (const image of images) {
      const result = await processNote(modelId, image);
      results.push(result);
      console.log(`  ✓ ${path.basename(image)}: ${result.text.substring(0, 80)}...`);
    }
  }

  if (results.length === 0) {
    console.error('Usage: node src/ocr/notes.js --image <notes.jpg> [--to-sft] [--batch <dir>]');
    process.exit(1);
  }

  // --- Save ---
  ensureDir(path.dirname(outputPath));
  writeJSON(outputPath, { processedAt: new Date().toISOString(), count: results.length, results });
  console.log(`\n✓ ${results.length} notes saved to ${outputPath}`);

  // --- Convert to SFT ---
  if (toSFT) {
    const sftPairs = convertToSFT(results);
    const sftPath = outputPath.replace('.json', '_sft.json');
    writeJSON(sftPath, sftPairs);
    console.log(`✓ ${sftPairs.length} SFT pairs: ${sftPath}`);
  }

  await qvac.unloadModel(modelId);
}

async function processNote(modelId, imagePath) {
  const imageData = fs.readFileSync(imagePath);
  log.info('ocr', 'Processing note', { image: imagePath });

  let text = '';
  let blocks = null;

  // --- Try real QVAC ocr() API ---
  try {
    const ocrResult = await qvac.ocrImage(modelId, imageData);
    text = ocrResult.text;
    blocks = ocrResult.blocks;
    log.info('ocr', 'OCR complete', { blocks: blocks.length, textLength: text.length });
  } catch (e) {
    log.warn('ocr', 'ocr() failed, trying VLM describeImage fallback', { error: e.message });

    // --- Fallback: describeImage (VLM through completion) ---
    try {
      text = await qvac.describeImage(modelId, imageData,
        'Transcribe all handwritten text from this image exactly as written. Preserve line breaks and structure.',
        { maxTokens: 500, temperature: 0.3 }
      );
      log.info('ocr', 'VLM fallback complete', { textLength: text.length });
    } catch (e2) {
      log.error('ocr', 'Both OCR and VLM failed', { error: e2.message });
      text = '';
    }
  }

  // --- Structure the note ---
  const structured = text ? structureNote(text) : null;

  return {
    id: generateId('ocr'),
    image: imagePath,
    text,
    blocks,
    structured,
    timestamp: new Date().toISOString(),
  };
}

function structureNote(text) {
  const lower = text.toLowerCase();
  const structured = { type: 'unknown', fields: {} };

  if (lower.includes('match') || lower.includes('vs') || lower.includes('gegen')) {
    structured.type = 'match_note';
  } else if (lower.includes('player') || lower.includes('spieler') || lower.includes('evaluation')) {
    structured.type = 'player_note';
  } else if (lower.includes('training') || lower.includes('drill') || lower.includes('übung')) {
    structured.type = 'training_note';
  } else if (lower.includes('tactic') || lower.includes('press') || lower.includes('formation')) {
    structured.type = 'tactical_note';
  }

  const oppMatch = text.match(/(?:vs?\.?|gegen)\s+([A-Z][\w\s]+)/i);
  if (oppMatch) structured.fields.opponent = oppMatch[1].trim();

  const scoreMatch = text.match(/(\d)\s*[-:]\s*(\d)/);
  if (scoreMatch) structured.fields.score = `${scoreMatch[1]}-${scoreMatch[2]}`;

  const playerMatches = text.match(/\b[A-Z][a-z]{2,15}\b/g);
  if (playerMatches) {
    const common = ['The', 'This', 'Match', 'Training', 'Press', 'Channel', 'Flank', 'Compact', 'First', 'Second', 'Half', 'Ball', 'Team', 'Game'];
    structured.fields.mentionedPlayers = [...new Set(playerMatches.filter(n => !common.includes(n)))].slice(0, 10);
  }

  return structured;
}

function convertToSFT(ocrResults) {
  const pairs = [];
  for (const result of ocrResults) {
    if (!result.text || result.text.length < 20) continue;
    const s = result.structured || {};
    if (s.type === 'match_note') {
      pairs.push({ prompt: `What happened in the match against ${s.fields.opponent || 'the opponent'}?`, completion: result.text, _source: 'ocr' });
    } else if (s.type === 'player_note') {
      pairs.push({ prompt: `Evaluate ${(s.fields.mentionedPlayers || ['the player'])[0]} based on the coach's notes.`, completion: result.text, _source: 'ocr' });
    } else if (s.type === 'training_note') {
      pairs.push({ prompt: `What did we work on in this training session?`, completion: result.text, _source: 'ocr' });
    } else {
      pairs.push({ prompt: `What are the coach's notes about?`, completion: result.text, _source: 'ocr' });
    }
  }
  return pairs;
}

main().catch(err => {
  log.error('ocr', 'Error', { error: err.message });
  process.exit(1);
});

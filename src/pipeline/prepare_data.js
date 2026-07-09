/**
 * MISTER — Data Pipeline
 * 
 * Ingests club materials (JSON/txt/PDF) → chunks → generates SFT pairs + causal corpus
 * Outputs formatted datasets ready for QVAC Fabric finetune()
 * 
 * Usage: node src/pipeline/prepare_data.js [--input data/] [--output data/processed/]
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const INPUT_DIR = process.argv.find(a => a.startsWith('--input='))?.split('=')[1] || 'data';
const OUTPUT_DIR = process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || 'data/processed';

const secureStorage = require('../security/secure_storage');

// If MISTER_PASSWORD env var is set, enable transparent encryption
if (process.env.MISTER_PASSWORD) {
  secureStorage.unlock(process.env.MISTER_PASSWORD);
}

// --- Helpers ---
function readJSON(filePath) {
  // Use secure storage if encryption is enabled (reads .enc if available)
  if (secureStorage.isEnabled()) {
    try { return secureStorage.readSecure(filePath); } catch {}
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function chunkText(text, maxLen = 512, overlap = 64) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxLen - overlap) {
    chunks.push(words.slice(i, i + maxLen).join(' '));
    if (i + maxLen >= words.length) break;
  }
  return chunks;
}

// --- Main pipeline ---
async function main() {
  console.log('MISTER Data Pipeline');
  console.log('====================');
  console.log(`Input:  ${INPUT_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log();

  // Ensure output dir
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Load club profile
  const clubPath = path.join(INPUT_DIR, 'club_profile.json');
  if (!fs.existsSync(clubPath)) {
    console.error(`✗ Club profile not found: ${clubPath}`);
    process.exit(1);
  }
  const club = readJSON(clubPath);
  console.log(`✓ Club: ${club.name} (${club.formation})`);
  console.log(`  Players: ${club.players.length}, Terminology: ${Object.keys(club.terminology).length}`);

  // 2. Load SFT pairs
  const sftPath = path.join(INPUT_DIR, 'sft_pairs.json');
  let sftPairs = [];
  if (fs.existsSync(sftPath)) {
    sftPairs = readJSON(sftPath);
    console.log(`✓ SFT pairs: ${sftPairs.length}`);
  }

  // 3. Load causal corpus
  const causalPath = path.join(INPUT_DIR, 'causal_corpus.json');
  let causalDocs = [];
  if (fs.existsSync(causalPath)) {
    causalDocs = readJSON(causalPath);
    console.log(`✓ Causal docs: ${causalDocs.length}`);
  }

  // 4. Load opponents
  const oppPath = path.join(INPUT_DIR, 'opponents', 'opponents.json');
  let opponents = [];
  if (fs.existsSync(oppPath)) {
    opponents = readJSON(oppPath);
    console.log(`✓ Opponents: ${opponents.length}`);
  }

  // 5. Chunk causal docs for RAG index
  const ragChunks = [];
  for (const doc of causalDocs) {
    const chunks = chunkText(doc.text, 384, 64);
    for (let i = 0; i < chunks.length; i++) {
      ragChunks.push({
        id: `${doc.id}_chunk_${i}`,
        source: doc.id,
        type: doc.type,
        text: chunks[i],
        chunkIndex: i,
        totalChunks: chunks.length
      });
    }
  }
  console.log(`✓ RAG chunks: ${ragChunks.length}`);

  // 6. Format SFT pairs for QVAC Fabric
  // QVAC expects: { messages: [{ role: "user", content: prompt }, { role: "assistant", content: completion }] }
  const sftFormatted = sftPairs.map((pair, idx) => ({
    id: `sft_${idx}`,
    messages: [
      { role: 'user', content: pair.prompt },
      { role: 'assistant', content: pair.completion }
    ]
  }));

  // 7. Format causal corpus for QVAC Fabric (raw text)
  const causalFormatted = causalDocs.map((doc, idx) => ({
    id: `causal_${idx}`,
    text: doc.text,
    type: doc.type
  }));

  // 8. Split SFT: 90% train, 10% eval (hold-out is separate)
  const shuffled = [...sftFormatted].sort(() => Math.random() - 0.5);
  const splitIdx = Math.floor(shuffled.length * 0.9);
  const trainSFT = shuffled.slice(0, splitIdx);
  const evalSFT = shuffled.slice(splitIdx);

  // 9. Write outputs
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'sft_train.jsonl'),
    trainSFT.map(p => JSON.stringify(p)).join('\n')
  );
  console.log(`✓ Written: sft_train.jsonl (${trainSFT.length} pairs)`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'sft_eval.jsonl'),
    evalSFT.map(p => JSON.stringify(p)).join('\n')
  );
  console.log(`✓ Written: sft_eval.jsonl (${evalSFT.length} pairs)`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'causal_corpus.jsonl'),
    causalFormatted.map(d => JSON.stringify(d)).join('\n')
  );
  console.log(`✓ Written: causal_corpus.jsonl (${causalFormatted.length} docs)`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'rag_chunks.jsonl'),
    ragChunks.map(c => JSON.stringify(c)).join('\n')
  );
  console.log(`✓ Written: rag_chunks.jsonl (${ragChunks.length} chunks)`);

  // 10. Summary
  const summary = {
    club: club.name,
    generatedAt: new Date().toISOString(),
    sftTrain: trainSFT.length,
    sftEval: evalSFT.length,
    causalDocs: causalFormatted.length,
    ragChunks: ragChunks.length,
    opponents: opponents.length,
    players: club.players.length,
    terminologyTerms: Object.keys(club.terminology).length
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'pipeline_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log(`✓ Written: pipeline_summary.json`);
  console.log();
  console.log('Pipeline complete. Ready for finetune().');
}

main().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});

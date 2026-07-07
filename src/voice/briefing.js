/**
 * MISTER — Voice Match Briefing (QVAC TTS) — v5 FIXED
 * 
 * Uses qvac_wrapper.js: tts() and ttsStream() with PCM→WAV conversion.
 * 
 * Usage:
 *   node src/voice/briefing.js --opponent "SV Hafen United" [--adapter adapters/adapter.gguf]
 *   node src/voice/briefing.js --text "Press from the front" [--stream]
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { fileExists } = require('../utils/helpers');

async function main() {
  const opponent = process.argv.find(a => a.startsWith('--opponent='))?.split('=')[1];
  const textArg = process.argv.find(a => a.startsWith('--text='))?.split('=')[1];
  const adapter = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
  const useStream = process.argv.includes('--stream');
  const outputFile = process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || 'briefing.wav';

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) { log.error('voice', 'QVAC provider not running'); process.exit(1); }

  let briefingText = textArg;

  // Generate briefing from model if opponent specified
  if (opponent && !briefingText) {
    log.info('voice', 'Generating briefing', { opponent });

    const modelId = await qvac.loadLLM(config.model.llm, {
      quantization: config.model.quantization,
      lora: adapter && fileExists(adapter) ? adapter : undefined,
    });

    // Load opponent data
    let oppContext = '';
    const oppPath = path.join(process.cwd(), 'data/opponents/opponents.json');
    if (fileExists(oppPath)) {
      const opponents = JSON.parse(fs.readFileSync(oppPath, 'utf-8'));
      const opp = opponents.find(o => o.name.toLowerCase().includes(opponent.toLowerCase()));
      if (opp) oppContext = `\n\nOpponent data: ${JSON.stringify(opp).substring(0, 1500)}`;
    }

    const history = [
      { role: 'system', content: 'You are the club brain for FC Metall Nord. Generate a spoken match briefing in the club\'s voice. Be direct, concise, use terminology: pressing trigger, channel run, compact block, transition lock, verticality, flank overload.' },
      { role: 'user', content: `Give me a concise 2-minute voice briefing for the match against ${opponent}. Focus on: 1) Their key weakness, 2) Our main attacking pattern, 3) One defensive priority. Speak directly, as if talking to the coach on the phone. Keep it under 200 words.${oppContext}` }
    ];

    briefingText = await qvac.chat(modelId, history, { maxTokens: 300, temperature: 0.6 });
    await qvac.unloadModel(modelId);
    log.info('voice', 'Briefing generated', { length: briefingText.length });
  }

  if (!briefingText) {
    log.error('voice', 'No briefing text. Use --opponent or --text');
    process.exit(1);
  }

  // --- Load TTS model ---
  const ttsModelId = await qvac.loadTTS();

  // --- Generate speech ---
  log.info('voice', 'Generating speech', { streaming: useStream, textLength: briefingText.length });

  try {
    let wavBuffer;
    if (useStream) {
      wavBuffer = await qvac.ttsStream(ttsModelId, briefingText, (chunk) => {
        log.debug('voice', 'TTS chunk received');
      });
    } else {
      wavBuffer = await qvac.tts(ttsModelId, briefingText);
    }

    const outputPath = path.join(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, wavBuffer);

    // Save text alongside
    const textPath = outputFile.replace(/\.\w+$/, '.txt');
    fs.writeFileSync(path.join(process.cwd(), textPath), briefingText);

    log.info('voice', 'Briefing saved', { path: outputPath, size: wavBuffer.length });
    console.log(`\n✓ Voice briefing saved: ${outputPath}`);
    console.log(`  Size: ${(wavBuffer.length / 1024).toFixed(1)} KB`);
    console.log(`  Text: ${briefingText.substring(0, 150)}...`);

    await qvac.unloadModel(ttsModelId);
  } catch (e) {
    log.error('voice', 'TTS failed, saving text only', { error: e.message });
    const textPath = outputFile.replace(/\.\w+$/, '.txt');
    fs.writeFileSync(path.join(process.cwd(), textPath), briefingText);
    console.log(`\n⚠ TTS unavailable, text saved: ${textPath}`);
    console.log(`  ${briefingText}`);
  }
}

main().catch(err => {
  log.error('voice', 'Error', { error: err.message });
  process.exit(1);
});

/**
 * MISTER — Voice Input (QVAC STT) — v5 FIXED
 * 
 * Uses qvac_wrapper.js: stt() and sttStream() with correct transcribe API.
 * 
 * Usage:
 *   node src/voice/input.js --audio question.wav
 *   node src/voice/input.js --stream
 *   node src/voice/input.js --audio question.wav --chat
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { fileExists } = require('../utils/helpers');

async function main() {
  const audioFile = process.argv.find(a => a.startsWith('--audio='))?.split('=')[1];
  const useStream = process.argv.includes('--stream');
  const shouldChat = process.argv.includes('--chat');

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) { log.error('voice', 'QVAC provider not running'); process.exit(1); }

  // --- Load Whisper model ---
  const whisperModelId = await qvac.loadWhisper();

  if (audioFile && fileExists(audioFile)) {
    // --- Transcribe audio file ---
    log.info('voice', 'Transcribing audio file', { path: audioFile });
    const audioBuffer = fs.readFileSync(audioFile);

    const transcript = await qvac.stt(whisperModelId, audioBuffer, {
      language: config.voice.sttLanguage || 'en',
    });

    console.log('\n✓ Transcription:');
    console.log(`  "${transcript}"`);

    // Save
    const transcriptPath = path.join(process.cwd(), 'logs', `stt_${Date.now()}.txt`);
    fs.writeFileSync(transcriptPath, transcript);
    log.info('voice', 'Transcript saved', { path: transcriptPath });

    // Forward to chat
    if (shouldChat && transcript) {
      log.info('voice', 'Forwarding to chat');
      const { spawn } = require('child_process');
      const chatProc = spawn('node', ['src/inference/chat.js'], { cwd: process.cwd(), stdio: ['pipe', 'inherit', 'inherit'] });
      chatProc.stdin.write(transcript + '\n');
      chatProc.stdin.end();
    }

    await qvac.unloadModel(whisperModelId);

  } else if (useStream) {
    // --- Live streaming transcription ---
    log.info('voice', 'Starting live streaming transcription');
    console.log('\n🎤 Listening... (Ctrl+C to stop)\n');

    const transcript = await qvac.sttStream(whisperModelId, (text, isFinal) => {
      process.stdout.write(text);
      if (isFinal) console.log('\n');
    }, { language: config.voice.sttLanguage || 'en' });

    console.log(`\n\n✓ Full transcript: ${transcript}`);

    const transcriptPath = path.join(process.cwd(), 'logs', `stt_stream_${Date.now()}.txt`);
    fs.writeFileSync(transcriptPath, transcript);

    if (shouldChat && transcript) {
      const { spawn } = require('child_process');
      const chatProc = spawn('node', ['src/inference/chat.js'], { cwd: process.cwd(), stdio: ['pipe', 'inherit', 'inherit'] });
      chatProc.stdin.write(transcript + '\n');
      chatProc.stdin.end();
    }

    await qvac.unloadModel(whisperModelId);

  } else {
    console.error('Usage:');
    console.error('  node src/voice/input.js --audio <file.wav>     Transcribe audio file');
    console.error('  node src/voice/input.js --stream               Live streaming transcription');
    console.error('  node src/voice/input.js --audio <f> --chat     Transcribe → forward to chat');
    process.exit(1);
  }
}

main().catch(err => {
  log.error('voice', 'Error', { error: err.message });
  process.exit(1);
});

/**
 * MISTER — Inference + Real RAG — v5 FIXED
 * 
 * Uses qvac_wrapper.js for correct API calls.
 * Streaming chat with real QVAC RAG.
 * 
 * Usage: node src/inference/chat.js [--adapter adapters/adapter.gguf] [--model Qwen3-1.7B]
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const rag = require('./rag_engine');

const MODEL = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || config.model.llm;
const ADAPTER = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1] || null;
const INGEST = !process.argv.includes('--no-ingest');
const STREAM = process.argv.includes('--stream') || true; // Default: streaming

async function main() {
  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('chat', 'QVAC provider not running');
    process.exit(1);
  }

  // --- Ingest club data into RAG ---
  if (INGEST) {
    log.info('chat', 'Ingesting club data into RAG');
    try {
      await rag.ingestClubData(config.paths.data);
      log.info('chat', 'RAG ready');
    } catch (e) {
      log.warn('chat', 'RAG ingestion failed, adapter-only mode', { error: e.message });
    }
  }

  // --- Load model ---
  const modelId = await qvac.loadLLM(MODEL, {
    quantization: config.model.quantization,
    lora: ADAPTER && fs.existsSync(ADAPTER) ? ADAPTER : undefined,
  });
  log.info('chat', 'Model loaded', { model: MODEL, adapter: ADAPTER || 'none' });

  // --- Chat loop ---
  console.log('\nMISTER — Club Brain Chat (v5, streaming)');
  console.log('Type your question (or "quit" to exit):\n');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  function ask() {
    rl.question('> ', async (query) => {
      if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
        try { await rag.closeWorkspace(); } catch (e) { log.warn("inference.chat", "Caught error", { error: e.message }); }
        await qvac.unloadModel(modelId);
        rl.close();
        return;
      }

      const t0 = Date.now();

      // --- RAG retrieval ---
      let ragContext = '';
      let ragResults = [];
      if (rag.isReady()) {
        try {
          ragResults = await rag.search(query, config.rag.topK);
          if (ragResults.length > 0) {
            ragContext = '\n\n[Club context:]\n' + ragResults.map(r => r.text.substring(0, 500)).join('\n---\n');
          }
        } catch (e) {
          log.warn('chat', 'RAG search failed', { error: e.message });
        }
      }

      // --- Build history (QVAC uses "history" not "messages") ---
      const history = [
        { role: 'system', content: `You are the club brain for FC Metall Nord. You think and speak in the style of this club's game model: verticality over possession, press from the front, compact rest-defence, flank overloads, transition lock. Use the club's terminology naturally. Answer as the coach's assistant would — direct, tactical, in the club's voice.${ragContext}` },
        { role: 'user', content: query }
      ];

      // --- Generate response (streaming) ---
      if (STREAM) {
        process.stdout.write('\n');
        const answer = await qvac.chatStream(modelId, history, (token) => {
          process.stdout.write(token);
        }, {
          maxTokens: config.model.maxTokens,
          temperature: config.model.temperature,
        });
        
        const elapsed = Date.now() - t0;
        console.log(`\n\n  [${ragResults.length} RAG sources, ${elapsed}ms]\n`);
        
        log.metric('chat', 'response_time_ms', elapsed);
        log.metric('chat', 'rag_hits', ragResults.length);
      } else {
        const answer = await qvac.chat(modelId, history, {
          maxTokens: config.model.maxTokens,
          temperature: config.model.temperature,
        });
        
        const elapsed = Date.now() - t0;
        console.log(`\n${answer}\n`);
        if (ragResults.length > 0) {
          console.log(`  [RAG: ${ragResults.length} sources, ${elapsed}ms]\n`);
        }
      }

      ask();
    });
  }
  ask();
}

main().catch(err => {
  log.error('chat', 'Error', { error: err.message });
  process.exit(1);
});

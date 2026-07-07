/**
 * MISTER Mobile — Pear Worker
 * 
 * Runs QVAC SDK in a Bare worker (not main thread).
 * Handles: chat, OCR, VLM analysis, STT, TTS, translate, RAG
 * 
 * Receives messages from the UI thread and responds with results.
 */

const qvac = require('../../src/utils/qvac_wrapper');
const rag = require('../../src/inference/rag_engine');
const log = require('../../src/utils/logger');

let modelId = null;
let vlmModelId = null;
let whisperModelId = null;
let ttsModelId = null;
let nmtModelId = null;
let initialized = false;

/**
 * Initialize QVAC models on worker startup.
 */
async function initialize() {
  if (initialized) return;
  
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('worker', 'QVAC provider not running');
    return;
  }
  
  // Load LLM (lazy: only when first chat request comes)
  // We don't load all models at startup to save memory
  
  initialized = true;
  log.info('worker', 'Initialized');
}

/**
 * Ensure LLM is loaded.
 */
async function ensureLLM(adapter = null) {
  if (!modelId) {
    const config = require('../utils/config').config;
    modelId = await qvac.loadLLM(config.model.llm, {
      quantization: config.model.quantization,
      lora: adapter,
    });
    
    // Ingest RAG if not done
    if (!rag.isReady()) {
      await rag.ingestClubData(config.paths.data);
    }
  }
  return modelId;
}

/**
 * Handle messages from UI thread.
 */
async function handleMessage(msg) {
  const { type, ...data } = msg;
  
  switch (type) {
    case 'chat': {
      await initialize();
      const model = await ensureLLM(data.adapter);
      
      // RAG search
      let ragContext = '';
      let ragHits = 0;
      if (rag.isReady()) {
        const results = await rag.search(data.message, 3);
        ragHits = results.length;
        if (ragHits > 0) {
          ragContext = '\n\n[Club context:]\n' + results.map(r => r.text.substring(0, 500)).join('\n---\n');
        }
      }
      
      const history = [
        { role: 'system', content: `You are the club brain for FC Metall Nord. Think and speak in the club's game model: verticality, pressing, compact rest-defence, flank overloads, transition lock. Use club terminology.${ragContext}` },
        { role: 'user', content: data.message }
      ];
      
      const t0 = Date.now();
      const text = await qvac.chat(model, history, {
        maxTokens: 512, temperature: 0.7,
        onToken: (token) => {
          // Stream tokens to UI
          if (typeof Pear !== 'undefined' && Pear.worker) {
            Pear.worker.postMessage({ type: 'chatToken', token });
          }
        }
      });
      
      return { text, ragHits, timeMs: Date.now() - t0 };
    }
    
    case 'ocr': {
      await initialize();
      if (!vlmModelId) {
        const config = require('../utils/config').config;
        vlmModelId = await qvac.loadVLM(config.model.vlm);
      }
      
      const imageBuffer = Buffer.from(data.image);
      const result = await qvac.ocrImage(vlmModelId, imageBuffer);
      return { text: result.text, blocks: result.blocks?.length || 0 };
    }
    
    case 'vlm': {
      await initialize();
      if (!vlmModelId) {
        const config = require('../utils/config').config;
        vlmModelId = await qvac.loadVLM(config.model.vlm);
      }
      
      const imageBuffer = Buffer.from(data.image);
      const text = await qvac.describeImage(vlmModelId, imageBuffer,
        'Analyze this football frame tactically. Describe: formation, pressing, space, key patterns.',
        { maxTokens: 300, temperature: 0.5 }
      );
      return { text };
    }
    
    case 'sttStream': {
      await initialize();
      if (!whisperModelId) {
        whisperModelId = await qvac.loadWhisper();
      }
      
      const transcript = await qvac.sttStream(whisperModelId, (text, isFinal) => {
        if (typeof Pear !== 'undefined' && Pear.worker) {
          Pear.worker.postMessage({ type: 'sttChunk', text, isFinal });
        }
      });
      return { transcript };
    }
    
    case 'tts': {
      await initialize();
      if (!ttsModelId) {
        ttsModelId = await qvac.loadTTS();
      }
      
      const wavBuffer = await qvac.tts(ttsModelId, data.text);
      return { audio: wavBuffer };
    }
    
    case 'translate': {
      await initialize();
      if (!nmtModelId) {
        nmtModelId = await qvac.loadNMT();
      }
      
      const translated = await qvac.translateText(nmtModelId, data.text, data.targetLang);
      return { text: translated };
    }
    
    case 'healthCheck': {
      const healthy = await qvac.healthCheck();
      return { healthy };
    }
    
    default:
      return { error: `Unknown message type: ${type}` };
  }
}

// --- Pear worker message handler ---
if (typeof Pear !== 'undefined' && Pear.worker) {
  Pear.worker.on('message', async (msg) => {
    try {
      const result = await handleMessage(msg);
      Pear.worker.postMessage({ id: msg.id, result });
    } catch (e) {
      Pear.worker.postMessage({ id: msg.id, error: e.message });
    }
  });
}

// Export for testing
module.exports = { handleMessage, initialize };

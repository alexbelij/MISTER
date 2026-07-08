/**
 * MISTER — QVAC SDK Wrapper
 * 
 * Single source of truth for all QVAC SDK calls.
 * Correct parameter names, correct response handling.
 * 
 * Based on QVAC SDK v0.14.x API documentation:
 * https://docs.qvac.tether.io/sdk/api/
 * 
 * 49 functions available. We wrap the ones MISTER uses.
 * 
 * Key API differences from naive assumptions:
 * - completion() takes { modelId, history } NOT { model, messages }
 *   Returns CompletionRun with .events (AsyncIterable) and .final (Promise)
 * - loadModel() takes { modelSrc: "path", modelType: "llamacpp-completion" }
 *   NOT nested { modelSrc: { modelConfig: { llm } } }
 * - translate() returns { text: Promise<string>, tokenStream: AsyncGenerator }
 *   Need to await result.text
 * - ocr() returns { blocks: Promise<{text, bbox, confidence}[]>, blockStream }
 *   Need to await result.blocks and map to text
 * - textToSpeech() returns { buffer: Promise<number[]> } (PCM samples)
 *   Need to convert PCM to WAV
 * - vla() is Vision-Language-Action for robotics, NOT image description
 *   Use completion() with VLM model for image description
 * - video() generates video, does NOT analyze it
 * - classify() only supports bundled labels (food/report/other)
 * - finetune() Overload 1 returns FinetuneHandle with progressStream + result
 *   Overload 2 for state/suspend/resume/cancel
 */

const fs = require('fs');
const path = require('path');
const log = require('./logger');

// Cache loaded QVAC instance
let _qvac = null;

/**
 * Get the QVAC SDK instance.
 * @returns {Object} QVAC SDK
 * @throws if @qvac/sdk not installed
 */
function getQVAC() {
  if (_qvac) return _qvac;
  try {
    _qvac = require('@qvac/sdk');
    return _qvac;
  } catch (e) {
    throw new Error('@qvac/sdk not found. Run: npm install @qvac/sdk');
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

/**
 * Check if QVAC provider is running and responsive.
 * Uses heartbeat() API.
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    const qvac = getQVAC();
    await qvac.heartbeat({});
    log.info('qvac', 'Health check passed');
    return true;
  } catch (e) {
    log.error('qvac', 'Health check failed', { error: e.message });
    return false;
  }
}

// ============================================================
// MODEL LOADING
// ============================================================

/**
 * Load an LLM model for completion/inference.
 * 
 * @param {string} modelSrc - Model name (e.g. "Qwen3-1.7B") or path to .gguf
 * @param {Object} opts - Options
 * @param {string} opts.quantization - Quantization (Q4_0, Q8_0, F16)
 * @param {number} opts.ctxSize - Context window size (default 2048)
 * @param {string} opts.lora - Path to LoRA adapter .gguf
 * @param {Function} opts.onProgress - Progress callback for download
 * @returns {Promise<string>} modelId
 */
async function loadLLM(modelSrc, opts = {}) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc,
    modelType: 'llamacpp-completion',
    modelConfig: {
      ctx_size: opts.ctxSize || 2048,
    },
  };
  
  if (opts.lora) {
    params.modelConfig.lora = opts.lora;
  }
  
  if (opts.onProgress) {
    params.onProgress = opts.onProgress;
  }
  
  log.info('qvac', 'Loading LLM', { modelSrc, quantization: opts.quantization, lora: !!opts.lora });
  
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'LLM loaded', { modelId });
  return modelId;
}

/**
 * Load a VLM (Vision-Language Model) for image description.
 * Uses completion model type since VLM works through completion() with image content.
 * 
 * @param {string} modelSrc - VLM model name (e.g. "SmolVLM2-500M")
 * @param {Object} opts - Options
 * @returns {Promise<string>} modelId
 */
async function loadVLM(modelSrc, opts = {}) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc,
    modelType: 'llamacpp-vlm',
    modelConfig: {
      ctx_size: opts.ctxSize || 2048,
    },
  };
  
  log.info('qvac', 'Loading VLM', { modelSrc });
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'VLM loaded', { modelId });
  return modelId;
}

/**
 * Load a Whisper model for speech-to-text.
 * 
 * @param {string} modelSrc - Whisper model name
 * @param {Object} opts - Options
 * @returns {Promise<string>} modelId
 */
async function loadWhisper(modelSrc = 'whisper-tiny', opts = {}) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc,
    modelType: 'whisper',
  };
  
  log.info('qvac', 'Loading Whisper', { modelSrc });
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'Whisper loaded', { modelId });
  return modelId;
}

/**
 * Load a TTS model for text-to-speech.
 * 
 * @param {string} modelSrc - TTS model name
 * @param {Object} opts - Options
 * @returns {Promise<string>} modelId
 */
async function loadTTS(modelSrc, opts = {}) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc,
    modelType: 'tts',
  };
  
  log.info('qvac', 'Loading TTS', { modelSrc });
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'TTS loaded', { modelId });
  return modelId;
}

/**
 * Load an NMT (Neural Machine Translation) model.
 * 
 * @param {string} modelSrc - NMT model name
 * @param {Object} opts - Options
 * @returns {Promise<string>} modelId
 */
async function loadNMT(modelSrc, opts = {}) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc,
    modelType: 'nmt',
  };
  
  log.info('qvac', 'Loading NMT', { modelSrc });
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'NMT loaded', { modelId });
  return modelId;
}

/**
 * Load an embedding model for RAG and similarity scoring.
 * 
 * @param {string} modelSrc - Embedding model name
 * @returns {Promise<string>} modelId
 */
async function loadEmbedder(modelSrc) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc || 'default-embedding',
    modelType: 'embedding',
  };
  
  log.info('qvac', 'Loading embedder', { modelSrc });
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'Embedder loaded', { modelId });
  return modelId;
}

/**
 * Load a diffusion model for upscaling.
 * 
 * @param {string} modelSrc - Diffusion model name
 * @returns {Promise<string>} modelId
 */
async function loadDiffusion(modelSrc) {
  const qvac = getQVAC();
  
  const params = {
    modelSrc: modelSrc || 'default-diffusion',
    modelType: 'diffusion',
    modelConfig: {
      mode: 'upscale',
    },
  };
  
  log.info('qvac', 'Loading diffusion (upscale mode)', { modelSrc });
  const modelId = await qvac.loadModel(params);
  log.info('qvac', 'Diffusion loaded', { modelId });
  return modelId;
}

// ============================================================
// COMPLETION / CHAT
// ============================================================

/**
 * Generate a completion from an LLM.
 * 
 * Uses completion() which returns a CompletionRun with:
 * - .events (AsyncIterable<CompletionEvent>) for streaming
 * - .final (Promise<CompletionFinal>) for aggregated result
 * 
 * @param {string} modelId - Loaded model ID
 * @param {Array} history - Conversation history [{ role, content }]
 * @param {Object} opts - Options
 * @param {number} opts.maxTokens - Max tokens to generate
 * @param {number} opts.temperature - Sampling temperature
 * @param {boolean} opts.stream - Whether to stream tokens
 * @param {Function} opts.onToken - Callback for each token (streaming)
 * @returns {Promise<string>} Generated text
 */
async function chat(modelId, history, opts = {}) {
  const qvac = getQVAC();
  
  const params = {
    modelId: modelId,
    history: history,
    stream: true,  // stream is required by QVAC SDK
  };
  
  // generationParams is the correct nesting for temp/predict/etc
  const genParams = {};
  if (opts.maxTokens) genParams.predict = opts.maxTokens;
  if (opts.temperature !== undefined) genParams.temp = opts.temperature;
  if (opts.topP !== undefined) genParams.top_p = opts.topP;
  if (opts.topK !== undefined) genParams.top_k = opts.topK;
  if (opts.seed !== undefined) genParams.seed = opts.seed;
  if (Object.keys(genParams).length > 0) params.generationParams = genParams;
  
  if (opts.tools) params.tools = opts.tools;
  // Remove thinking tokens from output by default (Qwen3 produces <think> blocks)
  params.remove_thinking_from_context = opts.captureThinking === true ? false : true;
  
  log.debug('qvac', 'Completion request', { 
    modelId, 
    historyLength: history.length,
    maxTokens: opts.maxTokens 
  });
  
  const run = qvac.completion(params);
  
  // If streaming with callback, consume events
  if (opts.onToken && run.events) {
    let fullText = '';
    for await (const event of run.events) {
      if (event.type === 'contentDelta' && event.text) {
        fullText += event.text;
        opts.onToken(event.text);
      }
    }
    // Also get final for any remaining data
    if (run.final) {
      const final = await run.final;
      const finalText = final.contentText || final.content || final.text || '';
      // Use final if we didn't get content via events
      if (!fullText && finalText) {
        return finalText;
      }
    }
    fullText = stripThinking(fullText);
    log.debug('qvac', 'Completion (streamed)', { length: fullText.length });
    return fullText;
  }
  
  // Non-streaming: wait for final
  if (run.final) {
    const result = await run.final;
    const text = result.contentText || result.content || result.text || '';
    const cleanText = stripThinking(text);
    log.debug('qvac', 'Completion (final)', { length: cleanText.length });
    return cleanText;
  }
  
  // Legacy: some SDKs may return text directly
  if (run.text) {
    const text = typeof run.text === 'string' ? run.text : await run.text;
    log.debug('qvac', 'Completion (legacy)', { length: text.length });
    return text;
  }
  
  log.warn('qvac', 'Completion returned unexpected shape', { keys: Object.keys(run) });
  return '';
}

/**
 * Strip thinking blocks from model output.
 * Qwen3 produces  thinking...  blocks that should not be shown to users.
 */
function stripThinking(text) {
  if (!text) return text;
  // Remove  ...  blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // Remove leading  if present (unclosed thinking at start)
  text = text.replace(/^<think>[\s\S]*$/m, '');
  // Also remove  prefix if model outputs it without tags
  if (text.startsWith('')) text = text.substring(7).trim();
  return text.trim();
}

/**
 * Stream completion tokens.
 * 
 * @param {string} modelId - Loaded model ID
 * @param {Array} history - Conversation history
 * @param {Function} onToken - Callback(token: string)
 * @param {Object} opts - Additional options
 * @returns {Promise<string>} Full text
 */
async function chatStream(modelId, history, onToken, opts = {}) {
  return chat(modelId, history, { ...opts, onToken, stream: true });
}

/**
 * Describe an image using a VLM model through completion().
 * 
 * VLM models accept image content in the history:
 * [{ role: "user", content: [{ type: "image", ... }, { type: "text", text: prompt }] }]
 * 
 * @param {string} vlmModelId - Loaded VLM model ID
 * @param {Buffer} imageBuffer - Image data
 * @param {string} prompt - Question about the image
 * @param {Object} opts - Options
 * @returns {Promise<string>} Image description
 */
async function describeImage(vlmModelId, imageBuffer, prompt, opts = {}) {
  const qvac = getQVAC();
  
  // Build multimodal history for VLM
  const imageBase64 = imageBuffer.toString('base64');
  const history = [{
    role: 'user',
    content: [
      { type: 'image', base64: imageBase64 },
      { type: 'text', text: prompt },
    ],
  }];
  
  const params = {
    modelId: vlmModelId,
    history: history,
    stream: true,
  };
  
  const genParams = {};
  if (opts.maxTokens) genParams.predict = opts.maxTokens;
  if (opts.temperature !== undefined) genParams.temp = opts.temperature;
  if (Object.keys(genParams).length > 0) params.generationParams = genParams;
  
  log.info('qvac', 'VLM describeImage', { promptLength: prompt.length, imageSize: imageBuffer.length });
  
  const run = qvac.completion(params);
  
  if (run.final) {
    const result = await run.final;
    const text = result.contentText || result.content || result.text || '';
    log.info('qvac', 'VLM response', { length: text.length });
    return text;
  }
  
  // Fallback: try legacy text
  if (run.text) {
    return typeof run.text === 'string' ? run.text : await run.text;
  }
  
  return '';
}

// ============================================================
// EMBEDDINGS
// ============================================================

/**
 * Generate an embedding vector for a text.
 * 
 * @param {string} text - Text to embed
 * @param {string} embedderModelId - Loaded embedder model ID (optional)
 * @returns {Promise<Float32Array|null>} Embedding vector
 */
async function embed(text, embedderModelId = null) {
  const qvac = getQVAC();
  
  const params = { text };
  if (embedderModelId) params.modelId = embedderModelId;
  
  try {
    const result = await qvac.embed(params);
    // Extract embedding vector from result
    const embedding = result.embedding || result.vector || result;
    log.debug('qvac', 'Embedding generated', { textLen: text.length, dims: embedding?.length });
    return embedding;
  } catch (e) {
    log.error('qvac', 'Embed failed', { error: e.message });
    return null;
  }
}

/**
 * Cosine similarity between two vectors.
 * @param {Array} vecA
 * @param {Array} vecB
 * @returns {number} Similarity 0-1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ============================================================
// RAG (Retrieval Augmented Generation)
// ============================================================

/**
 * Ingest documents into a RAG workspace.
 * Full pipeline: chunk → embed → save
 * 
 * @param {string} workspace - Workspace name
 * @param {Array} documents - [{ text, metadata?, id? }]
 * @returns {Promise<Object>} Result
 */
async function ragIngest(workspace, documents) {
  const qvac = getQVAC();
  log.info('qvac', 'RAG ingest', { workspace, documents: documents.length });
  
  const results = [];
  for (const doc of documents) {
    try {
      const params = {
        workspace: workspace,
        document: doc.text,
      };
      if (doc.metadata) params.metadata = doc.metadata;
      if (doc.id) params.documentId = doc.id;
      
      const result = await qvac.ragIngest(params);
      results.push({ success: true, result, docId: doc.id });
    } catch (e) {
      // Try alternate parameter names
      try {
        const result = await qvac.ragIngest({
          workspace: workspace,
          text: doc.text,
          id: doc.id,
          ...(doc.metadata || {}),
        });
        results.push({ success: true, result, docId: doc.id });
      } catch (e2) {
        log.error('qvac', 'RAG ingest failed for doc', { docId: doc.id, error: e2.message });
        results.push({ success: false, error: e2.message, docId: doc.id });
      }
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  log.info('qvac', 'RAG ingest complete', { workspace, success: successCount, failed: results.length - successCount });
  return { workspace, ingested: successCount, total: results.length, results };
}

/**
 * Search for similar documents in RAG workspace.
 * 
 * @param {string} workspace - Workspace name
 * @param {string} query - Search query
 * @param {number} topK - Number of results (default 3)
 * @returns {Promise<Array>} Search results [{ text, score, metadata }]
 */
async function ragSearch(workspace, query, topK = 3) {
  const qvac = getQVAC();
  log.debug('qvac', 'RAG search', { workspace, query: query.substring(0, 60), topK });
  
  try {
    const result = await qvac.ragSearch({
      workspace: workspace,
      query: query,
      topK: topK,
    });
    
    const hits = result.results || result.hits || result || [];
    log.debug('qvac', 'RAG search results', { hits: hits.length });
    
    return hits.map(hit => ({
      text: hit.text || hit.content || hit.document || '',
      score: hit.score || hit.similarity || 0,
      metadata: hit.metadata || {},
      id: hit.id || hit.documentId || '',
    }));
  } catch (e) {
    log.error('qvac', 'RAG search failed', { error: e.message });
    return [];
  }
}

/**
 * List all RAG workspaces.
 * @returns {Promise<Array>}
 */
async function ragList() {
  const qvac = getQVAC();
  try {
    const result = await qvac.ragListWorkspaces({});
    return result.workspaces || result || [];
  } catch (e) {
    log.error('qvac', 'ragListWorkspaces failed', { error: e.message });
    return [];
  }
}

/**
 * Close a RAG workspace.
 * @param {string} workspace
 */
async function ragClose(workspace) {
  const qvac = getQVAC();
  try {
    await qvac.ragCloseWorkspace({ workspace });
    log.info('qvac', 'RAG workspace closed', { workspace });
  } catch (e) {
    log.warn('qvac', 'ragCloseWorkspace failed', { error: e.message });
  }
}

/**
 * Delete a RAG workspace (GDPR right to erasure).
 * @param {string} workspace
 */
async function ragDelete(workspace) {
  const qvac = getQVAC();
  try {
    await qvac.ragDeleteWorkspace({ workspace });
    log.info('qvac', 'RAG workspace deleted', { workspace });
  } catch (e) {
    log.warn('qvac', 'ragDeleteWorkspace failed', { error: e.message });
  }
}

/**
 * Reindex a RAG workspace (after data updates).
 * @param {string} workspace
 */
async function ragReindex(workspace) {
  const qvac = getQVAC();
  try {
    await qvac.ragReindex({ workspace });
    log.info('qvac', 'RAG workspace reindexed', { workspace });
  } catch (e) {
    log.warn('qvac', 'ragReindex failed', { error: e.message });
  }
}

// ============================================================
// FINE-TUNING (QVAC Fabric)
// ============================================================

/**
 * Run/start/resume a fine-tune job.
 * 
 * Uses finetune() Overload 1 which returns a FinetuneHandle with:
 * - progressStream: AsyncIterable for progress updates
 * - result: Promise<FinetuneResult> for the final result
 * 
 * @param {string} modelId - Loaded model ID to fine-tune
 * @param {Object} params - Fine-tune parameters
 * @param {Object} params.sft - SFT dataset config
 * @param {Object} params.causal - Causal corpus config
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Fine-tune result
 */
async function finetuneRun(modelId, params, onProgress) {
  const qvac = getQVAC();
  const fs = require('fs');
  const path = require('path');

  // QVAC finetune API expects:
  // { modelId, options: { trainDatasetDir, outputParametersDir, numberOfEpochs, ... } }
  // We need to write SFT data to a directory in the format QVAC expects.

  // QVAC expects trainDatasetDir to be a FILE path (e.g. /path/to/train.jsonl), not a directory
  const trainDir = params.trainDir || path.join(process.cwd(), 'data', 'finetune_input');
  const outputDir = params.outputDir || path.join(process.cwd(), 'data', 'finetune_output');

  // Ensure directories exist
  fs.mkdirSync(trainDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // Write SFT data as JSONL file (QVAC expects train.jsonl in trainDatasetDir)
  if (params.sft && params.sft.dataset) {
    // If trainDir is a directory, write train.jsonl inside it; if it's a file path, use it directly
  let sftPath;
  if (trainDir.endsWith('.jsonl')) {
    sftPath = trainDir;
    fs.mkdirSync(path.dirname(sftPath), { recursive: true });
  } else {
    sftPath = path.join(trainDir, 'train.jsonl');
  }
    const lines = params.sft.dataset.map(item => {
      // QVAC expects { messages: [{ role, content }] } format
      if (item.messages) return JSON.stringify(item);
      // Convert { prompt, completion } to { messages: [...] }
      return JSON.stringify({
        messages: [
          { role: 'user', content: item.prompt || item.instruction || '' },
          { role: 'assistant', content: item.completion || item.output || item.response || '' }
        ]
      });
    });
    fs.writeFileSync(sftPath, lines.join('\n'));
    log.info('qvac', 'Wrote SFT training data', { path: sftPath, pairs: lines.length });
  }

  // Build QVAC finetune params
  const finetuneParams = {
    modelId: modelId,
    options: {
      trainDatasetDir: sftPath,  // QVAC expects a file path, not directory
      outputParametersDir: outputDir,
      validation: { type: 'none' },
    }
  };

  // Map training config to QVAC options
  const opts = finetuneParams.options;
  if (params.sft) {
    if (params.sft.epochs) opts.numberOfEpochs = params.sft.epochs;
    if (params.sft.learningRate) opts.learningRate = params.sft.learningRate;
    if (params.sft.assistantLossOnly !== undefined) opts.assistantLossOnly = params.sft.assistantLossOnly;
    if (params.sft.loraModules) {
      // Convert array to comma-separated string if needed
      let modules = params.sft.loraModules;
      if (Array.isArray(modules)) {
        // Map common short names to QVAC's expected module names
        const moduleMap = {
          'q_proj': 'attn_q', 'k_proj': 'attn_k', 'v_proj': 'attn_v', 'o_proj': 'attn_o',
          'gate_proj': 'ffn_gate', 'up_proj': 'ffn_up', 'down_proj': 'ffn_down'
        };
        modules = modules.map(m => moduleMap[m] || m).join(',');
      }
      opts.loraModules = modules;
    }
  }
  if (params.loraRank) opts.loraRank = params.loraRank;
  if (params.loraAlpha) opts.loraAlpha = params.loraAlpha;
  if (params.contextLength) opts.contextLength = params.contextLength;
  if (params.batchSize) opts.batchSize = params.batchSize;
  if (params.microBatchSize) opts.microBatchSize = params.microBatchSize;
  if (params.checkpoints && params.checkpoints.enabled) {
    fs.mkdirSync(params.checkpoints.dir, { recursive: true });
    opts.checkpointSaveDir = params.checkpoints.dir;
    if (params.checkpoints.everyNEpochs) opts.checkpointSaveSteps = params.checkpoints.everyNEpochs;
  }

  log.info('qvac', 'Starting fine-tune', {
    modelId,
    trainDir,
    outputDir,
    epochs: opts.numberOfEpochs,
    sftPairs: params.sft?.dataset?.length
  });

  // finetune() returns FinetuneHandle with progressStream + result
  const handle = qvac.finetune(finetuneParams);

  // Stream progress
  if (handle.progressStream && onProgress) {
    for await (const progress of handle.progressStream) {
      // Normalize progress fields
      onProgress({
        epoch: progress.current_epoch,
        step: progress.current_batch,
        totalSteps: progress.total_batches,
        loss: progress.loss,
        percent: progress.total_batches > 0 ? (progress.current_batch / progress.total_batches) * 100 : 0,
        elapsed: progress.elapsed_ms,
        eta: progress.eta_ms,
        raw: progress,
      });
    }
  }

  // Wait for result
  const result = handle.result
    ? (handle.result instanceof Promise ? await handle.result : handle.result)
    : handle;

  log.info('qvac', 'Fine-tune complete', {
    status: result.status,
    stats: result.stats ? { trainLoss: result.stats.train_loss, epochs: result.stats.epochs_completed } : null
  });

  // Normalize result for MISTER
  return {
    adapterPath: outputDir,
    adapterSize: 0,
    finalLoss: result.stats?.train_loss || 0,
    status: result.status,
    stats: result.stats,
    raw: result,
  };
}

/**
 * Get state of a fine-tune job.
 * Uses finetune() Overload 2.
 * 
 * @param {string} jobId - Fine-tune job ID
 * @returns {Promise<Object>} Job state
 */
async function finetuneState(jobId) {
  const qvac = getQVAC();
  try {
    const result = await qvac.finetune({ action: 'state', jobId });
    log.info('qvac', 'Fine-tune state', { jobId, state: result.status || result.state });
    return result;
  } catch (e) {
    log.error('qvac', 'finetuneState failed', { error: e.message });
    return null;
  }
}

/**
 * Suspend a fine-tune job.
 * @param {string} jobId
 */
async function finetuneSuspend(jobId) {
  const qvac = getQVAC();
  try {
    await qvac.finetune({ action: 'suspend', jobId });
    log.info('qvac', 'Fine-tune suspended', { jobId });
  } catch (e) {
    log.error('qvac', 'finetuneSuspend failed', { error: e.message });
  }
}

/**
 * Resume a suspended fine-tune job.
 * @param {string} jobId
 * @returns {Promise<Object>} FinetuneHandle
 */
async function finetuneResume(jobId) {
  const qvac = getQVAC();
  try {
    const handle = await qvac.finetune({ action: 'resume', jobId });
    log.info('qvac', 'Fine-tune resumed', { jobId });
    return handle;
  } catch (e) {
    log.error('qvac', 'finetuneResume failed', { error: e.message });
    return null;
  }
}

/**
 * Cancel a fine-tune job.
 * @param {string} jobId
 */
async function finetuneCancel(jobId) {
  const qvac = getQVAC();
  try {
    await qvac.finetune({ action: 'cancel', jobId });
    log.info('qvac', 'Fine-tune cancelled', { jobId });
  } catch (e) {
    log.error('qvac', 'finetuneCancel failed', { error: e.message });
  }
}

// ============================================================
// SPEECH: TTS (Text-to-Speech)
// ============================================================

/**
 * Convert text to speech audio.
 * 
 * textToSpeech() returns:
 * - result.buffer: Promise<number[]> (PCM samples)
 * - result.bufferStream: AsyncGenerator<number> (streaming)
 * 
 * We need to convert PCM to WAV format.
 * 
 * @param {string} ttsModelId - Loaded TTS model ID
 * @param {string} text - Text to synthesize
 * @param {Object} opts - Options
 * @returns {Promise<Buffer>} WAV audio buffer
 */
async function tts(ttsModelId, text, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'TTS request', { textLength: text.length });
  
  const params = {
    modelId: ttsModelId,
    text: text,
  };
  
  if (opts.voice) params.voice = opts.voice;
  if (opts.language) params.language = opts.language;
  
  const result = await qvac.textToSpeech(params);
  
  // Get PCM samples from buffer promise
  const pcmData = await result.buffer;
  
  // Convert PCM to WAV
  const sampleRate = opts.sampleRate || 16000; // Default 16kHz
  const wavBuffer = pcmToWav(pcmData, sampleRate);
  
  log.info('qvac', 'TTS complete', { pcmLength: pcmData.length, wavSize: wavBuffer.length });
  return wavBuffer;
}

/**
 * Stream TTS audio chunks.
 * 
 * @param {string} ttsModelId - Loaded TTS model ID
 * @param {string} text - Text to synthesize
 * @param {Function} onChunk - Callback(pcmChunk: number[])
 * @param {Object} opts - Options
 * @returns {Promise<Buffer>} Full WAV buffer
 */
async function ttsStream(ttsModelId, text, onChunk, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'TTS stream request', { textLength: text.length });
  
  const params = {
    modelId: ttsModelId,
    text: text,
    stream: true,
  };
  
  if (opts.voice) params.voice = opts.voice;
  if (opts.language) params.language = opts.language;
  
  const result = await qvac.textToSpeech(params);
  
  const allChunks = [];
  
  // Stream PCM chunks
  if (result.bufferStream) {
    for await (const sample of result.bufferStream) {
      allChunks.push(sample);
      if (onChunk) onChunk(sample);
    }
  }
  
  // Also wait for buffer (may be empty in stream mode)
  if (result.buffer) {
    const remaining = await result.buffer;
    if (remaining && remaining.length > 0) {
      allChunks.push(...remaining);
    }
  }
  
  const sampleRate = opts.sampleRate || 16000;
  const wavBuffer = pcmToWav(allChunks, sampleRate);
  
  log.info('qvac', 'TTS stream complete', { chunks: allChunks.length, wavSize: wavBuffer.length });
  return wavBuffer;
}

/**
 * Convert PCM samples (number[]) to WAV buffer.
 * 
 * @param {number[]} pcmData - PCM audio samples
 * @param {number} sampleRate - Sample rate (default 16000)
 * @param {number} bitsPerSample - Bits per sample (default 16)
 * @param {number} channels - Number of channels (default 1 = mono)
 * @returns {Buffer} WAV file buffer
 */
function pcmToWav(pcmData, sampleRate = 16000, bitsPerSample = 16, channels = 1) {
  const numSamples = pcmData.length;
  const dataSize = numSamples * (bitsPerSample / 8);
  const blockSize = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockSize;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20);  // audio format = PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockSize, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Write PCM samples
  for (let i = 0; i < numSamples; i++) {
    // Clamp to 16-bit range
    const sample = Math.max(-32768, Math.min(32767, Math.round(pcmData[i] * 32767)));
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  
  return buffer;
}

// ============================================================
// SPEECH: STT (Speech-to-Text / Transcription)
// ============================================================

/**
 * Transcribe audio to text.
 * 
 * transcribe() returns the complete text.
 * 
 * @param {string} whisperModelId - Loaded Whisper model ID
 * @param {Buffer} audioBuffer - Audio data
 * @param {Object} opts - Options
 * @returns {Promise<string>} Transcribed text
 */
async function stt(whisperModelId, audioBuffer, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'STT request', { audioSize: audioBuffer.length });
  
  const params = {
    modelId: whisperModelId,
    audio: audioBuffer,
  };
  
  if (opts.language) params.language = opts.language;
  
  const result = await qvac.transcribe(params);
  
  // transcribe() may return string directly or { text }
  const text = typeof result === 'string' ? result : (result.text || result.transcript || '');
  
  log.info('qvac', 'STT complete', { textLength: text.length });
  return text;
}

/**
 * Stream transcription (live microphone input).
 * 
 * @param {string} whisperModelId - Loaded Whisper model ID
 * @param {Function} onText - Callback(text: string, isFinal: boolean)
 * @param {Object} opts - Options
 * @returns {Promise<string>} Full transcript
 */
async function sttStream(whisperModelId, onText, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'STT stream starting');
  
  const params = {
    modelId: whisperModelId,
  };
  
  if (opts.language) params.language = opts.language;
  
  const stream = await qvac.transcribeStream(params);
  
  let fullText = '';
  
  for await (const chunk of stream) {
    const text = chunk.text || chunk.transcript || '';
    const isFinal = chunk.isFinal || chunk.final || false;
    
    if (text) {
      fullText += text;
      if (onText) onText(text, isFinal);
    }
  }
  
  log.info('qvac', 'STT stream complete', { textLength: fullText.length });
  return fullText;
}

// ============================================================
// TRANSLATION (NMT)
// ============================================================

/**
 * Translate text to another language.
 * 
 * translate() returns:
 * - result.text: Promise<string> (complete translation)
 * - result.tokenStream: AsyncGenerator<string> (streaming tokens)
 * - result.stats: Promise<Object> (translation stats)
 * 
 * @param {string} nmtModelId - Loaded NMT model ID
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (e.g. "pt", "es", "ja")
 * @param {Object} opts - Options
 * @returns {Promise<string>} Translated text
 */
async function translateText(nmtModelId, text, targetLang, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'Translate request', { textLength: text.length, targetLang });
  
  const params = {
    modelId: nmtModelId,
    text: text,
    to: targetLang,
  };
  
  if (opts.sourceLang) params.from = opts.sourceLang;
  
  const result = await qvac.translate(params);
  
  // translate() returns { text: Promise<string> }
  const translated = await result.text;
  
  log.info('qvac', 'Translate complete', { targetLang, length: translated.length });
  return translated;
}

/**
 * Stream translation tokens.
 * 
 * @param {string} nmtModelId - Loaded NMT model ID
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @param {Function} onToken - Callback(token: string)
 * @param {Object} opts - Options
 * @returns {Promise<string>} Full translated text
 */
async function translateStream(nmtModelId, text, targetLang, onToken, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'Translate stream', { textLength: text.length, targetLang });
  
  const params = {
    modelId: nmtModelId,
    text: text,
    to: targetLang,
  };
  
  if (opts.sourceLang) params.from = opts.sourceLang;
  
  const result = await qvac.translate(params);
  
  let fullText = '';
  
  // Stream tokens
  if (result.tokenStream) {
    for await (const token of result.tokenStream) {
      fullText += token;
      if (onToken) onToken(token);
    }
  }
  
  // Fallback: await text promise
  if (!fullText && result.text) {
    fullText = await result.text;
  }
  
  log.info('qvac', 'Translate stream complete', { length: fullText.length });
  return fullText;
}

// ============================================================
// OCR (Optical Character Recognition)
// ============================================================

/**
 * Perform OCR on an image to extract text.
 * 
 * ocr() returns:
 * - result.blocks: Promise<{ text, bbox?, confidence? }[]>
 * - result.blockStream: AsyncGenerator for streaming
 * - result.stats: Promise<Object>
 * 
 * @param {string} modelId - Loaded model ID (VLM or OCR model)
 * @param {Buffer} imageBuffer - Image data
 * @param {Object} opts - Options
 * @returns {Promise<{ text: string, blocks: Array, stats: Object }>}
 */
async function ocrImage(modelId, imageBuffer, opts = {}) {
  const qvac = getQVAC();
  
  log.info('qvac', 'OCR request', { imageSize: imageBuffer.length });
  
  const params = {
    modelId: modelId,
    image: imageBuffer,
  };
  
  if (opts.language) params.language = opts.language;
  
  const result = await qvac.ocr(params);
  
  // ocr() returns { blocks: Promise<{text, bbox, confidence}[]> }
  const blocks = await result.blocks;
  const text = blocks.map(b => b.text).join('\n');
  
  let stats = null;
  if (result.stats) {
    try { stats = await result.stats; } catch (e) { log.warn("utils.qvac_wrapper", "Caught error", { error: e.message }); }
  }
  
  log.info('qvac', 'OCR complete', { blocks: blocks.length, textLength: text.length });
  return { text, blocks, stats };
}

// ============================================================
// IMAGE UPSCALING (Diffusion)
// ============================================================

/**
 * Upscale an image using ESRGAN (diffusion model).
 * 
 * The model must be loaded with modelType: "diffusion" and mode: "upscale".
 * 
 * @param {string} diffusionModelId - Loaded diffusion model ID
 * @param {Buffer} imageBuffer - Image to upscale
 * @param {number} scale - Scale factor (2 or 4)
 * @returns {Promise<Buffer>} Upscaled image
 */
async function upscaleImage(diffusionModelId, imageBuffer, scale = 2) {
  const qvac = getQVAC();
  
  log.info('qvac', 'Upscale request', { imageSize: imageBuffer.length, scale });
  
  const result = await qvac.upscale({
    modelId: diffusionModelId,
    image: imageBuffer,
    scale: scale,
  });
  
  // upscale() returns { outputs: Promise<Buffer[]> }
  const outputs = await (result.outputs || result.images || result);
  const upscaled = Array.isArray(outputs) ? outputs[0] : outputs;
  
  log.info('qvac', 'Upscale complete', { outputSize: upscaled?.length });
  return upscaled;
}

// ============================================================
// MODEL MANAGEMENT
// ============================================================

/**
 * Get info about a loaded model.
 * Uses getLoadedModelInfo() which returns modelType, handlers, memory, etc.
 * 
 * @param {string} modelId - Loaded model ID
 * @returns {Promise<Object>} Model info
 */
async function getLoadedModelInfo(modelId) {
  const qvac = getQVAC();
  try {
    const info = await qvac.getLoadedModelInfo({ modelId });
    log.debug('qvac', 'Loaded model info', { 
      modelId, 
      type: info.modelType, 
      handlers: info.handlers,
      isDelegated: info.isDelegated 
    });
    return info;
  } catch (e) {
    log.warn('qvac', 'getLoadedModelInfo failed', { error: e.message });
    return null;
  }
}

/**
 * Get catalog info for a model (cache state, loaded instances).
 * 
 * @param {string} modelName - Model name in catalog
 * @returns {Promise<Object>} Catalog info
 */
async function getCatalogInfo(modelName) {
  const qvac = getQVAC();
  try {
    // Real @qvac/sdk API takes { name }, not { modelId } — the old param name
    // was silently ignored by the SDK, making this call always fail/return undefined.
    const info = await qvac.getModelInfo({ name: modelName });
    log.info('qvac', 'Catalog info', { model: modelName, info });
    return info;
  } catch (e) {
    log.warn('qvac', 'getModelInfo failed', { error: e.message });
    return null;
  }
}

/**
 * Unload a model to free memory.
 * 
 * @param {string} modelId - Loaded model ID
 */
async function unloadModel(modelId) {
  const qvac = getQVAC();
  try {
    await qvac.unloadModel({ modelId });
    log.info('qvac', 'Model unloaded', { modelId });
  } catch (e) {
    log.warn('qvac', 'unloadModel failed', { error: e.message });
  }
}

// ============================================================
// MODEL REGISTRY
// ============================================================

/**
 * Search the model registry for models matching criteria.
 * 
 * @param {Object} opts - Search criteria
 * @returns {Promise<Array>} Matching models
 */
async function registrySearch(opts = {}) {
  const qvac = getQVAC();
  try {
    const result = await qvac.modelRegistrySearch(opts);
    return result.models || result.matches || result || [];
  } catch (e) {
    log.error('qvac', 'registrySearch failed', { error: e.message });
    return [];
  }
}

/**
 * List all available models in the registry.
 * 
 * @returns {Promise<Array>} All models
 */
async function registryList() {
  const qvac = getQVAC();
  try {
    const result = await qvac.modelRegistryList({});
    return result.models || result || [];
  } catch (e) {
    log.error('qvac', 'registryList failed', { error: e.message });
    return [];
  }
}

// ============================================================
// PROVIDER MANAGEMENT
// ============================================================

/**
 * Start the QVAC provider (local server).
 * @param {Object} opts - Provider options
 * @returns {Promise<void>}
 */
async function startProvider(opts = {}) {
  const qvac = getQVAC();
  try {
    await qvac.startQVACProvider(opts);
    log.info('qvac', 'Provider started');
  } catch (e) {
    log.error('qvac', 'startQVACProvider failed', { error: e.message });
  }
}

/**
 * Stop the QVAC provider.
 */
async function stopProvider() {
  const qvac = getQVAC();
  try {
    await qvac.stopQVACProvider({});
    log.info('qvac', 'Provider stopped');
  } catch (e) {
    log.error('qvac', 'stopQVACProvider failed', { error: e.message });
  }
}

// ============================================================
// CACHE MANAGEMENT
// ============================================================

/**
 * Delete model cache to free disk space.
 * @param {Object} opts - Options
 */
async function deleteCache(opts = {}) {
  const qvac = getQVAC();
  try {
    await qvac.deleteCache(opts);
    log.info('qvac', 'Cache deleted');
  } catch (e) {
    log.warn('qvac', 'deleteCache failed', { error: e.message });
  }
}

/**
 * Download a model asset.
 * @param {string} modelSrc - Model to download
 * @param {Function} onProgress - Progress callback
 */
async function downloadAsset(modelSrc, onProgress) {
  const qvac = getQVAC();
  try {
    const params = { modelSrc };
    if (onProgress) params.onProgress = onProgress;
    await qvac.downloadAsset(params);
    log.info('qvac', 'Asset downloaded', { modelSrc });
  } catch (e) {
    log.error('qvac', 'downloadAsset failed', { error: e.message });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Core
  getQVAC,
  healthCheck,
  
  // Model loading
  loadLLM,
  loadVLM,
  loadWhisper,
  loadTTS,
  loadNMT,
  loadEmbedder,
  loadDiffusion,
  
  // Completion
  chat,
  chatStream,
  describeImage,
  
  // Embeddings
  embed,
  cosineSimilarity,
  
  // RAG
  ragIngest,
  ragSearch,
  ragList,
  ragClose,
  ragDelete,
  ragReindex,
  
  // Fine-tuning
  finetuneRun,
  finetuneState,
  finetuneSuspend,
  finetuneResume,
  finetuneCancel,
  
  // TTS
  tts,
  ttsStream,
  pcmToWav,
  
  // STT
  stt,
  sttStream,
  
  // Translation
  translateText,
  translateStream,
  
  // OCR
  ocrImage,
  
  // Upscaling
  upscaleImage,
  
  // Model management
  getLoadedModelInfo,
  getCatalogInfo,
  unloadModel,
  
  // Registry
  registrySearch,
  registryList,
  
  // Provider
  startProvider,
  stopProvider,
  
  // Cache
  deleteCache,
  downloadAsset,
};

/**
 * MISTER — QVAC Bridge Server
 *
 * Small Express server that exposes real on-device QVAC inference
 * (Qwen3-1.7B-Q4, as configured in config/default.json) over HTTP so the
 * browser demo (demo/) can call it instead of using canned/keyword-matched
 * responses.
 *
 * Reuses the existing model-loading + completion logic in
 * src/utils/qvac_wrapper.js (same wrapper the Electron app and
 * src/inference/chat.js use) — no reimplementation of QVAC calls here.
 *
 * Routes:
 *   GET  /health  -> liveness + model-load status
 *   POST /chat    -> { message: string } -> { reply: string }
 *
 * Designed to run inside a Docker container on Hugging Face Spaces
 * (listens on process.env.PORT || 7860, the port HF Spaces Docker SDK
 * expects).
 */

const express = require('express');
const path = require('path');
const qvac = require('../src/utils/qvac_wrapper');
const config = require('../config/default.json');

const PORT = process.env.PORT || 7860;

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS: allow the static demo (served from GitHub Pages / anywhere) to call this bridge.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- Model state ----
let modelId = null;
let modelReady = false;
let modelLoading = true;
let modelError = null;
let loadStartedAt = Date.now();

const SYSTEM_PROMPT =
  "You are the club brain for FC Metall Nord. You think and speak in the style of this " +
  "club's game model: verticality over possession, press from the front, compact " +
  "rest-defence, flank overloads, transition lock. Use the club's terminology naturally. " +
  "Answer as the coach's assistant would — direct, tactical, in the club's voice. Keep " +
  "answers concise (a few sentences).";

async function initModel() {
  modelLoading = true;
  modelError = null;
  loadStartedAt = Date.now();
  try {
    console.log(`[bridge] Loading model ${config.model.llmCatalogName} (${config.model.llm}) ...`);
    // Prefer the catalog constant name (matches config.model.llmCatalogName),
    // falling back to the raw registry:// src if that fails.
    modelId = await qvac.loadLLM(config.model.llmCatalogName, {
      quantization: config.model.quantization,
    });
    modelReady = true;
    modelLoading = false;
    console.log(`[bridge] Model ready: ${modelId} (loaded in ${Date.now() - loadStartedAt}ms)`);
  } catch (e1) {
    console.warn(`[bridge] loadLLM(catalogName) failed: ${e1.message}. Retrying with registry src URL...`);
    try {
      modelId = await qvac.loadLLM(config.model.llm, {
        quantization: config.model.quantization,
      });
      modelReady = true;
      modelLoading = false;
      console.log(`[bridge] Model ready via registry src: ${modelId} (loaded in ${Date.now() - loadStartedAt}ms)`);
    } catch (e2) {
      modelError = e2.message;
      modelLoading = false;
      console.error('[bridge] Model load failed:', e2);
    }
  }
}

initModel();

// ---- Routes ----
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    modelReady,
    modelLoading,
    modelError,
    uptimeMs: Date.now() - loadStartedAt,
  });
});

app.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Body must be JSON: { "message": "<string>" }' });
  }

  if (!modelReady) {
    if (modelError) {
      return res.status(503).json({ error: `Model failed to load: ${modelError}` });
    }
    return res.status(503).json({ error: 'Model still loading (cold start) — retry in a few seconds.' });
  }

  try {
    const history = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];

    const t0 = Date.now();
    const answer = await qvac.chat(modelId, history, {
      maxTokens: config.model.maxTokens,
      temperature: config.model.temperature,
    });
    console.log(`[bridge] /chat answered in ${Date.now() - t0}ms (len=${answer.length})`);

    res.json({ reply: answer });
  } catch (e) {
    console.error('[bridge] /chat error:', e);
    res.status(500).json({ error: e.message || 'inference error' });
  }
});

app.get('/', (req, res) => {
  res.json({ service: 'mister-qvac-bridge', health: '/health', chat: 'POST /chat { message }' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[bridge] MISTER QVAC bridge listening on port ${PORT}`);
});

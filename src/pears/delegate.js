/**
 * MISTER — P2P Inference Delegation — v5 FIXED
 * 
 * NO fake qvac.inference.serve/connect. Uses Hyperswarm + qvac_wrapper.chat().
 * Server (laptop): loads model, serves completions over P2P.
 * Client (phone): sends queries, gets responses.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { fileExists } = require('../utils/helpers');

async function main() {
  const isServer = process.argv.includes('--server');
  const isClient = process.argv.includes('--client');
  const adapter = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
  const topicKey = process.argv.find(a => a.startsWith('--topic='))?.split('=')[1];

  let Hyperswarm;
  try { Hyperswarm = require('hyperswarm'); }
  catch { log.error('delegate', 'hyperswarm not found. npm install hyperswarm'); process.exit(1); }

  if (isServer) await runServer(Hyperswarm, adapter);
  else if (isClient) {
    if (!topicKey) { log.error('delegate', 'Client needs --topic <key>'); process.exit(1); }
    await runClient(Hyperswarm, topicKey);
  } else {
    console.error('Server: node src/pears/delegate.js --server [--adapter <path>]');
    console.error('Client: node src/pears/delegate.js --client --topic <key>');
    process.exit(1);
  }
}

async function runServer(Hyperswarm, adapter) {
  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) { log.error('delegate', 'QVAC provider not running'); process.exit(1); }

  // --- Load model ---
  const modelId = await qvac.loadLLM(config.model.llm, {
    quantization: config.model.quantization,
    lora: adapter && fileExists(adapter) ? adapter : undefined,
  });
  log.info('delegate', 'Model loaded', { model: config.model.llm, adapter: adapter || 'none' });

  // --- Start P2P server ---
  const topic = crypto.randomBytes(32);
  const swarm = new Hyperswarm();
  swarm.join(topic, { client: false, server: true });

  swarm.on('connection', (socket) => {
    log.info('delegate', 'Client connected');

    socket.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString());
        log.info('delegate', 'Request', { promptLength: request.prompt?.length });

        // Use wrapper: chat() with correct completion API
        const t0 = Date.now();
        const response = await qvac.chat(modelId,
          request.messages || [{ role: 'user', content: request.prompt }],
          { maxTokens: request.maxTokens || config.model.maxTokens, temperature: request.temperature || config.model.temperature }
        );

        const result = { text: response, timeMs: Date.now() - t0 };
        socket.write(JSON.stringify(result));
        log.metric('delegate', 'inference_time_ms', result.timeMs);
      } catch (err) {
        log.error('delegate', 'Request error', { error: err.message });
        socket.write(JSON.stringify({ error: err.message }));
      }
    });

    socket.on('close', () => log.info('delegate', 'Client disconnected'));
  });

  console.log('\n═══════════════════════════════════════════════');
  console.log('  MISTER Inference Server (P2P)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Model: ${config.model.llm}`);
  console.log(`  Adapter: ${adapter || 'none'}`);
  console.log(`  Topic: ${topic.toString('hex')}`);
  console.log(`\n  Client: node src/pears/delegate.js --client --topic ${topic.toString('hex')}`);
  console.log('═══════════════════════════════════════════════\n');
  console.log('  Waiting for connections... (Ctrl+C to stop)\n');
}

async function runClient(Hyperswarm, topicKey) {
  const swarm = new Hyperswarm();
  const topic = Buffer.from(topicKey, 'hex');
  swarm.join(topic, { client: true, server: false });

  let connected = false;

  swarm.on('connection', (socket) => {
    connected = true;
    log.info('delegate', 'Connected to server');
    console.log('\n✓ Connected! Type your question (or "quit"):\n');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    socket.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.error) console.error(`\nError: ${response.error}\n`);
        else {
          console.log(`\n${response.text}\n`);
          if (response.timeMs) console.log(`  [${response.timeMs}ms via P2P]\n`);
        }
      } catch (e) { log.warn("pears.delegate", "Caught error", { error: e.message }); }
    });

    socket.on('close', () => { console.log('\nServer disconnected.'); rl.close(); swarm.destroy(); });

    rl.on('line', (query) => {
      if (query.toLowerCase() === 'quit') { rl.close(); swarm.destroy(); return; }
      socket.write(JSON.stringify({ prompt: query }));
    });
  });

  setTimeout(() => {
    if (!connected) { console.error('Connection timeout.'); swarm.destroy(); process.exit(1); }
  }, 30000);
}

main().catch(err => { log.error('delegate', 'Error', { error: err.message }); process.exit(1); });

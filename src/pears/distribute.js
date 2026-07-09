/**
 * MISTER — Pears Adapter Distribution
 * 
 * Distributes the tiny .gguf LoRA adapter to coaching staff via P2P.
 * Uses Hyperswarm/Hyperblobs from the Pears stack.
 * 
 * Usage: node src/pears/distribute.js --adapter adapters/adapter.gguf
 *        node src/pears/distribute.js --receive --topic <topic-key>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const { ensureDir, writeJSON, readJSON, fileExists, generateId, hashString } = require('../utils/helpers');

const ADAPTER = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
const TOPIC = process.argv.find(a => a.startsWith('--topic='))?.split('=')[1];
const RECEIVE = process.argv.includes('--receive');
const QR_MODE = process.argv.includes('--qr');

/**
 * Generate a QR code SVG for a topic key (no external dependency).
 * Uses a simple QR-like visual representation for demo purposes.
 * In production, use the `qrcode` npm package: npm install qrcode
 */
function generateQRSVG(topicKey, size = 256) {
  // Try to use qrcode library if available
  try {
    const QRCode = require('qrcode');
    // Sync generation for SVG
    const svg = QRCode.toStringSync(topicKey, { type: 'svg', width: size, margin: 2 });
    return svg;
  } catch (e) {
    // Fallback: generate a visual placeholder with the topic key
    log.warn('distribute', 'qrcode package not found — generating visual placeholder. Install: npm install qrcode');
    const hex = topicKey.substring(0, 16);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="white"/>
  <text x="${size/2}" y="${size/2 - 20}" text-anchor="middle" font-family="monospace" font-size="14" fill="black">Scan to connect</text>
  <rect x="40" y="40" width="${size-80}" height="${size-80}" fill="none" stroke="black" stroke-width="2" stroke-dasharray="8,4"/>
  <text x="${size/2}" y="${size/2 + 10}" text-anchor="middle" font-family="monospace" font-size="11" fill="black">${hex}...</text>
  <text x="${size/2}" y="${size/2 + 30}" text-anchor="middle" font-family="monospace" font-size="9" fill="#666">Pears P2P · Hyperswarm</text>
</svg>`;
  }
}

/**
 * Save QR code as SVG file.
 */
function saveQRCode(topicKey, outputDir) {
  ensureDir(outputDir);
  const svg = generateQRSVG(topicKey);
  const qrPath = path.join(outputDir, 'adapter_qr.svg');
  fs.writeFileSync(qrPath, svg);
  log.info('distribute', 'QR code saved', { path: qrPath });
  
  // Also save the topic key as text for manual sharing
  const keyPath = path.join(outputDir, 'topic_key.txt');
  fs.writeFileSync(keyPath, topicKey);
  log.info('distribute', 'Topic key saved', { path: keyPath });
  
  return qrPath;
}

async function main() {
  console.log('MISTER — Pears Adapter Distribution');
  console.log('=====================================');

  // --- Load Pears modules ---
  let Hyperswarm, Hyperblobs, Corestore;
  try {
    Hyperswarm = require('hyperswarm');
    Hyperblobs = require('hyperblobs');
    Corestore = require('corestore');
  } catch (e) {
    console.error('✗ Pears modules not found. Run: npm install hyperswarm hyperblobs corestore');
    process.exit(1);
  }

  const store = new Corestore('./peers-storage');
  const swarm = new Hyperswarm();

  if (RECEIVE && TOPIC) {
    // --- Receiver mode: download adapter from peer ---
    console.log(`Mode: RECEIVE`);
    console.log(`Topic: ${TOPIC}`);

    const topicKey = Buffer.from(TOPIC, 'hex');
    const discovery = swarm.join(topicKey, { client: true, server: false });
    
    console.log('Looking for sender...');
    
    swarm.on('connection', async (socket) => {
      console.log('✓ Connected to sender');
      const blobs = new Hyperblobs(store.get({ name: 'adapter-blobs' }));
      // Receive blob
      const adapterData = await blobs.get(topicKey);
      const outputPath = 'received_adapter.gguf';
      fs.writeFileSync(outputPath, adapterData);
      console.log(`✓ Adapter received and saved: ${outputPath}`);
      console.log(`  Size: ${(adapterData.length / 1024 / 1024).toFixed(1)} MB`);
      swarm.destroy();
    });

  } else if (ADAPTER) {
    // --- Sender mode: distribute adapter ---
    if (!fs.existsSync(ADAPTER)) {
      console.error(`✗ Adapter not found: ${ADAPTER}`);
      process.exit(1);
    }

    const adapterData = fs.readFileSync(ADAPTER);
    console.log(`Mode: SEND`);
    console.log(`Adapter: ${ADAPTER}`);
    console.log(`Size: ${(adapterData.length / 1024 / 1024).toFixed(1)} MB`);

    const blobs = new Hyperblobs(store.get({ name: 'adapter-blobs' }));
    const blobId = await blobs.put(adapterData);
    
    // Create topic from adapter hash
    const hash = crypto.createHash('sha256').update(adapterData).digest();
    const topic = hash.slice(0, 32);
    
    swarm.join(topic, { client: false, server: true });
    
    const topicHex = topic.toString('hex');
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Adapter ready for distribution!');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Topic key: ${topicHex}`);
    console.log();
    console.log('  Share this command with your staff:');
    console.log(`  node src/pears/distribute.js --receive --topic ${topicHex}`);
    console.log('═══════════════════════════════════════════════');
    console.log();
    console.log('Waiting for connections... (Ctrl+C to stop)');

    swarm.on('connection', (socket) => {
      console.log('✓ Staff member connected, sending adapter...');
    });

  } else {
    console.error('Usage:');
    console.error('  Send:    node src/pears/distribute.js --adapter adapters/adapter.gguf');
    console.error('  Receive: node src/pears/distribute.js --receive --topic <topic-key>');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Pears error:', err);
  process.exit(1);
});

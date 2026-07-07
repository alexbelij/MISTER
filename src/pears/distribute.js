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

const ADAPTER = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
const TOPIC = process.argv.find(a => a.startsWith('--topic='))?.split('=')[1];
const RECEIVE = process.argv.includes('--receive');

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
    const crypto = require('crypto');
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

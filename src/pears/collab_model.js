/**
 * MISTER — Collaborative Game Model (Pears Autobase)
 * 
 * Multi-writer append-only log for the club's game model.
 * Coaches, analysts, and players can contribute observations.
 * The game model evolves over time — and every change is tracked.
 * 
 * Uses Autobase (multi-writer) + Hypercore (tamper-evident) from Pears.
 * No server, no database — the game model lives in the P2P network.
 * 
 * Usage:
 *   node src/pears/collab_model.js --init --club "FC Metall Nord"
 *   node src/pears/collab_model.js --add "Pressed high against Hafen, Mahler cracked under pressure"
 *   node src/pears/collab_model.js --view
 *   node src/pears/collab_model.js --sync --topic <key>
 *   node src/pears/collab_model.js --export game_model_log.json
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const { ensureDir, writeJSON, generateId } = require('../utils/helpers');

const STORAGE_DIR = path.join(process.cwd(), config.pears.storageDir, 'game-model');
const LOG_FILE = path.join(STORAGE_DIR, 'local_log.jsonl');

async function main() {
  const action = process.argv.find(a => a.startsWith('--'))?.replace('--', '');

  switch (action) {
    case 'init':
      await initGameModel();
      break;
    case 'add':
      await addObservation();
      break;
    case 'view':
      await viewLog();
      break;
    case 'export':
      await exportLog();
      break;
    case 'sync':
      await syncP2P();
      break;
    default:
      printUsage();
  }
}

async function initGameModel() {
  const clubName = process.argv.find(a => a.startsWith('--club='))?.split('=')[1] || 'FC Metall Nord';

  ensureDir(STORAGE_DIR);

  // Initialize local log
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }

  // Load Pears modules for Autobase
  let Corestore, Autobase;
  try {
    Corestore = require('corestore');
    Autobase = require('autobase');
  } catch (e) {
    log.warn('collab', 'Pears modules not installed, using local file log only', { hint: 'npm install corestore autobase' });
  }

  const store = new Corestore(STORAGE_DIR);

  // Create or load Autobase
  let autobase;
  if (Autobase) {
    autobase = new Autobase({
      store,
      name: 'game-model',
    });
    log.info('collab', 'Autobase initialized', { club: clubName });
  }

  // Add initial entry
  const initEntry = {
    id: generateId('gmi'),
    type: 'init',
    club: clubName,
    timestamp: new Date().toISOString(),
    author: 'system',
    content: `Game model initialized for ${clubName}`,
  };

  appendLocal(initEntry);

  if (autobase) {
    await autobase.append(JSON.stringify(initEntry));
  }

  console.log(`✓ Game model initialized for ${clubName}`);
  console.log(`  Storage: ${STORAGE_DIR}`);
  console.log(`  Log: ${LOG_FILE}`);
}

async function addObservation() {
  const content = process.argv.find(a => a.startsWith('--content='))?.split('=')[1]
    || process.argv.find(a => a.startsWith('--add='))?.split('=')[1];

  if (!content) {
    log.error('collab', 'No content provided. Use --add="observation" or --content="text"');
    process.exit(1);
  }

  const type = process.argv.find(a => a.startsWith('--type='))?.split('=')[1] || 'observation';
  const author = process.argv.find(a => a.startsWith('--author='))?.split('=')[1] || 'coach';

  const entry = {
    id: generateId('obs'),
    type,
    author,
    content,
    timestamp: new Date().toISOString(),
  };

  appendLocal(entry);

  // Try to append to Autobase if available
  try {
    let Corestore, Autobase;
    Corestore = require('corestore');
    Autobase = require('autobase');

    const store = new Corestore(STORAGE_DIR);
    const autobase = new Autobase({ store, name: 'game-model' });
    await autobase.append(JSON.stringify(entry));
    log.info('collab', 'Observation added to Autobase', { id: entry.id });
  } catch (e) {
    log.info('collab', 'Observation added to local log', { id: entry.id });
  }

  console.log(`✓ Observation added: ${content.substring(0, 80)}...`);
  console.log(`  ID: ${entry.id}`);
  console.log(`  Type: ${type}`);
  console.log(`  Author: ${author}`);
}

async function viewLog() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('No game model log found. Run --init first.');
    return;
  }

  const entries = fs.readFileSync(LOG_FILE, 'utf-8')
    .trim().split('\n')
    .filter(line => line.trim())
    .map(JSON.parse);

  console.log(`\nGame Model Log (${entries.length} entries)\n`);
  console.log('─'.repeat(80));

  for (const entry of entries) {
    const time = new Date(entry.timestamp).toLocaleString();
    console.log(`[${time}] ${entry.type} by ${entry.author}`);
    console.log(`  ${entry.content}`);
    console.log('─'.repeat(80));
  }

  log.metric('collab', 'log_entries', entries.length);
}

async function exportLog() {
  const outputPath = process.argv.find(a => a.startsWith('--export='))?.split('=')[1] || 'game_model_log.json';

  if (!fs.existsSync(LOG_FILE)) {
    console.log('No game model log found.');
    return;
  }

  const entries = fs.readFileSync(LOG_FILE, 'utf-8')
    .trim().split('\n')
    .filter(line => line.trim())
    .map(JSON.parse);

  writeJSON(outputPath, {
    exportedAt: new Date().toISOString(),
    entriesCount: entries.length,
    entries,
  });

  console.log(`✓ Exported ${entries.length} entries to ${outputPath}`);
}

async function syncP2P() {
  const topicKey = process.argv.find(a => a.startsWith('--topic='))?.split('=')[1];

  let Hyperswarm, Corestore, Autobase;
  try {
    Hyperswarm = require('hyperswarm');
    Corestore = require('corestore');
    Autobase = require('autobase');
  } catch (e) {
    log.error('collab', 'Pears modules not found. npm install hyperswarm corestore autobase');
    process.exit(1);
  }

  const store = new Corestore(STORAGE_DIR);
  const swarm = new Hyperswarm();

  if (topicKey) {
    // Join existing network
    const topic = Buffer.from(topicKey, 'hex');
    swarm.join(topic, { client: true, server: true });
    log.info('collab', 'Joining game model network', { topic: topicKey });
  } else {
    // Create new network
    const crypto = require('crypto');
    const topic = crypto.randomBytes(32);
    swarm.join(topic, { client: false, server: true });

    console.log('\n═══════════════════════════════════════════════');
    console.log('  Collaborative Game Model — P2P Network');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Topic: ${topic.toString('hex')}`);
    console.log();
    console.log('  Share with staff:');
    console.log(`  node src/pears/collab_model.js --sync --topic ${topic.toString('hex')}`);
    console.log('═══════════════════════════════════════════════\n');
  }

  swarm.on('connection', (socket) => {
    log.info('collab', 'Peer connected');

    // Sync local log to peer
    if (fs.existsSync(LOG_FILE)) {
      const localData = fs.readFileSync(LOG_FILE, 'utf-8');
      socket.write(localData);
    }

    socket.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Merge: only add if we don't have this ID
          const existing = fs.existsSync(LOG_FILE)
            ? fs.readFileSync(LOG_FILE, 'utf-8')
            : '';
          if (!existing.includes(entry.id)) {
            appendLocal(entry);
            log.info('collab', 'Synced entry from peer', { id: entry.id });
          }
        } catch { /* partial data */ }
      }
    });
  });

  console.log('Syncing... (Ctrl+C to stop)');
}

function appendLocal(entry) {
  ensureDir(STORAGE_DIR);
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

function printUsage() {
  console.log('MISTER — Collaborative Game Model');
  console.log('');
  console.log('Usage:');
  console.log('  --init --club="FC Metall Nord"     Initialize game model log');
  console.log('  --add="observation text"            Add observation');
  console.log('  --add="text" --type=match --author=coach  Add with metadata');
  console.log('  --view                              View all entries');
  console.log('  --export game_model_log.json        Export to JSON');
  console.log('  --sync [--topic <key>]              Start/join P2P sync');
  console.log('');
  console.log('Types: observation, match, training, principle, adjustment, player_note');
}

main().catch(err => {
  log.error('collab', 'Game model error', { error: err.message });
  process.exit(1);
});

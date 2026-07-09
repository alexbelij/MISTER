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

// ── Shared Autobase instance ──
let _store = null;
let _autobase = null;

/**
 * Open (or reuse) the Autobase + Corestore for this game-model.
 * Falls back to local JSONL if Pears modules are not installed.
 */
async function openAutobase() {
  if (_autobase) return _autobase;

  const Corestore = require('corestore');
  const Autobase = require('autobase');

  ensureDir(STORAGE_DIR);
  _store = new Corestore(path.join(STORAGE_DIR, 'cores'));
  _autobase = new Autobase(_store, {
    valueEncoding: 'json',
    open(store) {
      // linearised output core — Autobase merges all writers here
      return store.get({ name: 'game-model-view' });
    },
    async apply(nodes, view, host) {
      // apply() is called by Autobase when it linearises writes.
      // Each node.value is the JSON entry we appended.
      for (const node of nodes) {
        await view.append(node.value);
      }
    },
  });

  await _autobase.ready();
  log.info('collab', 'Autobase ready', { writers: _autobase.inputs?.length || 1 });
  return _autobase;
}

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

  const initEntry = {
    id: generateId('gmi'),
    type: 'init',
    club: clubName,
    timestamp: new Date().toISOString(),
    author: 'system',
    content: `Game model initialized for ${clubName}`,
  };

  try {
    const ab = await openAutobase();
    await ab.append(JSON.stringify(initEntry));
    log.info('collab', 'Init entry appended to Autobase', { club: clubName });
  } catch (e) {
    log.warn('collab', 'Autobase unavailable, using local log', { err: e.message });
  }

  // Always mirror to local JSONL as backup
  appendLocal(initEntry);

  console.log(`✓ Game model initialized for ${clubName}`);
  console.log(`  Storage: ${STORAGE_DIR}`);
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

  // Primary: Autobase
  try {
    const ab = await openAutobase();
    await ab.append(JSON.stringify(entry));
    log.info('collab', 'Observation appended to Autobase', { id: entry.id });
  } catch (e) {
    log.warn('collab', 'Autobase unavailable, local only', { err: e.message });
  }

  // Backup: local JSONL
  appendLocal(entry);

  console.log(`✓ Observation added: ${content.substring(0, 80)}${content.length > 80 ? '…' : ''}`);
  console.log(`  ID: ${entry.id} | Type: ${type} | Author: ${author}`);
}

/**
 * Read entries from Autobase linearised view first, fall back to JSONL.
 */
async function readEntries() {
  try {
    const ab = await openAutobase();
    await ab.update();
    const view = ab.view;
    const len = view.length;
    const entries = [];
    for (let i = 0; i < len; i++) {
      const block = await view.get(i);
      if (block) {
        const entry = typeof block === 'string' ? JSON.parse(block) : block;
        entries.push(entry);
      }
    }
    if (entries.length > 0) {
      log.info('collab', 'Read from Autobase view', { count: entries.length });
      return entries;
    }
  } catch (e) {
    log.warn('collab', 'Autobase read failed, falling back to JSONL', { err: e.message });
  }

  // Fallback: JSONL
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf-8')
    .trim().split('\n')
    .filter(line => line.trim())
    .map(JSON.parse);
}

async function viewLog() {
  const entries = await readEntries();

  if (entries.length === 0) {
    console.log('No game model log found. Run --init first.');
    return;
  }

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

  const entries = await readEntries();

  if (entries.length === 0) {
    console.log('No game model log found.');
    return;
  }

  writeJSON(outputPath, {
    exportedAt: new Date().toISOString(),
    entriesCount: entries.length,
    entries,
  });

  console.log(`✓ Exported ${entries.length} entries to ${outputPath}`);
}

async function syncP2P() {
  const topicKey = process.argv.find(a => a.startsWith('--topic='))?.split('=')[1];

  const Hyperswarm = require('hyperswarm');

  const ab = await openAutobase();
  const swarm = new Hyperswarm();

  // Replicate Autobase's underlying corestore over every Hyperswarm connection.
  // This is the real Pears replication protocol — no manual socket.write/read.
  swarm.on('connection', (socket) => {
    log.info('collab', 'Peer connected — replicating Autobase');
    _store.replicate(socket);
  });

  if (topicKey) {
    const topic = Buffer.from(topicKey, 'hex');
    swarm.join(topic, { client: true, server: true });
    log.info('collab', 'Joining game model network', { topic: topicKey });
    console.log(`Joined game model network: ${topicKey}`);
  } else {
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

  console.log('Syncing via Autobase replication... (Ctrl+C to stop)');
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

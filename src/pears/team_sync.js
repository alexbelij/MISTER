/**
 * MISTER — Team Sync (Pears)
 *
 * P2P team channel over Hyperswarm. One topic per team, derived from the
 * team's owner-pubkey. Peers exchange:
 *   1. handshake: their pubkey (from identity/keypair)
 *   2. manifest request/response (owner is the source of truth)
 *   3. team data (append-only Hypercore blocks, replicated by Autobase)
 *
 * Access control is enforced by team_manifest — a peer that isn't in
 * `members` gets its handshake ignored and no data is served.
 *
 * Runs on the Pears stack (Bare / Node). Wire-format = length-prefixed JSON
 * messages over the Hyperswarm noise-encrypted connection, so no separate
 * transport encryption is needed for the handshake exchange.
 *
 * Usage:
 *   node src/pears/team_sync.js --create --name "FC Alexandria U-15"
 *   node src/pears/team_sync.js --join   --team <team_id>
 */

'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadOrCreate } = require('../identity/keypair');
const {
  createTeam, verifyManifest, roleOf, hasScope,
} = require('../identity/team_manifest');

const TOPIC_NS = 'mister-team-v1';
const MISTER_HOME = path.join(os.homedir(), 'mister', 'data');
const TEAMS_DIR   = path.join(MISTER_HOME, 'teams');

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

/**
 * Deterministic Hyperswarm topic (32 bytes) from a team_id.
 * SHA-256 domain-separated so scanning peers can't correlate topics
 * across MISTER and other Pears apps.
 */
function topicFor(teamId) {
  return crypto.createHash('sha256').update(TOPIC_NS + '|' + teamId).digest();
}

function teamDir(teamId) {
  return path.join(TEAMS_DIR, teamId.slice(0, 16));
}

function saveManifest(manifest) {
  const dir = teamDir(manifest.team_id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

function loadManifest(teamId) {
  const p = path.join(teamDir(teamId), 'manifest.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/**
 * Framing: length-prefixed JSON. 4-byte BE uint32 length, then UTF-8 bytes.
 * Small, dependency-free, deterministic.
 */
function encode(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf-8');
  const len  = Buffer.alloc(4);
  len.writeUInt32BE(body.length, 0);
  return Buffer.concat([len, body]);
}

function createFrameReader(onMessage) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);
      if (buf.length < 4 + len) return;
      const body = buf.subarray(4, 4 + len);
      buf = buf.subarray(4 + len);
      try { onMessage(JSON.parse(body.toString('utf-8'))); }
      catch (e) { /* skip malformed */ }
    }
  };
}

/**
 * Create a new team, persist manifest, print topic + invite payload.
 * The caller becomes head_coach.
 */
async function createAndAnnounce({ name }) {
  const id = await loadOrCreate();
  const manifest = await createTeam(id, { name });
  saveManifest(manifest);
  const topic = topicFor(manifest.team_id);

  return {
    team_id:  manifest.team_id,
    owner:    id.publicKey,
    topic_hex: topic.toString('hex'),
    invite:   `mister://team/${manifest.team_id}?topic=${topic.toString('hex')}`,
    manifest_path: path.join(teamDir(manifest.team_id), 'manifest.json'),
  };
}

/**
 * Start swarming the team topic. Returns a controller {swarm, connections}.
 * On each incoming connection we run the handshake:
 *   → send {t:"hello", pub: <ourPubkey>}
 *   ← expect {t:"hello", pub: <theirPubkey>}
 *   if we hold the manifest and they are members → serve manifest + data
 *   else → they'll serve us
 */
async function startSync({ teamId, onEvent = () => {} }) {
  let Hyperswarm;
  try { Hyperswarm = require('hyperswarm'); }
  catch (e) {
    onEvent({ level: 'warn', msg: 'hyperswarm not installed — running in offline stub mode' });
    return { swarm: null, offline: true };
  }

  const id = await loadOrCreate();
  const swarm = new Hyperswarm();
  const topic = topicFor(teamId);
  swarm.join(topic, { server: true, client: true });

  swarm.on('connection', (socket, info) => {
    onEvent({ level: 'info', msg: 'peer connected', remote: info.publicKey?.toString('hex').slice(0, 16) });

    const state = { theirPubkey: null };
    const read  = createFrameReader(async (msg) => {
      if (msg.t === 'hello' && msg.pub) {
        state.theirPubkey = msg.pub;
        const manifest = loadManifest(teamId);
        if (!manifest) return;
        const role = roleOf(manifest, msg.pub);
        onEvent({ level: 'info', msg: 'peer role', pubkey: msg.pub.slice(0, 16), role });
        if (!role) {
          onEvent({ level: 'warn', msg: 'peer not a member — closing', pubkey: msg.pub.slice(0, 16) });
          socket.destroy();
          return;
        }
        socket.write(encode({ t: 'manifest', manifest }));
      } else if (msg.t === 'manifest' && msg.manifest) {
        const ok = await verifyManifest(msg.manifest, id);
        if (ok) {
          saveManifest(msg.manifest);
          onEvent({ level: 'info', msg: 'manifest received + verified', name: msg.manifest.name });
        } else {
          onEvent({ level: 'warn', msg: 'manifest verification failed — discarded' });
        }
      }
    });

    socket.on('data', read);
    socket.on('error', () => {});
    socket.write(encode({ t: 'hello', pub: id.publicKey }));
  });

  onEvent({ level: 'info', msg: 'swarming team topic', topic: topic.toString('hex').slice(0, 16) });
  return { swarm, topic, id };
}

/**
 * Convenience CLI entry.
 *   node src/pears/team_sync.js --create --name "FC Alexandria U-15"
 *   node src/pears/team_sync.js --join --team <team_id>
 *   node src/pears/team_sync.js --topic --team <team_id>
 */
async function cli() {
  const args = process.argv.slice(2);
  const has  = (f) => args.includes(f);
  const val  = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

  if (has('--create')) {
    const name = val('--name');
    if (!name) { console.error('missing --name "<Team Name>"'); process.exit(1); }
    const r = await createAndAnnounce({ name });
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }

  if (has('--topic')) {
    const team = val('--team');
    if (!team) { console.error('missing --team <team_id>'); process.exit(1); }
    console.log(topicFor(team).toString('hex'));
    process.exit(0);
  }

  if (has('--join')) {
    const team = val('--team');
    if (!team) { console.error('missing --team <team_id>'); process.exit(1); }
    const ctrl = await startSync({ teamId: team, onEvent: (e) => console.log(JSON.stringify(e)) });
    if (ctrl.offline) process.exit(0);
    // keep alive
    console.log('sync running — Ctrl-C to stop');
    return;
  }

  console.log(`MISTER — Team Sync (Pears)
  --create --name "<Team Name>"       create + announce a new team
  --join   --team <team_id>            join the team topic and sync
  --topic  --team <team_id>            print the Hyperswarm topic hex`);
}

if (require.main === module) {
  cli().catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = {
  topicFor, createAndAnnounce, startSync, saveManifest, loadManifest,
  encode, createFrameReader,
};

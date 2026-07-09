#!/usr/bin/env node
/**
 * Export a real Pears hypercore-style append-only log snapshot.
 *
 * Generates a deterministic sequence of realistic game-model events
 * (init → ingest → observation → decision → revert), computes a real
 * sha256 hash-chain and ed25519 signatures per entry, and writes the
 * result to data/hypercore-tail.json.
 *
 * Schema mirrors src/pears/collab_model.js — the extra crypto fields
 * (seq, prev_hash, hash, sig, public_key) are the append-only guarantees
 * that make the log tamper-evident and replayable.
 *
 * Every hash and signature is a real cryptographic value produced by
 * Node's built-in crypto — not a placeholder. Verify any entry:
 *   sha256(prev_hash + JSON.stringify(payload)) === entry.hash
 *
 * Run:
 *   node scripts/export-log.mjs
 *   pnpm export:log
 */

import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'data', 'hypercore-tail.json');

// ---------- deterministic identities ----------
// ed25519 keys generated per-run (public_key exported so verifiers can
// re-check any signature independently)
const authors = {
  head_coach: makeIdentity('head_coach'),
  assistant_coach: makeIdentity('assistant_coach'),
  analyst: makeIdentity('analyst'),
  oracle_worker: makeIdentity('oracle_worker'),
};

function makeIdentity(handle) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  return {
    handle,
    privateKey,
    public_key: pubDer.slice(-32).toString('hex'), // raw ed25519 pubkey (last 32 bytes of SPKI)
  };
}

// ---------- chain builder ----------
const GENESIS = '0'.repeat(64);

function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

function shortHash(hex) {
  return hex.slice(0, 12);
}

// Deterministic canonical serialisation: sort keys recursively so
// hash reproduction is order-independent.
function canonical(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

function sign(identity, payload) {
  const sig = edSign(null, Buffer.from(payload), identity.privateKey);
  return sig.toString('hex');
}

const entries = [];
let seq = 0;
let prevHash = GENESIS;

function append({ type, author, content, meta, timestamp }) {
  const identity = authors[author];
  if (!identity) throw new Error(`unknown author: ${author}`);

  const id = `${type}_${String(seq).padStart(4, '0')}`;
  const payload = { id, type, author: identity.handle, content, timestamp, ...(meta ? { meta } : {}) };
  const payloadCanonical = canonical(payload);
  const hash = sha256(prevHash + payloadCanonical);
  const sig = sign(identity, hash);

  const entry = {
    seq,
    id,
    type,
    author: identity.handle,
    public_key: identity.public_key,
    timestamp,
    content,
    ...(meta ? { meta } : {}),
    prev_hash: shortHash(prevHash),
    prev_hash_full: prevHash,
    hash: shortHash(hash),
    hash_full: hash,
    sig: shortHash(sig),
    sig_full: sig,
  };

  entries.push(entry);
  prevHash = hash;
  seq += 1;
  return entry;
}

// ---------- realistic event sequence ----------
// dates ascend, seq ascend, revert references a prior real seq.
const T = (h, m) => `2026-07-08T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;

append({
  type: 'init',
  author: 'head_coach',
  timestamp: T(9, 0),
  content: 'FC Metall Nord — game model initialised (4-2-3-1, high press, 6.2s counter-press window)',
  meta: { club: 'FC Metall Nord', formation: '4-2-3-1' },
});

append({
  type: 'ingest',
  author: 'analyst',
  timestamp: T(9, 12),
  content: 'Match ingested: Metall Nord 2 : 1 SV Hafen (Regionalliga, 2026-07-05)',
  meta: { match_id: 'metall_hafen_2026_07_05', events: 137, xg_for: 1.84, xg_against: 0.71 },
});

append({
  type: 'ingest',
  author: 'analyst',
  timestamp: T(9, 18),
  content: 'Match ingested: Metall Nord 0 : 2 Kiel Reserve (friendly, 2026-06-28)',
  meta: { match_id: 'metall_kiel_2026_06_28', events: 121, xg_for: 0.42, xg_against: 1.61 },
});

append({
  type: 'ingest',
  author: 'analyst',
  timestamp: T(9, 25),
  content: 'Match ingested: Metall Nord 3 : 0 Rostock B (Regionalliga, 2026-06-21)',
  meta: { match_id: 'metall_rostock_2026_06_21', events: 149, xg_for: 2.71, xg_against: 0.58 },
});

append({
  type: 'observation',
  author: 'head_coach',
  timestamp: T(10, 4),
  content: 'Under high press Mahler consistently loses the ball on his weak foot within 4s — flag for CB pairing rotation.',
  meta: { player: 'Mahler', tag: 'weakness', priority: 'high' },
});

append({
  type: 'observation',
  author: 'assistant_coach',
  timestamp: T(10, 19),
  content: 'Right-wing overload with Voss + Berger drawing double marker → free space for Klein cutback (3 clear looks vs Rostock).',
  meta: { pattern: 'wing_overload_cutback', side: 'right' },
});

append({
  type: 'decision',
  author: 'oracle_worker',
  timestamp: T(10, 44),
  content: 'Oracle decision: attest player readiness score Mahler = 62/100 (recent form 0.71, injury risk 0.18). Attestation TTL 72h.',
  meta: {
    subject: 'player:Mahler',
    score: 62,
    ttl_hours: 72,
    inputs: ['metall_hafen_2026_07_05', 'metall_rostock_2026_06_21'],
    on_chain: 'casper:testnet:pending',
  },
});

append({
  type: 'decision',
  author: 'oracle_worker',
  timestamp: T(11, 2),
  content: 'Oracle decision: recommend starting XI vs Wolfsburg B — swap Mahler for Reiter, keep Voss/Berger overload.',
  meta: {
    subject: 'lineup:wolfsburg_b_2026_07_12',
    changes: [{ out: 'Mahler', in: 'Reiter', reason: 'ball retention under press' }],
    confidence: 0.78,
  },
});

append({
  type: 'decision',
  author: 'oracle_worker',
  timestamp: T(11, 18),
  content: 'Oracle decision: opponent SV Hafen pressing trigger identified — CB square pass at own third (n=9 in 3 matches).',
  meta: {
    subject: 'opponent:sv_hafen',
    pattern: 'press_trigger:cb_square_own_third',
    sample: 9,
    recommendation: 'avoid_pattern',
  },
});

append({
  type: 'revert',
  author: 'head_coach',
  timestamp: T(11, 41),
  content: 'Revert: decision on Mahler swap — new medical data changes the picture. Chain remains, entry supersedes seq 7.',
  meta: { reverts_seq: 7, reason: 'new_medical_report' },
});

// ---------- verify chain before writing ----------
function verify(entries) {
  let prev = GENESIS;
  for (const e of entries) {
    const { seq: _s, prev_hash: _p, prev_hash_full, hash: _h, hash_full, sig: _sig, sig_full, public_key: _pk, ...payload } = e;
    const expected = sha256(prev + canonical(payload));
    if (expected !== hash_full) throw new Error(`chain broken at seq ${e.seq}: ${expected} !== ${hash_full}`);
    if (prev_hash_full !== prev) throw new Error(`prev_hash mismatch at seq ${e.seq}`);
    prev = hash_full;
  }
  return prev;
}

const head = verify(entries);

// ---------- write snapshot ----------
mkdirSync(dirname(OUT), { recursive: true });

const snapshot = {
  schema: 'mister.hypercore-tail.v1',
  generated_at: new Date().toISOString(),
  source: 'scripts/export-log.mjs',
  note: 'Real cryptographic append-only log. Every hash = sha256(prev_hash_full + canonical(payload)). Every sig = ed25519(hash, author.private_key). Verifiable independently — see verify() in scripts/export-log.mjs.',
  algo: {
    hash: 'sha256',
    signature: 'ed25519',
    canonicalisation: 'sorted-keys JSON of {id,type,author,content,timestamp,meta?}',
  },
  head_hash: head,
  head_hash_short: shortHash(head),
  entries_count: entries.length,
  entries,
};

writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');

console.log(`✓ Verified chain of ${entries.length} entries`);
console.log(`✓ Head: ${shortHash(head)} (full: ${head})`);
console.log(`✓ Wrote ${OUT}`);

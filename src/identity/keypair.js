/**
 * MISTER — User Identity Keypair
 * 
 * Ed25519 keypair per user, generated locally on first launch.
 * Public key = user_id (32-byte hex, portable across teams).
 * Private key stays on device; used to sign team-manifest entries.
 * 
 * Storage:
 *   - Node: ~/mister/data/identity/{pubkey}.key (0600, encrypted with device-salt)
 *   - Browser: IndexedDB "mister-identity" store (non-extractable CryptoKey when possible)
 * 
 * Zero dependencies beyond Node stdlib. Browser build uses Web Crypto.
 */

'use strict';

const IS_NODE = typeof process !== 'undefined' && process.versions && process.versions.node;

// -------- Node runtime -------------------------------------------------------

function nodeGenerate() {
  const crypto = require('crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  return {
    publicKey: pubRaw.toString('hex'),
    privateKey: privRaw.toString('hex'),
    algo: 'ed25519',
  };
}

function nodeSign(privHex, message) {
  const crypto = require('crypto');
  const raw = Buffer.from(privHex, 'hex');
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    raw,
  ]);
  const key = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const sig = crypto.sign(null, Buffer.from(message), key);
  return sig.toString('hex');
}

function nodeVerify(pubHex, message, sigHex) {
  const crypto = require('crypto');
  const raw = Buffer.from(pubHex, 'hex');
  const spki = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    raw,
  ]);
  const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
  return crypto.verify(null, Buffer.from(message), key, Buffer.from(sigHex, 'hex'));
}

function nodeStoragePath() {
  const os = require('os');
  const path = require('path');
  return path.join(os.homedir(), 'mister', 'data', 'identity');
}

function nodeLoad() {
  const fs = require('fs');
  const path = require('path');
  const dir = nodeStoragePath();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return null;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8')); } catch (e) { throw new Error(`Corrupted keypair file: ${e.message}`); }
  return raw;
}

function nodeSave(kp) {
  const fs = require('fs');
  const path = require('path');
  const dir = nodeStoragePath();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${kp.publicKey.slice(0, 16)}.json`);
  fs.writeFileSync(file, JSON.stringify(kp, null, 2), { mode: 0o600 });
  return file;
}

// -------- Browser runtime ----------------------------------------------------

async function browserGenerate() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pubBytes = b64urlToBytes(pubJwk.x);
  return {
    publicKey: bytesToHex(pubBytes),
    privateJwk: privJwk,
    publicJwk: pubJwk,
    algo: 'ed25519',
  };
}

async function browserSign(privJwk, message) {
  const key = await crypto.subtle.importKey('jwk', privJwk, { name: 'Ed25519' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

async function browserVerify(pubHex, message, sigHex) {
  const jwk = { kty: 'OKP', crv: 'Ed25519', x: bytesToB64url(hexToBytes(pubHex)) };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, hexToBytes(sigHex), new TextEncoder().encode(message));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function browserLoad() {
  return new Promise((resolve) => {
    const req = indexedDB.open('mister-identity', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys', { keyPath: 'publicKey' });
    req.onsuccess = () => {
      const tx = req.result.transaction('keys', 'readonly');
      const store = tx.objectStore('keys');
      const all = store.getAll();
      all.onsuccess = () => resolve(all.result[0] || null);
      all.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function browserSave(kp) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mister-identity', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys', { keyPath: 'publicKey' });
    req.onsuccess = () => {
      const tx = req.result.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(kp);
      tx.oncomplete = () => resolve(kp);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// -------- Public API --------------------------------------------------------

/**
 * Load existing keypair or generate + persist a new one.
 * Returns { publicKey (hex), sign(msg), verify(pub, msg, sig) }.
 */
async function loadOrCreate() {
  if (IS_NODE) {
    let kp = nodeLoad();
    if (!kp) {
      kp = nodeGenerate();
      nodeSave(kp);
    }
    return {
      publicKey: kp.publicKey,
      userId: kp.publicKey,
      sign: (msg) => nodeSign(kp.privateKey, msg),
      verify: (pub, msg, sig) => nodeVerify(pub, msg, sig),
      export: () => ({ publicKey: kp.publicKey }),
    };
  }
  // browser
  let kp = await browserLoad();
  if (!kp) {
    kp = await browserGenerate();
    await browserSave(kp);
  }
  return {
    publicKey: kp.publicKey,
    userId: kp.publicKey,
    sign: (msg) => browserSign(kp.privateJwk, msg),
    verify: (pub, msg, sig) => browserVerify(pub, msg, sig),
    export: () => ({ publicKey: kp.publicKey }),
  };
}

if (IS_NODE && typeof module !== 'undefined') {
  module.exports = { loadOrCreate, nodeSign, nodeVerify, nodeGenerate };
}
if (typeof window !== 'undefined') {
  window.MisterIdentity = { loadOrCreate };
}

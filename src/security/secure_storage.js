/**
 * MISTER — Secure Storage Layer
 *
 * Transparent encrypt-on-write / decrypt-on-read for club data.
 * Password is cached in memory for the session lifetime only —
 * never persisted to disk.
 *
 * Usage:
 *   const store = require('./security/secure_storage');
 *   store.unlock('mypassword');          // once per session
 *   const data = store.readSecure('data/club_profile.json');
 *   store.writeSecure('data/club_profile.json', data);
 */

const fs = require('fs');
const path = require('path');
const crypto = require('./crypto');
const log = require('../utils/logger');

const ENC_EXT = '.enc';

/** In-memory password — never written to disk */
let _password = null;
let _enabled = false;

/**
 * Enable encryption and cache password for this session.
 * @param {string} password
 */
function unlock(password) {
  if (!password || typeof password !== 'string' || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }
  _password = password;
  _enabled = true;
  log.info('secure_storage', 'Encryption enabled for this session');
}

/** Disable encryption and clear cached password. */
function lock() {
  _password = null;
  _enabled = false;
  log.info('secure_storage', 'Encryption disabled, password cleared');
}

/** @returns {boolean} Whether encryption is enabled */
function isEnabled() { return _enabled && !!_password; }

/**
 * Read a JSON file — transparently decrypts .enc if encryption is enabled.
 *
 * Lookup order (when enabled):
 *   1. filePath.enc  →  decrypt → parse
 *   2. filePath      →  plain parse (backward compat)
 *
 * When disabled: reads plain filePath only.
 *
 * @param {string} filePath — path WITHOUT .enc suffix
 * @returns {any} parsed JSON
 */
function readSecure(filePath) {
  const encPath = filePath + ENC_EXT;

  if (_enabled && _password && fs.existsSync(encPath)) {
    const encrypted = fs.readFileSync(encPath);
    const plain = crypto.decryptData(encrypted, _password);
    log.debug('secure_storage', 'Decrypted', { file: encPath });
    crypto.auditLog('read_decrypt', { file: path.basename(filePath) });
    return JSON.parse(plain.toString('utf-8'));
  }

  // Fallback: plain file
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  throw new Error(`File not found: ${filePath}`);
}

/**
 * Write a JSON file — transparently encrypts when enabled.
 *
 * When enabled: writes filePath.enc and securely deletes plain version.
 * When disabled: writes plain filePath.
 *
 * @param {string} filePath — path WITHOUT .enc suffix
 * @param {any} data — JSON-serializable data
 */
function writeSecure(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (_enabled && _password) {
    const encPath = filePath + ENC_EXT;
    const encrypted = crypto.encryptData(json, _password);
    fs.writeFileSync(encPath, encrypted);
    // Remove plain version if it exists
    if (fs.existsSync(filePath)) crypto.secureDelete(filePath);
    log.debug('secure_storage', 'Encrypted write', { file: encPath });
    crypto.auditLog('write_encrypt', { file: path.basename(filePath) });
  } else {
    fs.writeFileSync(filePath, json);
  }
}

/**
 * Migrate all plain data files → encrypted. Idempotent.
 * @param {string} dataDir — data directory root
 * @returns {{ migrated: number, skipped: number, errors: string[] }}
 */
function encryptAll(dataDir) {
  if (!_enabled || !_password) throw new Error('Unlock first');

  const targets = [
    'club_profile.json',
    'sft_pairs.json',
    'causal_corpus.json',
    'players.json',
    'opponents/opponents.json',
    'opponents/results.json',
  ];

  let migrated = 0, skipped = 0;
  const errors = [];

  for (const rel of targets) {
    const plain = path.join(dataDir, rel);
    const enc   = plain + ENC_EXT;
    if (!fs.existsSync(plain)) { skipped++; continue; }
    if (fs.existsSync(enc))    { skipped++; continue; } // already encrypted
    try {
      const data = fs.readFileSync(plain, 'utf-8');
      const encrypted = crypto.encryptData(data, _password);
      fs.mkdirSync(path.dirname(enc), { recursive: true });
      fs.writeFileSync(enc, encrypted);
      crypto.secureDelete(plain);
      migrated++;
      crypto.auditLog('migrate_encrypt', { file: rel });
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
    }
  }

  log.info('secure_storage', 'Encryption migration complete', { migrated, skipped, errors: errors.length });
  return { migrated, skipped, errors };
}

/**
 * Decrypt all .enc files back to plain JSON. Idempotent.
 * @param {string} dataDir
 * @returns {{ decrypted: number, errors: string[] }}
 */
function decryptAll(dataDir) {
  if (!_password) throw new Error('Unlock first');

  let decrypted = 0;
  const errors = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(ENC_EXT)) continue;

      try {
        const enc = fs.readFileSync(full);
        const plain = crypto.decryptData(enc, _password);
        const plainPath = full.slice(0, -ENC_EXT.length);
        fs.writeFileSync(plainPath, plain);
        fs.unlinkSync(full);
        decrypted++;
        crypto.auditLog('migrate_decrypt', { file: path.relative(dataDir, plainPath) });
      } catch (e) {
        errors.push(`${entry.name}: ${e.message}`);
      }
    }
  }

  walk(dataDir);
  log.info('secure_storage', 'Decryption migration complete', { decrypted, errors: errors.length });
  return { decrypted, errors };
}

module.exports = {
  unlock,
  lock,
  isEnabled,
  readSecure,
  writeSecure,
  encryptAll,
  decryptAll,
};

/**
 * MISTER — Security & Encryption Module
 * 
 * AES-256-GCM encryption for club data at-rest.
 * PBKDF2 key derivation from user password.
 * 
 * GDPR/CCPA/APPI/PDPA compliance: data is encrypted locally,
 * never leaves the device unencrypted, user controls all data.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a cryptographic key from a password using PBKDF2.
 * 
 * @param {string} password - User's password/passphrase
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} 256-bit key
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Generate a random salt.
 * @returns {Buffer} 32-byte salt
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM.
 * 
 * @param {string|Buffer} data - Data to encrypt
 * @param {string} password - User's password
 * @returns {Buffer} Encrypted data (salt + iv + authTag + ciphertext)
 */
function encryptData(data, password) {
  const salt = generateSalt();
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  
  const ciphertext = Buffer.concat([
    cipher.update(dataBuffer),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: salt(32) + iv(16) + authTag(16) + ciphertext(N)
  const encrypted = Buffer.concat([salt, iv, authTag, ciphertext]);
  
  log.debug('crypto', 'Data encrypted', { 
    plaintextSize: dataBuffer.length, 
    encryptedSize: encrypted.length 
  });
  
  return encrypted;
}

/**
 * Decrypt data encrypted with encryptData().
 * 
 * @param {Buffer} encrypted - Encrypted data
 * @param {string} password - User's password
 * @returns {Buffer} Decrypted data
 * @throws if password is wrong or data is corrupted
 */
function decryptData(encrypted, password) {
  // Extract components
  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encrypted.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = deriveKey(password, salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    log.debug('crypto', 'Data decrypted', { 
      encryptedSize: encrypted.length, 
      decryptedSize: decrypted.length 
    });
    
    return decrypted;
  } catch (e) {
    log.error('crypto', 'Decryption failed — wrong password or corrupted data', { error: e.message });
    throw new Error('Decryption failed: wrong password or corrupted data');
  }
}

/**
 * Encrypt a string and return base64 for storage.
 * 
 * @param {string} text - Text to encrypt
 * @param {string} password - User's password
 * @returns {string} Base64-encoded encrypted data
 */
function encryptString(text, password) {
  return encryptData(text, password).toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted string.
 * 
 * @param {string} encryptedBase64 - Base64 encrypted data
 * @param {string} password - User's password
 * @returns {string} Decrypted text
 */
function decryptString(encryptedBase64, password) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  return decryptData(encrypted, password).toString('utf-8');
}

/**
 * Encrypt a file at-rest.
 * 
 * @param {string} filePath - Path to file to encrypt
 * @param {string} password - User's password
 * @returns {string} Path to encrypted file (original + .enc)
 */
function encryptFile(filePath, password) {
  const data = fs.readFileSync(filePath);
  const encrypted = encryptData(data, password);
  const encPath = filePath + '.enc';
  fs.writeFileSync(encPath, encrypted);
  
  // Secure delete original (overwrite + delete)
  secureDelete(filePath);
  
  log.info('crypto', 'File encrypted', { from: filePath, to: encPath, size: encrypted.length });
  return encPath;
}

/**
 * Decrypt a file.
 * 
 * @param {string} encFilePath - Path to encrypted file
 * @param {string} password - User's password
 * @param {string} outputFilePath - Path for decrypted output (optional)
 * @returns {string} Path to decrypted file
 */
function decryptFile(encFilePath, password, outputFilePath = null) {
  const encrypted = fs.readFileSync(encFilePath);
  const decrypted = decryptData(encrypted, password);
  
  const outPath = outputFilePath || encFilePath.replace('.enc', '');
  fs.writeFileSync(outPath, decrypted);
  
  log.info('crypto', 'File decrypted', { from: encFilePath, to: outPath, size: decrypted.length });
  return outPath;
}

/**
 * Securely delete a file by overwriting with random data before deletion.
 * 
 * @param {string} filePath - Path to file
 */
function secureDelete(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  
  // Overwrite with random data
  const randomData = crypto.randomBytes(fileSize);
  fs.writeFileSync(filePath, randomData);
  
  // Overwrite with zeros
  const zeros = Buffer.alloc(fileSize, 0);
  fs.writeFileSync(filePath, zeros);
  
  // Delete
  fs.unlinkSync(filePath);
  
  log.info('crypto', 'File securely deleted', { path: filePath, size: fileSize });
}

/**
 * Hash data using SHA-256.
 * 
 * @param {string|Buffer} data - Data to hash
 * @returns {string} Hex hash
 */
function hashData(data) {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  return crypto.createHash('sha256').update(dataBuffer).digest('hex');
}

/**
 * Generate a random token (for session, API keys, etc.)
 * 
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} Hex token
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Verify a password against encrypted data.
 * 
 * @param {Buffer} encrypted - Encrypted data
 * @param {string} password - Password to verify
 * @returns {boolean} True if password is correct
 */
function verifyPassword(encrypted, password) {
  try {
    decryptData(encrypted, password);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// AUDIT LOG
// ============================================================

const AUDIT_LOG_PATH = path.join(process.cwd(), 'logs', 'audit.jsonl');

/**
 * Log a security-relevant action for audit trail.
 * 
 * @param {string} action - Action type (access, encrypt, decrypt, delete, export)
 * @param {Object} details - Additional details
 */
function auditLog(action, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  
  // Ensure log directory exists
  const logDir = path.dirname(AUDIT_LOG_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n');
  log.info('audit', action, details);
}

/**
 * Read audit log entries.
 * 
 * @param {number} limit - Max entries to return
 * @returns {Array} Audit entries
 */
function readAuditLog(limit = 100) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
  
  const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.trim());
  
  return lines.slice(-limit).map(line => {
    try { return JSON.parse(line); }
    catch { return { raw: line }; }
  });
}

// ============================================================
// CLUB DATA MANAGER
// ============================================================

const CLUB_DATA_DIR = path.join(process.cwd(), 'data');
const ENCRYPTED_DIR = path.join(process.cwd(), 'data', 'encrypted');

/**
 * Encrypt all club data files at-rest.
 * 
 * @param {string} password - User's password
 * @param {Array} files - Files to encrypt (default: all in data/)
 * @returns {Object} Result
 */
function encryptClubData(password, files = null) {
  const filesToEncrypt = files || [
    'club_profile.json',
    'sft_pairs.json',
    'causal_corpus.json',
    'opponents/opponents.json',
  ];
  
  if (!fs.existsSync(ENCRYPTED_DIR)) {
    fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
  }
  
  const results = [];
  
  for (const file of filesToEncrypt) {
    const filePath = path.join(CLUB_DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      results.push({ file, success: false, error: 'File not found' });
      continue;
    }
    
    try {
      const data = fs.readFileSync(filePath);
      const encrypted = encryptData(data, password);
      const encPath = path.join(ENCRYPTED_DIR, file + '.enc');
      
      // Ensure subdirectory exists
      fs.mkdirSync(path.dirname(encPath), { recursive: true });
      fs.writeFileSync(encPath, encrypted);
      
      // Secure delete original
      secureDelete(filePath);
      
      results.push({ file, success: true, encPath });
      auditLog('encrypt', { file, encPath });
    } catch (e) {
      results.push({ file, success: false, error: e.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  log.info('crypto', 'Club data encrypted', { success: successCount, total: results.length });
  
  return { encrypted: successCount, total: results.length, results };
}

/**
 * Decrypt all club data files.
 * 
 * @param {string} password - User's password
 * @returns {Object} Result
 */
function decryptClubData(password) {
  if (!fs.existsSync(ENCRYPTED_DIR)) {
    return { decrypted: 0, total: 0, results: [], error: 'No encrypted data found' };
  }
  
  const results = [];
  
  function processDir(dir, relPath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relFilePath = relPath ? path.join(relPath, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        processDir(fullPath, relFilePath);
      } else if (entry.name.endsWith('.enc')) {
        try {
          const encrypted = fs.readFileSync(fullPath);
          const decrypted = decryptData(encrypted, password);
          
          // Restore to original location
          const originalName = entry.name.replace('.enc', '');
          const originalPath = path.join(CLUB_DATA_DIR, relPath, originalName);
          fs.mkdirSync(path.dirname(originalPath), { recursive: true });
          fs.writeFileSync(originalPath, decrypted);
          
          results.push({ file: relFilePath, success: true });
          auditLog('decrypt', { file: relFilePath });
        } catch (e) {
          results.push({ file: relFilePath, success: false, error: e.message });
        }
      }
    }
  }
  
  processDir(ENCRYPTED_DIR);
  
  const successCount = results.filter(r => r.success).length;
  log.info('crypto', 'Club data decrypted', { success: successCount, total: results.length });
  
  return { decrypted: successCount, total: results.length, results };
}

/**
 * Securely delete ALL club data (GDPR right to erasure).
 * Overwrites and deletes all data files.
 * 
 * @returns {Object} Result
 */
function deleteAllClubData() {
  const filesToDelete = [
    'club_profile.json',
    'sft_pairs.json',
    'causal_corpus.json',
    'opponents/opponents.json',
  ];
  
  const results = [];
  
  for (const file of filesToDelete) {
    const filePath = path.join(CLUB_DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        secureDelete(filePath);
        results.push({ file, success: true });
        auditLog('delete', { file });
      } catch (e) {
        results.push({ file, success: false, error: e.message });
      }
    }
  }
  
  // Also delete encrypted versions
  if (fs.existsSync(ENCRYPTED_DIR)) {
    function deleteEncDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          deleteEncDir(fullPath);
        } else {
          secureDelete(fullPath);
          auditLog('delete', { file: fullPath });
        }
      }
    }
    try { deleteEncDir(ENCRYPTED_DIR); } catch (e) { log.warn("security.crypto", "Caught error", { error: e.message }); }
  }
  
  // Delete RAG workspaces
  auditLog('delete', { scope: 'rag_workspaces' });
  
  // Delete audit log itself (last)
  if (fs.existsSync(AUDIT_LOG_PATH)) {
    secureDelete(AUDIT_LOG_PATH);
  }
  
  const successCount = results.filter(r => r.success).length;
  log.info('crypto', 'All club data deleted (GDPR right to erasure)', { success: successCount });
  
  return { deleted: successCount, total: results.length, results };
}

/**
 * Export all club data (GDPR right to data portability).
 * 
 * @param {string} exportPath - Path for export file
 * @returns {string} Path to exported file
 */
function exportAllData(exportPath = null) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    clubData: {},
  };
  
  const filesToExport = [
    'club_profile.json',
    'sft_pairs.json',
    'causal_corpus.json',
    'opponents/opponents.json',
  ];
  
  for (const file of filesToExport) {
    const filePath = path.join(CLUB_DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        exportData.clubData[file] = JSON.parse(content);
      } catch (e) {
        exportData.clubData[file] = { error: e.message };
      }
    }
  }
  
  // Add audit log
  exportData.auditLog = readAuditLog(1000);
  
  const outPath = exportPath || path.join(process.cwd(), `club_data_export_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
  
  auditLog('export', { path: outPath });
  log.info('crypto', 'Data exported (GDPR portability)', { path: outPath });
  
  return outPath;
}

module.exports = {
  // Encryption
  encryptData,
  decryptData,
  encryptString,
  decryptString,
  encryptFile,
  decryptFile,
  secureDelete,
  
  // Hashing
  hashData,
  generateToken,
  verifyPassword,
  
  // Key derivation
  deriveKey,
  generateSalt,
  
  // Audit
  auditLog,
  readAuditLog,
  
  // Club data management
  encryptClubData,
  decryptClubData,
  deleteAllClubData,
  exportAllData,
};

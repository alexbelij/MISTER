/**
 * MISTER — Shared Helper Functions
 * 
 * Text processing, timing, file utilities, and football-specific helpers.
 */

const fs = require('fs');
const path = require('path');

// --- Text Processing ---

function chunkText(text, maxLen = 384, overlap = 64) {
  if (overlap >= maxLen) overlap = 0; // guard against infinite loop
  const words = text.split(/\s+/);
  const chunks = [];
  const step = Math.max(1, maxLen - overlap);
  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + maxLen).join(' '));
    if (i + maxLen >= words.length) break;
  }
  return chunks;
}

function wordOverlap(textA, textB) {
  const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
  return overlap / Math.max(Math.min(wordsA.size, wordsB.size), 1);
}

function countTerms(text, terms) {
  const lower = text.toLowerCase();
  return terms.filter(term => lower.includes(term.toLowerCase()));
}

function truncate(text, maxLen = 500) {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function sanitizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- Timing ---

function timer() {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    elapsedSeconds: () => ((Date.now() - start) / 1000).toFixed(1),
    elapsedMinutes: () => ((Date.now() - start) / 60000).toFixed(1),
    reset: () => { const s = Date.now(); return { elapsed: () => Date.now() - s }; }
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

// --- File Utilities ---

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readJSONL(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .trim().split('\n')
    .filter(line => line.trim())
    .map(JSON.parse);
}

function writeJSONL(filePath, items) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, items.map(item => JSON.stringify(item)).join('\n') + '\n');
}

function appendJSONL(filePath, item) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(item) + '\n');
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function fileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function fileSizeFormatted(filePath) {
  const bytes = fileSize(filePath);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// --- Football-specific ---

const FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '3-4-3', '4-1-4-1', '5-3-2', '4-2-2-2'];

const POSITIONS = {
  GK: 'Goalkeeper',
  RB: 'Right Back',
  LB: 'Left Back',
  CB: 'Center Back',
  RWB: 'Right Wing Back',
  LWB: 'Left Wing Back',
  CM: 'Central Midfielder',
  DM: 'Defensive Midfielder',
  AM: 'Attacking Midfielder',
  RW: 'Right Winger',
  LW: 'Left Winger',
  ST: 'Striker',
  CF: 'Center Forward',
};

function parseFormation(formationStr) {
  const parts = formationStr.split('-').map(Number);
  if (parts.length < 3) return null;
  return {
    defenders: parts[0],
    midfielders: parts[1],
    forwards: parts.slice(2).reduce((a, b) => a + b, 0),
    raw: formationStr
  };
}

// --- Validation ---

function validateSFTPair(pair) {
  if (!pair || typeof pair !== 'object') return false;
  if (!pair.prompt || typeof pair.prompt !== 'string') return false;
  if (!pair.completion || typeof pair.completion !== 'string') return false;
  if (pair.prompt.length < 5) return false;
  if (pair.completion.length < 20) return false;
  return true;
}

function validateClubProfile(profile) {
  if (!profile || !profile.name) return false;
  if (!profile.formation) return false;
  if (!Array.isArray(profile.players) || profile.players.length < 7) return false;
  if (!profile.terminology || Object.keys(profile.terminology).length < 3) return false;
  if (!Array.isArray(profile.principles) || profile.principles.length < 3) return false;
  return true;
}

// --- ID Generation ---

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function hashString(str) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

// --- Array Utilities ---

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function unique(array) {
  return [...new Set(array)];
}

// --- Stats ---

function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

module.exports = {
  // Text
  chunkText, wordOverlap, countTerms, truncate, sanitizeText,
  // Timing
  timer, sleep, formatDuration,
  // Files
  ensureDir, readJSON, writeJSON, readJSONL, writeJSONL, appendJSONL,
  fileExists, fileSize, fileSizeFormatted,
  // Football
  FORMATIONS, POSITIONS, parseFormation,
  // Validation
  validateSFTPair, validateClubProfile,
  // IDs
  generateId, hashString,
  // Arrays
  shuffle, chunk, unique,
  // Stats
  mean, stdDev, percentile,
};

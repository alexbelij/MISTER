/**
 * MISTER — Structured Logger
 * 
 * JSON-formatted logs for training, eval, and inference.
 * Logs are part of the evidence-bundle for judges.
 * 
 * Usage:
 *   const log = require('./utils/logger');
 *   log.info('finetune', 'Starting training', { epochs: 3 });
 *   log.metric('eval', 'terminology_delta', 0.56);
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40, metric: 50 };

let currentLevel = LOG_LEVELS.info;
let logStream = null;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogStream() {
  if (!logStream) {
    ensureLogDir();
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `mister_${date}.log`);
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
  }
  return logStream;
}

function formatLog(level, module, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };
  if (data !== undefined) {
    if (level === 'metric') {
      entry.metric = data;
    } else {
      entry.data = data;
    }
  }
  return JSON.stringify(entry);
}

function log(level, module, message, data) {
  if (LOG_LEVELS[level] < currentLevel) return;
  
  const formatted = formatLog(level, module, message, data);
  
  // Console output (color-coded)
  const colors = {
    debug: '\x1b[36m',   // cyan
    info: '\x1b[32m',    // green
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    metric: '\x1b[35m',  // magenta
  };
  const reset = '\x1b[0m';
  const prefix = `${colors[level] || ''}[${level.toUpperCase()}]${reset} [${module}]`;
  
  if (level === 'metric') {
    console.error(`${prefix} ${message}: ${JSON.stringify(data)}`);
  } else {
    console.error(`${prefix} ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
  }
  
  // File output
  try {
    getLogStream().write(formatted + '\n');
  } catch (e) {
    // Silent fail — logging shouldn't crash the app
  }
}

module.exports = {
  setLevel: (level) => { currentLevel = LOG_LEVELS[level] || LOG_LEVELS.info; },
  
  debug: (module, message, data) => log('debug', module, message, data),
  info: (module, message, data) => log('info', module, message, data),
  warn: (module, message, data) => log('warn', module, message, data),
  error: (module, message, data) => log('error', module, message, data),
  metric: (module, metricName, value) => log('metric', module, metricName, value),
  
  // Structured event logger for training/eval timelines
  event: (module, eventName, details) => {
    log('info', module, `EVENT: ${eventName}`, details);
  },
  
  // Flush logs (call before exit)
  flush: () => {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  },
  
  // Get log file path for evidence-bundle
  getLogPath: () => {
    ensureLogDir();
    const date = new Date().toISOString().split('T')[0];
    return path.join(LOG_DIR, `mister_${date}.log`);
  },
  
  // Read recent logs
  readRecent: (lines = 100) => {
    const logPath = module.exports.getLogPath();
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf-8');
    const allLines = content.trim().split('\n');
    return allLines.slice(-lines).map(line => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
  }
};

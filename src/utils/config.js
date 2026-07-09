/**
 * MISTER — Configuration Loader
 * 
 * Loads and merges config from default.json, environment variables, and CLI args.
 * Supports profile-based training configurations.
 * 
 * Usage:
 *   const { config, getProfile } = require('./utils/config');
 *   const trainingConfig = getProfile('gate');
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(process.cwd(), 'config');

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// Load default config
let config = loadJSON(path.join(CONFIG_DIR, 'default.json'));

// Load training profiles
const trainingProfiles = loadJSON(path.join(CONFIG_DIR, 'training_profiles.json'));

// Override with environment variables (MISTER_ prefix)
function applyEnvOverrides(cfg) {
  const envPrefix = 'MISTER_';
  const result = { ...cfg };
  
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(envPrefix)) continue;
    
    const configPath = key.slice(envPrefix.length).toLowerCase().split('__');
    let target = result;
    
    for (let i = 0; i < configPath.length - 1; i++) {
      if (!target[configPath[i]]) target[configPath[i]] = {};
      target = target[configPath[i]];
    }
    
    const finalKey = configPath[configPath.length - 1];
    // Try to parse as JSON, fallback to string
    try {
      target[finalKey] = JSON.parse(value);
    } catch {
      target[finalKey] = value;
    }
  }
  
  return result;
}

config = applyEnvOverrides(config);

// CLI arg overrides
function applyCLIOverrides(cfg) {
  const result = { ...cfg };
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--config.')) continue;
    const m = arg.match(/^--config\.(\S+)=(.+)$/);
    if (!m) continue;
    const [, key, value] = m;
    const keys = key.split('.');
    let target = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
      target = target[keys[i]];
    }
    try {
      target[keys[keys.length - 1]] = JSON.parse(value);
    } catch {
      target[keys[keys.length - 1]] = value;
    }
  }
  return result;
}

config = applyCLIOverrides(config);

// Get a training profile merged with default config
function getProfile(profileName) {
  const profile = trainingProfiles.profiles?.[profileName];
  if (!profile) {
    throw new Error(`Training profile '${profileName}' not found. Available: ${Object.keys(trainingProfiles.profiles || {}).join(', ')}`);
  }
  
  const { description, ...profileConfig } = profile;
  return {
    ...config.finetune,
    ...profileConfig,
    _profileName: profileName,
    _description: description,
  };
}

// Get available profile names
function getAvailableProfiles() {
  return Object.keys(trainingProfiles.profiles || {});
}

module.exports = {
  config,
  getProfile,
  getAvailableProfiles,
  trainingProfiles,
  
  // Reload config (useful after config changes)
  reload: () => {
    config = applyCLIOverrides(applyEnvOverrides(loadJSON(path.join(CONFIG_DIR, 'default.json'))));
    return config;
  },
  
  // Get a specific config section
  get: (key) => {
    const keys = key.split('.');
    let target = config;
    for (const k of keys) {
      if (!target[k]) return undefined;
      target = target[k];
    }
    return target;
  },
  
  // Set a config value at runtime
  set: (key, value) => {
    const keys = key.split('.');
    let target = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
  }
};

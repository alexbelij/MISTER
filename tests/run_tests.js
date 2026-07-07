/**
 * MISTER — Test Suite v6
 * 
 * Tests for: data validation, helper functions, QVAC wrapper structure,
 * crypto module, config loader, football utilities.
 * 
 * Run: node tests/run_tests.js
 * Or:  npm test
 */

const fs = require('fs');
const path = require('path');
const { validateSFTPair, validateClubProfile, chunkText, wordOverlap, countTerms, mean, stdDev, shuffle, parseFormation, generateId, hashString, unique, chunk } = require('../src/utils/helpers');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertApprox(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Expected ~${expected}, got ${actual}`);
  }
}

console.log('\nMISTER — Test Suite v6');
console.log('═'.repeat(60));

// --- Data Validation Tests ---
console.log('\n📊 Data Validation:');

test('Valid SFT pair passes validation', () => {
  assert(validateSFTPair({ prompt: 'What is verticality?', completion: 'Forward first, sideways only as a last resort.' }), 'Should be valid');
});

test('Invalid SFT pair fails validation', () => {
  assert(!validateSFTPair({ prompt: 'Hi', completion: 'short' }), 'Too short should fail');
  assert(!validateSFTPair({ prompt: '', completion: '' }), 'Empty should fail');
  assert(!validateSFTPair(null), 'Null should fail');
});

test('Valid club profile passes validation', () => {
  const profile = {
    name: 'FC Test',
    formation: '4-3-3',
    players: Array(11).fill({ name: 'Player', pos: 'GK' }),
    terminology: { a: 'x', b: 'y', c: 'z' },
    principles: ['p1', 'p2', 'p3'],
  };
  assert(validateClubProfile(profile), 'Should be valid');
});

test('Invalid club profile fails validation', () => {
  assert(!validateClubProfile({ name: 'Test' }), 'Missing fields should fail');
  assert(!validateClubProfile(null), 'Null should fail');
});

// --- Text Processing Tests ---
console.log('\n📝 Text Processing:');

test('chunkText splits long text', () => {
  const longText = 'word '.repeat(1000);
  const chunks = chunkText(longText, 100, 20);
  assert(chunks.length > 1, 'Should produce multiple chunks');
  assert(chunks[0].split(' ').length <= 100, 'Chunk should respect maxLen');
});

test('chunkText handles short text', () => {
  const shortText = 'short text';
  const chunks = chunkText(shortText, 100, 20);
  assertEqual(chunks.length, 1, 'Should produce one chunk');
});

test('wordOverlap calculates similarity', () => {
  const overlap = wordOverlap('pressing trigger channel run', 'pressing trigger verticality');
  assert(overlap > 0 && overlap <= 1, 'Overlap should be between 0 and 1');
});

test('countTerms finds club terms', () => {
  const terms = countTerms('Press from the front. Channel run. Compact block.', ['press', 'channel', 'compact']);
  assertEqual(terms.length, 3, 'Should find all 3 terms');
});

// --- Stats Tests ---
console.log('\n🔢 Statistics:');

test('mean calculates average', () => {
  assertApprox(mean([1, 2, 3, 4, 5]), 3, 0.001, 'Mean should be 3');
  assertEqual(mean([]), 0, 'Mean of empty array should be 0');
});

test('stdDev calculates standard deviation', () => {
  const sd = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
  assert(sd > 0, 'StdDev should be positive');
  assertApprox(stdDev([5, 5, 5, 5]), 0, 0.001, 'StdDev of same values should be 0');
});

// --- Array Tests ---
console.log('\n🔀 Arrays:');

test('shuffle returns same elements', () => {
  const arr = [1, 2, 3, 4, 5];
  const shuffled = shuffle(arr);
  assertEqual(shuffled.length, arr.length, 'Length should be preserved');
  assert(shuffled.includes(3), 'Should contain all original elements');
});

test('unique removes duplicates', () => {
  assertEqual(unique([1, 1, 2, 2, 3]).length, 3, 'Should have 3 unique elements');
});

test('chunk splits array', () => {
  const result = chunk([1, 2, 3, 4, 5], 2);
  assertEqual(result.length, 3, 'Should produce 3 chunks');
  assertEqual(result[0].length, 2, 'First chunk should have 2 elements');
});

// --- Football Tests ---
console.log('\n⚽ Football:');

test('parseFormation parses 4-3-3', () => {
  const f = parseFormation('4-3-3');
  assertEqual(f.defenders, 4, 'Should have 4 defenders');
  assertEqual(f.midfielders, 3, 'Should have 3 midfielders');
  assertEqual(f.forwards, 3, 'Should have 3 forwards');
});

test('parseFormation parses 3-5-2', () => {
  const f = parseFormation('3-5-2');
  assertEqual(f.defenders, 3, 'Should have 3 defenders');
  assertEqual(f.midfielders, 5, 'Should have 5 midfielders');
  assertEqual(f.forwards, 2, 'Should have 2 forwards');
});

test('parseFormation returns null for invalid', () => {
  assert(!parseFormation('invalid'), 'Should return null for invalid formation');
});

// --- ID Generation Tests ---
console.log('\n🆔 ID Generation:');

test('generateId produces unique IDs', () => {
  const id1 = generateId('test');
  const id2 = generateId('test');
  assert(id1 !== id2, 'IDs should be unique');
  assert(id1.startsWith('test_'), 'ID should start with prefix');
});

test('hashString produces consistent hash', () => {
  const hash1 = hashString('test string');
  const hash2 = hashString('test string');
  assertEqual(hash1, hash2, 'Same string should produce same hash');
  assert(hash1.length > 0, 'Hash should not be empty');
});

// --- Data File Tests ---
console.log('\n📁 Data Files:');

test('club_profile.json exists and is valid', () => {
  const clubPath = path.join(process.cwd(), 'data/club_profile.json');
  assert(fs.existsSync(clubPath), 'club_profile.json should exist');
  const club = JSON.parse(fs.readFileSync(clubPath, 'utf-8'));
  assert(validateClubProfile(club), 'Club profile should pass validation');
  assert(club.name === 'FC Metall Nord', 'Club should be FC Metall Nord');
  assert(club.formation === '4-3-3', 'Formation should be 4-3-3');
});

test('sft_pairs.json exists and has 100+ pairs', () => {
  const sftPath = path.join(process.cwd(), 'data/sft_pairs.json');
  assert(fs.existsSync(sftPath), 'sft_pairs.json should exist');
  const pairs = JSON.parse(fs.readFileSync(sftPath, 'utf-8'));
  assert(pairs.length >= 100, `Should have at least 100 pairs, got ${pairs.length}`);
  const allValid = pairs.every(validateSFTPair);
  assert(allValid, 'All pairs should be valid');
});

test('causal_corpus.json exists and has 20+ docs', () => {
  const causalPath = path.join(process.cwd(), 'data/causal_corpus.json');
  assert(fs.existsSync(causalPath), 'causal_corpus.json should exist');
  const docs = JSON.parse(fs.readFileSync(causalPath, 'utf-8'));
  assert(docs.length >= 20, `Should have at least 20 docs, got ${docs.length}`);
  assert(docs.every(d => d.text && d.text.length > 100), 'All docs should have substantial text');
});

test('holdout_set.json exists and has 15+ questions', () => {
  const holdoutPath = path.join(process.cwd(), 'eval/holdout_set.json');
  assert(fs.existsSync(holdoutPath), 'holdout_set.json should exist');
  const items = JSON.parse(fs.readFileSync(holdoutPath, 'utf-8'));
  assert(items.length >= 15, `Should have at least 15 questions, got ${items.length}`);
  assert(items.every(i => i.prompt && i.reference), 'All items should have prompt and reference');
});

test('opponents.json exists and has 3+ opponents', () => {
  const oppPath = path.join(process.cwd(), 'data/opponents/opponents.json');
  assert(fs.existsSync(oppPath), 'opponents.json should exist');
  const opponents = JSON.parse(fs.readFileSync(oppPath, 'utf-8'));
  assert(opponents.length >= 3, `Should have at least 3 opponents, got ${opponents.length}`);
  assert(opponents.every(o => o.name && o.weaknesses), 'All opponents should have name and weaknesses');
});

// --- Config Tests ---
console.log('\n⚙️ Configuration:');

test('default.json loads correctly', () => {
  const configPath = path.join(process.cwd(), 'config/default.json');
  assert(fs.existsSync(configPath), 'default.json should exist');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert(config.model && config.model.llm, 'Should have model config');
  assert(config.finetune && config.finetune.defaultEpochs, 'Should have finetune config');
  assert(config.eval && config.eval.goThreshold !== undefined, 'Should have eval config');
  assert(config.rag && config.rag.chunkSize, 'Should have RAG config');
  assert(config.voice && config.voice.ttsEnabled !== undefined, 'Should have voice config');
  assert(config.pears && config.pears.storageDir, 'Should have Pears config');
  assert(config.wdk && config.wdk.network, 'Should have WDK config');
});

test('training_profiles.json has all profiles', () => {
  const profilesPath = path.join(process.cwd(), 'config/training_profiles.json');
  assert(fs.existsSync(profilesPath), 'training_profiles.json should exist');
  const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
  assert(profiles.profiles, 'Should have profiles object');
  assert(profiles.profiles.gate, 'Should have gate profile');
  assert(profiles.profiles.standard, 'Should have standard profile');
  assert(profiles.profiles.deep, 'Should have deep profile');
  assert(profiles.profiles.style_only, 'Should have style_only profile');
});

// --- QVAC Wrapper Tests ---
console.log('\n🔌 QVAC Wrapper:');

test('qvac_wrapper.js exists and exports functions', () => {
  const wrapperPath = path.join(process.cwd(), 'src/utils/qvac_wrapper.js');
  assert(fs.existsSync(wrapperPath), 'qvac_wrapper.js should exist');
  // Just check the file exists and has the right exports (can't require without @qvac/sdk)
  const content = fs.readFileSync(wrapperPath, 'utf-8');
  assert(content.includes('module.exports'), 'Should export functions');
  assert(content.includes('loadLLM'), 'Should export loadLLM');
  assert(content.includes('chat'), 'Should export chat');
  assert(content.includes('finetuneRun'), 'Should export finetuneRun');
  assert(content.includes('ragIngest'), 'Should export ragIngest');
  assert(content.includes('tts'), 'Should export tts');
  assert(content.includes('stt'), 'Should export stt');
  assert(content.includes('translateText'), 'Should export translateText');
  assert(content.includes('ocrImage'), 'Should export ocrImage');
  assert(content.includes('describeImage'), 'Should export describeImage');
  assert(content.includes('upscaleImage'), 'Should export upscaleImage');
  assert(content.includes('embed'), 'Should export embed');
  assert(content.includes('cosineSimilarity'), 'Should export cosineSimilarity');
  assert(content.includes('healthCheck'), 'Should export healthCheck');
  assert(content.includes('pcmToWav'), 'Should export pcmToWav');
});

test('qvac_wrapper uses correct API names', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/utils/qvac_wrapper.js'), 'utf-8');
  // Check for real QVAC API names (not fake ones)
  assert(content.includes('textToSpeech'), 'Should use textToSpeech (not tts)');
  assert(content.includes('transcribe'), 'Should use transcribe (not stt)');
  assert(content.includes('completion'), 'Should use completion');
  assert(content.includes('ragIngest'), 'Should use ragIngest');
  assert(content.includes('ragSearch'), 'Should use ragSearch');
  assert(content.includes('modelRegistrySearch'), 'Should use modelRegistrySearch');
  assert(content.includes('heartbeat'), 'Should use heartbeat');
  // Check NO fake APIs
  assert(!content.includes('qvac.tts('), 'Should NOT use fake qvac.tts()');
  assert(!content.includes('qvac.stt('), 'Should NOT use fake qvac.stt()');
  assert(!content.includes('qvac.vlm.completion'), 'Should NOT use fake qvac.vlm.completion()');
  assert(!content.includes('qvac.inference.serve'), 'Should NOT use fake qvac.inference.serve()');
});

// --- Crypto Tests ---
console.log('\n🔒 Security:');

test('crypto.js exists and exports functions', () => {
  const cryptoPath = path.join(process.cwd(), 'src/security/crypto.js');
  assert(fs.existsSync(cryptoPath), 'crypto.js should exist');
  const content = fs.readFileSync(cryptoPath, 'utf-8');
  assert(content.includes('encryptData'), 'Should export encryptData');
  assert(content.includes('decryptData'), 'Should export decryptData');
  assert(content.includes('encryptClubData'), 'Should export encryptClubData');
  assert(content.includes('deleteAllClubData'), 'Should export deleteAllClubData');
  assert(content.includes('exportAllData'), 'Should export exportAllData');
  assert(content.includes('auditLog'), 'Should export auditLog');
  assert(content.includes('aes-256-gcm'), 'Should use AES-256-GCM');
  assert(content.includes('pbkdf2'), 'Should use PBKDF2');
});

test('crypto module encrypts and decrypts correctly', () => {
  const crypto = require('../src/security/crypto');
  const password = 'test-password-123';
  const data = 'FC Metall Nord tactical data';
  
  const encrypted = crypto.encryptData(data, password);
  assert(encrypted.length > 0, 'Encrypted data should not be empty');
  assert(!encrypted.toString().includes(data), 'Encrypted data should not contain plaintext');
  
  const decrypted = crypto.decryptData(encrypted, password);
  assertEqual(decrypted.toString(), data, 'Decrypted data should match original');
});

test('crypto rejects wrong password', () => {
  const crypto = require('../src/security/crypto');
  const encrypted = crypto.encryptData('secret data', 'correct-password');
  assert(crypto.verifyPassword(encrypted, 'correct-password'), 'Correct password should verify');
  assert(!crypto.verifyPassword(encrypted, 'wrong-password'), 'Wrong password should not verify');
});

test('crypto hashData is consistent', () => {
  const crypto = require('../src/security/crypto');
  const hash1 = crypto.hashData('test data');
  const hash2 = crypto.hashData('test data');
  assertEqual(hash1, hash2, 'Same data should produce same hash');
  assert(hash1.length === 64, 'SHA-256 hash should be 64 hex chars');
});

// --- Mobile App Tests ---
console.log('\n📱 Mobile App:');

test('pear.json exists and has permissions', () => {
  const pearPath = path.join(process.cwd(), 'pear.json');
  assert(fs.existsSync(pearPath), 'pear.json should exist');
  const pear = JSON.parse(fs.readFileSync(pearPath, 'utf-8'));
  assert(pear.permissions, 'Should have permissions');
  assert(pear.permissions.camera, 'Should request camera permission');
  assert(pear.permissions.microphone, 'Should request microphone permission');
});

test('mobile app files exist', () => {
  assert(fs.existsSync(path.join(process.cwd(), 'mobile/index.html')), 'mobile/index.html should exist');
  assert(fs.existsSync(path.join(process.cwd(), 'mobile/app.js')), 'mobile/app.js should exist');
  assert(fs.existsSync(path.join(process.cwd(), 'mobile/worker.js')), 'mobile/worker.js should exist');
});

// --- Documentation Tests ---
console.log('\n📚 Documentation:');

test('All required docs exist', () => {
  const docs = ['README.md', 'JUDGE_GUIDE.md', 'DEMO_SCRIPT.md', 'PRIVACY.md', 'COMPLIANCE.md'];
  for (const doc of docs) {
    assert(fs.existsSync(path.join(process.cwd(), doc)), `${doc} should exist`);
  }
});

test('README mentions all killer features', () => {
  const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
  const features = ['fine-tuning', 'OCR', 'translate', 'P2P', 'encryption', 'GDPR', 'Pear', 'voice', 'footage', 'marketplace'];
  for (const f of features) {
    assert(readme.toLowerCase().includes(f.toLowerCase()), `README should mention ${f}`);
  }
});

// --- Package.json Tests ---
console.log('\n📦 Package:');

test('package.json has all scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  const scripts = pkg.scripts;
  const required = ['prepare', 'finetune', 'eval', 'chat', 'distribute', 'delegate', 'collab', 'marketplace', 'voice:briefing', 'voice:input', 'footage', 'ocr', 'translate', 'ratings', 'opponents', 'registry', 'gate', 'ui', 'mobile', 'test'];
  for (const s of required) {
    assert(scripts[s], `Should have script: ${s}`);
  }
});

test('package.json has all dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  assert(pkg.dependencies['@qvac/sdk'], 'Should depend on @qvac/sdk');
  assert(pkg.dependencies['@tetherto/wdk'], 'Should depend on @tetherto/wdk');
  assert(pkg.dependencies['hyperswarm'], 'Should depend on hyperswarm');
  assert(pkg.dependencies['hyperblobs'], 'Should depend on hyperblobs');
  assert(pkg.dependencies['corestore'], 'Should depend on corestore');
  assert(pkg.dependencies['autobase'], 'Should depend on autobase');
});

// --- Results ---
console.log('\n' + '═'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.name}: ${f.error}`);
  }
}

process.exit(failed > 0 ? 1 : 0);

/**
 * MISTER — Tactical Translator — v5 FIXED
 * 
 * Uses qvac_wrapper.js: translateText() with correct await result.text.
 * translate() returns { text: Promise<string> }, need to await.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { fileExists, writeJSON } = require('../utils/helpers');

const SUPPORTED_LANGS = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German',
  it: 'Italian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic',
  ru: 'Russian', tr: 'Turkish', nl: 'Dutch', pl: 'Polish', sw: 'Swahili', hi: 'Hindi',
};

async function main() {
  const textArg = process.argv.find(a => a.startsWith('--text='))?.split('=')[1];
  const filePath = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];
  const toLang = process.argv.find(a => a.startsWith('--to='))?.split('=')[1];
  const multiLangs = process.argv.find(a => a.startsWith('--multi='))?.split('=')[1];
  const outputPath = process.argv.find(a => a.startsWith('--output='))?.split('=')[1];

  let text = textArg;
  if (!text && filePath && fileExists(filePath)) {
    text = fs.readFileSync(filePath, 'utf-8');
  }

  if (!text) {
    console.error('Usage: node src/translate/translate.js --text "Press from the front" --to pt');
    console.error('       node src/translate/translate.js --file briefing.txt --multi pt,es,ja,fr');
    console.error('\nSupported:', Object.entries(SUPPORTED_LANGS).map(([k, v]) => `${k}=${v}`).join(', '));
    process.exit(1);
  }

  // --- Health check ---
  const healthy = await qvac.healthCheck();
  if (!healthy) { log.error('translate', 'QVAC provider not running'); process.exit(1); }

  // --- Determine target languages ---
  let targetLangs = multiLangs ? multiLangs.split(',').map(l => l.trim()) : (toLang ? [toLang] : null);
  if (!targetLangs) {
    console.error('Specify --to <lang> or --multi <lang1,lang2,...>');
    process.exit(1);
  }

  for (const lang of targetLangs) {
    if (!SUPPORTED_LANGS[lang]) {
      log.error('translate', 'Unsupported language', { lang });
      process.exit(1);
    }
  }

  // --- Load NMT model ---
  const nmtModelId = await qvac.loadNMT();
  log.info('translate', 'NMT model loaded');

  const translations = {};

  for (const lang of targetLangs) {
    log.info('translate', `Translating to ${SUPPORTED_LANGS[lang]}`, { lang });

    try {
      // Use wrapper: translateText() correctly awaits result.text
      const translated = await qvac.translateText(nmtModelId, text, lang, { sourceLang: 'auto' });

      translations[lang] = { language: SUPPORTED_LANGS[lang], code: lang, text: translated };
      console.log(`\n✓ ${SUPPORTED_LANGS[lang]} (${lang}):`);
      console.log(`  ${translated.substring(0, 200)}${translated.length > 200 ? '...' : ''}`);
    } catch (e) {
      log.error('translate', `Failed for ${lang}`, { error: e.message });
      translations[lang] = { language: SUPPORTED_LANGS[lang], code: lang, error: e.message };
    }
  }

  // --- Save ---
  if (outputPath) {
    writeJSON(outputPath, { originalText: text, translatedAt: new Date().toISOString(), translations });
    console.log(`\n✓ Saved to ${outputPath}`);
  } else if (filePath) {
    for (const [lang, data] of Object.entries(translations)) {
      if (data.text) {
        const langPath = filePath.replace(/(\.\w+)?$/, `_${lang}$1`);
        fs.writeFileSync(langPath, data.text);
        console.log(`  Saved: ${langPath}`);
      }
    }
  }

  await qvac.unloadModel(nmtModelId);
}

module.exports = { SUPPORTED_LANGS };

main().catch(err => {
  log.error('translate', 'Error', { error: err.message });
  process.exit(1);
});

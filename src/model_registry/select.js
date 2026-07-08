/**
 * MISTER — Model Registry Helper — v8 FIXED (uses qvac_wrapper)
 * 
 * Uses qvac_wrapper.js for correct modelRegistrySearch/List API calls.
 */

const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');

async function main() {
  const ramGB = parseInt(process.argv.find(a => a.startsWith('--ram='))?.split('=')[1] || '0');
  const useCase = process.argv.find(a => a.startsWith('--use='))?.split('=')[1] || 'general';
  const listAll = process.argv.includes('--list');

  // Health check
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('registry', 'QVAC provider not running. See .env.example for setup.');
    process.exit(1);
  }

  if (listAll) {
    log.info('registry', 'Listing all available models');
    try {
      const models = await qvac.registryList();
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║           QVAC Model Registry                               ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  ${models.length} models available${' '.repeat(42 - String(models.length).length)}║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      for (const m of models) {
        const name = (m.name || m.id || 'unknown').substring(0, 30);
        const type = (m.type || m.modelType || '?').substring(0, 8);
        const ft = m.finetunable ? '✓' : '✗';
        console.log(`║  ${name.padEnd(30)}  ${type.padEnd(8)}  FT:${ft}     ║`);
      }
      console.log('╚════════════════════════════════════════════════════════════╝');
    } catch (e) {
      log.error('registry', 'Failed to list models', { error: e.message });
    }
    return;
  }

  // Search
  log.info('registry', 'Searching models', { ram: ramGB || 'any', useCase });

  const searchParams = { useCase };
  if (ramGB > 0) searchParams.maxRamGB = ramGB;
  if (useCase === 'finetune') searchParams.finetunable = true;

  try {
    const models = await qvac.registrySearch(searchParams);

    if (models.length === 0) {
      console.log('No models found matching criteria.');
      // Fallback: get catalog info for configured model
      const info = await qvac.getCatalogInfo(config.model.llmCatalogName);
      if (info) {
        console.log(`\nConfigured model: ${config.model.llm}`);
        console.log(`  Parameters: ${info.parameters || 'unknown'}`);
        console.log(`  Finetunable: ${info.finetunable !== false ? '✓' : '✗'}`);
      }
      return;
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  Recommended Models (RAM: ${ramGB || 'any'}GB, Use: ${useCase.padEnd(10)})     ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');

    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const name = (m.name || m.id || 'unknown').substring(0, 25);
      const ft = m.finetunable ? '✓' : '✗';
      console.log(`║  ${i + 1}. ${name.padEnd(25)}  FT:${ft}     ║`);
    }

    console.log('╚════════════════════════════════════════════════════════════╝');

    // Recommend for MISTER
    const finetunable = models.filter(m => m.finetunable);
    if (finetunable.length > 0 && useCase === 'finetune') {
      const recommended = finetunable[0];
      console.log(`\n  ⭐ Recommended for MISTER: ${recommended.name || recommended.id}`);
      log.metric('registry', 'recommended_model', recommended.name || recommended.id);
    }
  } catch (e) {
    log.error('registry', 'Search failed', { error: e.message });
    // Fallback
    try {
      const info = await qvac.getCatalogInfo(config.model.llmCatalogName);
      if (info) {
        console.log(`\nConfigured model: ${config.model.llm}`);
        console.log(`  Parameters: ${info.parameters || 'unknown'}`);
        console.log(`  Finetunable: ${info.finetunable !== false ? '✓' : '✗'}`);
      }
    } catch (e2) {
      log.error('registry', 'Fallback also failed', { error: e2.message });
    }
  }
}

main().catch(err => {
  log.error('registry', 'Error', { error: err.message });
  process.exit(1);
});

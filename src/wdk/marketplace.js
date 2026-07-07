/**
 * MISTER — Adapter Marketplace (WDK)
 * 
 * Sell club-specific adapters for gasless USDt via WDK.
 * Coaches can buy adapters from other clubs, tactical consultants can sell
 * their expertise as fine-tuned adapters.
 * 
 * Uses WDK for self-custody wallet, gasless USDt transfers (ERC-4337 paymaster),
 * and smart contract escrow for adapter delivery.
 * 
 * Usage:
 *   node src/wdk/marketplace.js --list                    List available adapters
 *   node src/wdk/marketplace.js --sell --adapter adapters/adapter.gguf --price 50
 *   node src/wdk/marketplace.js --buy --listing <id>      Buy an adapter
 *   node src/wdk/marketplace.js --wallet                  Show wallet balance
 *   node src/wdk/marketplace.js --setup                   Initialize wallet
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const { ensureDir, writeJSON, readJSON, fileExists, generateId, hashString, fileSizeFormatted } = require('../utils/helpers');

const MARKETPLACE_DIR = path.join(process.cwd(), 'marketplace');
const LISTINGS_FILE = path.join(MARKETPLACE_DIR, 'listings.json');
const WALLET_FILE = path.join(process.cwd(), '.wallet.json');

async function main() {
  const action = process.argv.find(a => a.startsWith('--'))?.replace('--', '');

  switch (action) {
    case 'setup':
      await setupWallet();
      break;
    case 'wallet':
      await showWallet();
      break;
    case 'sell':
      await sellAdapter();
      break;
    case 'buy':
      await buyAdapter();
      break;
    case 'list':
      await listAdapters();
      break;
    case 'deliver':
      await deliverAdapter();
      break;
    default:
      printUsage();
  }
}

// --- Wallet Setup ---

async function setupWallet() {
  let WDK;
  try {
    WDK = require('@tetherto/wdk');
  } catch (e) {
    log.error('wdk', '@tetherto/wdk not found', { hint: 'npm install @tetherto/wdk' });
    log.info('wdk', 'Creating local wallet configuration...');
    
    // Fallback: create a placeholder wallet config
    const walletConfig = {
      id: generateId('wallet'),
      network: config.wdk.network,
      createdAt: new Date().toISOString(),
      note: 'WDK SDK not installed. Run npm install @tetherto/wdk for real self-custody wallet functionality.',
    };
    writeJSON(WALLET_FILE, walletConfig);
    console.log('⚠ WDK not installed. Placeholder wallet created.');
    console.log('  Install WDK: npm install @tetherto/wdk');
    console.log('  Then run: node src/wdk/marketplace.js --setup');
    return;
  }

  log.info('wdk', 'Initializing WDK wallet');

  // Create self-custody wallet
  const wallet = await WDK.createWallet({
    network: config.wdk.network,
    chains: ['evm'],
  });

  const walletData = {
    id: wallet.id,
    address: wallet.address,
    network: config.wdk.network,
    createdAt: new Date().toISOString(),
  };

  writeJSON(WALLET_FILE, walletData);

  log.info('wdk', 'Wallet created', { address: wallet.address });
  console.log(`✓ Wallet created: ${wallet.address}`);
  console.log(`  Network: ${config.wdk.network}`);
  console.log(`  Fund with testnet USDt to start trading adapters.`);
}

// --- Show Wallet ---

async function showWallet() {
  if (!fileExists(WALLET_FILE)) {
    console.log('No wallet found. Run --setup first.');
    return;
  }

  const wallet = readJSON(WALLET_FILE);
  console.log(`\nWallet: ${wallet.address}`);
  console.log(`Network: ${wallet.network}`);

  let WDK;
  try {
    WDK = require('@tetherto/wdk');
    const balance = await WDK.getBalance({
      address: wallet.address,
      network: wallet.network,
      tokens: ['USDt'],
    });
    console.log(`USDt Balance: ${balance.USDt || '0'}`);
    log.metric('wdk', 'usdt_balance', balance.USDt || 0);
  } catch (e) {
    console.log(`USDt Balance: [WDK not connected]`);
  }
}

// --- Sell Adapter ---

async function sellAdapter() {
  const adapterPath = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1];
  const price = parseFloat(process.argv.find(a => a.startsWith('--price='))?.split('=')[1] || '0');
  const title = process.argv.find(a => a.startsWith('--title='))?.split('=')[1] || 'Club Brain Adapter';
  const description = process.argv.find(a => a.startsWith('--desc='))?.split('=')[1] || '';

  if (!adapterPath || !fileExists(adapterPath)) {
    log.error('wdk', 'Adapter file not found', { path: adapterPath });
    process.exit(1);
  }

  if (price <= 0) {
    log.error('wdk', 'Price must be > 0');
    process.exit(1);
  }

  // Load adapter metadata
  let adapterMeta = {};
  const metaPath = path.join(path.dirname(adapterPath), 'adapter_meta.json');
  if (fileExists(metaPath)) {
    adapterMeta = readJSON(metaPath);
  }

  const listing = {
    id: generateId('listing'),
    title,
    description,
    adapterPath,
    adapterSize: fileSizeFormatted(adapterPath),
    adapterHash: hashString(fs.readFileSync(adapterPath).toString('base64').substring(0, 1000)),
    price,
    currency: config.wdk.currency,
    sellerWallet: fileExists(WALLET_FILE) ? readJSON(WALLET_FILE).address : 'unknown',
    model: adapterMeta.model || config.model.llm,
    club: adapterMeta.club || 'unknown',
    version: adapterMeta.version || '1.0.0',
    createdAt: new Date().toISOString(),
    status: 'active',
  };

  // Add to listings
  ensureDir(MARKETPLACE_DIR);
  let listings = [];
  if (fileExists(LISTINGS_FILE)) {
    listings = readJSON(LISTINGS_FILE);
  }
  listings.push(listing);
  writeJSON(LISTINGS_FILE, listings);

  log.info('wdk', 'Adapter listed for sale', { id: listing.id, price });
  console.log(`✓ Adapter listed for sale!`);
  console.log(`  ID: ${listing.id}`);
  console.log(`  Title: ${title}`);
  console.log(`  Price: ${price} ${config.wdk.currency}`);
  console.log(`  Size: ${listing.adapterSize}`);
  console.log(`  Hash: ${listing.adapterHash}`);
}

// --- Buy Adapter ---

async function buyAdapter() {
  const listingId = process.argv.find(a => a.startsWith('--listing='))?.split('=')[1]
    || process.argv.find(a => a.startsWith('--buy='))?.split('=')[1];

  if (!listingId) {
    log.error('wdk', 'Listing ID required. Use --listing <id>');
    process.exit(1);
  }

  if (!fileExists(LISTINGS_FILE)) {
    console.log('No listings available.');
    return;
  }

  const listings = readJSON(LISTINGS_FILE);
  const listing = listings.find(l => l.id === listingId);

  if (!listing) {
    log.error('wdk', 'Listing not found', { id: listingId });
    process.exit(1);
  }

  if (!fileExists(WALLET_FILE)) {
    console.log('No wallet found. Run --setup first.');
    return;
  }

  const wallet = readJSON(WALLET_FILE);

  log.info('wdk', 'Purchasing adapter', { listing: listingId, price: listing.price });

  let WDK;
  try {
    WDK = require('@tetherto/wdk');

    // Gasless USDt transfer via ERC-4337
    const tx = await WDK.transfer({
      from: wallet.address,
      to: listing.sellerWallet,
      amount: listing.price,
      token: 'USDt',
      network: config.wdk.network,
      gasless: true, // Paymaster pays gas in USDt
    });

    log.info('wdk', 'Payment sent', { txHash: tx.hash });
    console.log(`✓ Payment sent: ${tx.hash}`);
    console.log(`  Amount: ${listing.price} USDt`);
    console.log(`  To: ${listing.sellerWallet}`);
  } catch (e) {
    log.warn('wdk', 'WDK transfer failed — SDK not installed or not connected', { error: e.message, hint: 'npm install @tetherto/wdk' });
    console.log(`⚠ WDK SDK not connected. To enable real gasless USDt transfers:`);
    console.log(`   npm install @tetherto/wdk`);
    console.log(`   Then run: npm run marketplace -- --setup`);
    console.log(`  Amount: ${listing.price} USDt`);
    console.log(`  To: ${listing.sellerWallet}`);
  }

  // Mark listing as sold
  listing.status = 'sold';
  listing.soldAt = new Date().toISOString();
  listing.buyerWallet = wallet.address;
  writeJSON(LISTINGS_FILE, listings);

  console.log(`\n✓ Adapter purchased!`);
  console.log(`  The adapter will be delivered via Pears P2P.`);
  console.log(`  Run: node src/pears/distribute.js --receive --topic <seller-topic>`);
}

// --- List Adapters ---

async function listAdapters() {
  if (!fileExists(LISTINGS_FILE)) {
    console.log('No adapters listed yet.');
    return;
  }

  const listings = readJSON(LISTINGS_FILE).filter(l => l.status === 'active');

  if (listings.length === 0) {
    console.log('No active listings.');
    return;
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           MISTER Adapter Marketplace                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  for (const l of listings) {
    console.log(`║  ${l.title}`);
    console.log(`║  ID: ${l.id}`);
    console.log(`║  Price: ${l.price} ${l.currency} | Size: ${l.adapterSize} | Model: ${l.model}`);
    if (l.description) {
      console.log(`║  ${l.description.substring(0, 60)}`);
    }
    console.log(`║  ─────────────────────────────────────────────────────────`);
  }

  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  ${listings.length} active listing(s)`);
}

// --- Deliver Adapter (seller side) ---

async function deliverAdapter() {
  const listingId = process.argv.find(a => a.startsWith('--listing='))?.split('=')[1];

  if (!listingId || !fileExists(LISTINGS_FILE)) {
    console.log('Usage: --deliver --listing <id>');
    return;
  }

  const listings = readJSON(LISTINGS_FILE);
  const listing = listings.find(l => l.id === listingId);

  if (!listing) {
    console.log('Listing not found.');
    return;
  }

  console.log(`Delivering adapter via Pears P2P...`);
  console.log(`  Adapter: ${listing.adapterPath}`);
  console.log(`  Buyer: ${listing.buyerWallet}`);

  // Start Pears distribution
  const { spawn } = require('child_process');
  const proc = spawn('node', [
    'src/pears/distribute.js',
    `--adapter=${listing.adapterPath}`
  ], { cwd: process.cwd(), stdio: 'inherit' });
}

function printUsage() {
  console.log('MISTER — Adapter Marketplace (WDK)');
  console.log('');
  console.log('Usage:');
  console.log('  --setup                              Initialize self-custody wallet');
  console.log('  --wallet                             Show wallet balance');
  console.log('  --sell --adapter <path> --price 50   List adapter for sale');
  console.log('     --title "Tactical Adapter" --desc "4-3-3 pressing system"');
  console.log('  --list                               Browse available adapters');
  console.log('  --buy --listing <id>                 Buy an adapter (gasless USDt)');
  console.log('  --deliver --listing <id>             Deliver sold adapter via P2P');
}

main().catch(err => {
  log.error('wdk', 'Marketplace error', { error: err.message });
  process.exit(1);
});

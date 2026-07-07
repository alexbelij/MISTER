/**
 * MISTER — Multi-Agent Fallback — v8 FIXED (uses qvac_wrapper)
 * 
 * If Day-0 GATE shows finetune doesn't work well enough,
 * this is the fallback: RAG + multi-agent orchestration.
 * 
 * Uses qvac_wrapper.js for correct API calls.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const rag = require('./rag_engine');
const { readJSON, fileExists } = require('../utils/helpers');

const MODEL = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || config.model.llm;
const ADAPTER = process.argv.find(a => a.startsWith('--adapter='))?.split('=')[1] || null;

const AGENTS = {
  scout: {
    name: 'Scout Agent',
    systemPrompt: `You are a football scout for FC Metall Nord. You analyze opponents and find weaknesses. Read the opponent data carefully and identify: formation, style, key weaknesses, how to exploit them. Be specific. Use the club's terminology: pressing trigger, channel run, flank overload, transition lock.`,
    dataFiles: ['data/opponents/opponents.json'],
  },
  tactics: {
    name: 'Tactics Agent',
    systemPrompt: `You are a tactical assistant for FC Metall Nord. You create match plans based on the club's game model and opponent analysis. The club plays 4-3-3: verticality over possession, press from the front, compact rest-defence (18-20m between lines), flank overloads (winger pins, 10 drifts, fullback underlaps), transition lock (two touches, shot or cross). Be specific.`,
    dataFiles: ['data/club_profile.json', 'data/opponents/opponents.json'],
  },
  player: {
    name: 'Player Agent',
    systemPrompt: `You are a player evaluation assistant for FC Metall Nord. You assess players based on their profiles and the club's game model. Evaluate: does the player fit the system? What are their strengths and weaknesses? How do we cover their weaknesses? Use the club's terminology and principles.`,
    dataFiles: ['data/club_profile.json'],
  },
  install: {
    name: 'Install Agent',
    systemPrompt: `You are the coach's assistant for FC Metall Nord. You write team talks, training plans, and tactical instructions in the club's voice. The club's identity: verticality over possession, press from the front, compact rest-defence, flank overloads, transition lock. Be direct, motivational, and use the club's terminology naturally.`,
    dataFiles: ['data/club_profile.json'],
  }
};

function routeQuery(query) {
  const q = query.toLowerCase();
  if (q.includes('opponent') || q.includes('scout') || q.includes('weakness') || q.includes('analyze') || q.includes('hafen') || q.includes('bergland') || q.includes('stern') || q.includes('eichenwald')) return 'scout';
  if (q.includes('plan') || q.includes('tactic') || q.includes('strategy') || q.includes('game plan') || q.includes('how do we') || q.includes('approach')) return 'tactics';
  if (q.includes('player') || q.includes('evaluate') || q.includes('performance') || q.includes('should') || q.includes('start') || q.includes('sub')) return 'player';
  if (q.includes('team talk') || q.includes('training') || q.includes('install') || q.includes('halftime') || q.includes('talk')) return 'install';
  return 'tactics';
}

function loadContext(agent) {
  let context = '';
  for (const file of agent.dataFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fileExists(fullPath)) {
      const data = readJSON(fullPath);
      context += `\n\n[Data from ${file}]:\n${JSON.stringify(data, null, 2).substring(0, 3000)}`;
    }
  }
  return context;
}

async function main() {
  const healthy = await qvac.healthCheck();
  if (!healthy) {
    log.error('multi-agent', 'QVAC provider not running. See .env.example for setup.');
    process.exit(1);
  }

  // Ingest RAG if not done
  if (!rag.isReady()) {
    try {
      await rag.ingestClubData(config.paths.data);
    } catch (e) {
      log.warn('multi-agent', 'RAG ingestion failed, using agent data files only', { error: e.message });
    }
  }

  // Load model using wrapper
  const modelId = await qvac.loadLLM(MODEL, {
    quantization: config.model.quantization,
    lora: ADAPTER && fileExists(ADAPTER) ? ADAPTER : undefined,
  });
  log.info('multi-agent', 'Model loaded', { model: MODEL, adapter: ADAPTER || 'none' });

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

  console.error('MISTER — Multi-Agent Mode (Scout / Tactics / Player / Install)');
  console.error('Type your question (or "quit" to exit):\n');

  function ask() {
    rl.question('> ', async (query) => {
      if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
        await qvac.unloadModel(modelId);
        rl.close();
        return;
      }

      const agentKey = routeQuery(query);
      const agent = AGENTS[agentKey];
      console.error(`\n[${agent.name}]`);

      const context = loadContext(agent);

      // RAG search for additional context
      let ragContext = '';
      if (rag.isReady()) {
        try {
          const results = await rag.search(query, 3);
          if (results.length > 0) {
            ragContext = '\n\n[Relevant club context:]\n' + results.map(r => r.text.substring(0, 400)).join('\n---\n');
          }
        } catch (e) {
          log.warn('multi-agent', 'RAG search failed', { error: e.message });
        }
      }

      // Use wrapper chat() with correct completion API
      const history = [
        { role: 'system', content: agent.systemPrompt + context + ragContext },
        { role: 'user', content: query }
      ];

      const answer = await qvac.chat(modelId, history, {
        maxTokens: config.model.maxTokens,
        temperature: config.model.temperature,
      });

      console.log(`\n${answer}\n`);
      ask();
    });
  }
  ask();
}

main().catch(err => {
  log.error('multi-agent', 'Error', { error: err.message });
  process.exit(1);
});

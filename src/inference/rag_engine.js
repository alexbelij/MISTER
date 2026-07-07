/**
 * MISTER — Real RAG Engine — v5 FIXED
 * 
 * Uses qvac_wrapper.js for correct ragIngest/ragSearch/embed API calls.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../utils/config');
const log = require('../utils/logger');
const qvac = require('../utils/qvac_wrapper');
const { readJSON, fileExists, chunkText } = require('../utils/helpers');

const WORKSPACE_NAME = 'mister_club_data';
let workspaceReady = false;

/**
 * Ingest all club data into a QVAC RAG workspace.
 */
async function ingestClubData(dataDir = 'data', workspaceName = WORKSPACE_NAME) {
  log.info('rag', 'Starting RAG ingestion', { dir: dataDir, workspace: workspaceName });

  // Check existing workspaces
  const existing = await qvac.ragList();
  const exists = existing.some(w => (w.name || w === workspaceName || w.id === workspaceName));
  if (exists) {
    log.info('rag', 'Workspace exists, deleting for fresh ingest');
    await qvac.ragDelete(workspaceName);
  }

  // Collect documents
  const documents = [];

  // Club profile
  const clubPath = path.join(dataDir, 'club_profile.json');
  if (fileExists(clubPath)) {
    const club = readJSON(clubPath);
    documents.push({
      id: 'club_profile',
      text: `Club: ${club.name}\nFormation: ${club.formation}\nPhilosophy: ${club.philosophy}\n\nTerminology:\n${Object.entries(club.terminology).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nPrinciples:\n${club.principles.map(p => `- ${p}`).join('\n')}\n\nPlayers:\n${club.players.map(p => `- ${p.name} (${p.pos}): ${p.profile}`).join('\n')}`,
      metadata: { type: 'club_profile' }
    });
  }

  // Causal corpus
  const causalPath = path.join(dataDir, 'causal_corpus.json');
  if (fileExists(causalPath)) {
    const docs = readJSON(causalPath);
    for (const doc of docs) {
      const chunks = chunkText(doc.text, config.rag.chunkSize, config.rag.chunkOverlap);
      for (let i = 0; i < chunks.length; i++) {
        documents.push({
          id: `${doc.id}_chunk_${i}`,
          text: chunks[i],
          metadata: { type: doc.type, source: doc.id, chunkIndex: i }
        });
      }
    }
  }

  // Opponents
  const oppPath = path.join(dataDir, 'opponents/opponents.json');
  if (fileExists(oppPath)) {
    const opponents = readJSON(oppPath);
    for (const opp of opponents) {
      documents.push({
        id: `opponent_${opp.name.toLowerCase().replace(/\s+/g, '_')}`,
        text: `Opponent: ${opp.name}\nStyle: ${opp.style}\nWeaknesses: ${opp.weaknesses.join('; ')}\nStrengths: ${opp.strengths.join('; ')}\nLast match: ${opp.last_match}\nKey players: ${opp.key_players.map(p => `${p.name} (${p.pos}): ${p.note}`).join('; ')}`,
        metadata: { type: 'opponent', opponent: opp.name }
      });
    }
  }

  log.info('rag', 'Documents prepared', { count: documents.length });

  // Ingest using wrapper
  const result = await qvac.ragIngest(workspaceName, documents);
  workspaceReady = result.ingested > 0;

  log.info('rag', 'RAG ingestion complete', { workspace: workspaceName, ingested: result.ingested });
  return result;
}

/**
 * Semantic search over club data.
 */
async function search(query, topK = null) {
  const k = topK || config.rag.topK;
  return qvac.ragSearch(WORKSPACE_NAME, query, k);
}

/**
 * Get embedding for a text.
 */
async function getEmbedding(text) {
  return qvac.embed(text);
}

/**
 * Cosine similarity.
 */
function cosineSimilarity(vecA, vecB) {
  return qvac.cosineSimilarity(vecA, vecB);
}

/**
 * Style match using embeddings.
 */
async function styleMatchEmbedding(textA, textB) {
  const [embA, embB] = await Promise.all([getEmbedding(textA), getEmbedding(textB)]);
  if (!embA || !embB) {
    log.warn('rag', 'Embedding failed, falling back to word overlap');
    const { wordOverlap } = require('../utils/helpers');
    return wordOverlap(textA, textB);
  }
  return cosineSimilarity(embA, embB);
}

/**
 * Close workspace.
 */
async function closeWorkspace() {
  await qvac.ragClose(WORKSPACE_NAME);
  workspaceReady = false;
}

/**
 * Delete workspace (GDPR).
 */
async function deleteWorkspace() {
  await qvac.ragDelete(WORKSPACE_NAME);
  workspaceReady = false;
}

function isReady() {
  return workspaceReady;
}

module.exports = {
  ingestClubData,
  search,
  getEmbedding,
  cosineSimilarity,
  styleMatchEmbedding,
  closeWorkspace,
  deleteWorkspace,
  isReady,
  WORKSPACE_NAME,
};

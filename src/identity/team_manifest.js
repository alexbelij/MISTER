/**
 * MISTER — Team Manifest
 * 
 * Signed team membership + role scopes. Each team has one manifest, signed
 * by the team owner's private key. Every peer that opens team data verifies
 * the signature chain before decrypting.
 * 
 * Structure:
 *   {
 *     team_id: "<owner_pubkey>",
 *     name: "FC Alexandria U-15",
 *     created_at: 1720000000,
 *     members: [
 *       { pubkey, role, added_at, added_by, sig },
 *       ...
 *     ],
 *     scopes: {
 *       head_coach: ["read_all", "write_all", "invite", "eject"],
 *       assistant_coach: ["read_all", "write_training", "write_notes"],
 *       analyst: ["read_all", "write_reports"],
 *       player: ["read_self", "read_public"]
 *     },
 *     sig: "<owner signature over the manifest without this field>"
 *   }
 * 
 * The manifest itself is stored in the team's Hypercore as the first entry
 * (block 0) — Autobase merges any later signed updates from the owner.
 */

'use strict';

const IS_NODE = typeof process !== 'undefined' && process.versions && process.versions.node;

const DEFAULT_SCOPES = {
  head_coach:      ['read_all', 'write_all', 'invite', 'eject', 'rotate_key'],
  assistant_coach: ['read_all', 'write_training', 'write_notes'],
  analyst:         ['read_all', 'write_reports'],
  player:          ['read_self', 'read_public'],
};

/**
 * Create a new team manifest.
 * The identity that calls this becomes the team owner (head_coach).
 */
async function createTeam(identity, { name, scopes = DEFAULT_SCOPES } = {}) {
  if (!identity || !identity.publicKey || !identity.sign) {
    throw new Error('createTeam requires an identity from loadOrCreate()');
  }
  if (!name) throw new Error('team name is required');

  const now = Math.floor(Date.now() / 1000);
  const owner = identity.publicKey;

  const manifest = {
    team_id: owner,
    name,
    created_at: now,
    members: [
      {
        pubkey: owner,
        role: 'head_coach',
        added_at: now,
        added_by: owner,
      },
    ],
    scopes,
    version: 1,
  };

  manifest.sig = await identity.sign(canonicalize(manifest));
  // sign owner-member entry as well
  manifest.members[0].sig = await identity.sign(canonicalize(manifest.members[0]));
  return manifest;
}

/**
 * Add a new member. Only the owner (head_coach) may add.
 */
async function addMember(manifest, ownerIdentity, { pubkey, role }) {
  if (ownerIdentity.publicKey !== manifest.team_id) {
    throw new Error('only the team owner may add members');
  }
  if (!manifest.scopes[role]) {
    throw new Error(`unknown role: ${role}`);
  }
  if (manifest.members.find(m => m.pubkey === pubkey)) {
    throw new Error('pubkey already a member');
  }
  const now = Math.floor(Date.now() / 1000);
  const entry = {
    pubkey,
    role,
    added_at: now,
    added_by: ownerIdentity.publicKey,
  };
  entry.sig = await ownerIdentity.sign(canonicalize(entry));
  manifest.members.push(entry);
  manifest.version += 1;
  // resign top-level manifest (drop stale sig first)
  delete manifest.sig;
  manifest.sig = await ownerIdentity.sign(canonicalize(manifest));
  return manifest;
}

/**
 * Remove a member. Only the owner may remove.
 */
async function removeMember(manifest, ownerIdentity, pubkey) {
  if (ownerIdentity.publicKey !== manifest.team_id) {
    throw new Error('only the team owner may remove members');
  }
  const before = manifest.members.length;
  manifest.members = manifest.members.filter(m => m.pubkey !== pubkey);
  if (manifest.members.length === before) return manifest;
  manifest.version += 1;
  delete manifest.sig;
  manifest.sig = await ownerIdentity.sign(canonicalize(manifest));
  return manifest;
}

/**
 * Verify a manifest is well-formed and signed by the declared owner.
 * Also verifies each member entry sig.
 */
async function verifyManifest(manifest, identity) {
  if (!manifest || !manifest.team_id || !manifest.sig) return false;
  if (!manifest.members || manifest.members.length === 0) return false;

  // top-level sig
  const { sig, ...rest } = manifest;
  const ok = await identity.verify(manifest.team_id, canonicalize(rest), sig);
  if (!ok) return false;

  // each member entry
  for (const m of manifest.members) {
    if (!m.sig) return false;
    const { sig: msig, ...mrest } = m;
    const mok = await identity.verify(m.added_by, canonicalize(mrest), msig);
    if (!mok) return false;
  }
  return true;
}

/**
 * Return the effective role for a pubkey (or null if not a member).
 */
function roleOf(manifest, pubkey) {
  const m = manifest.members.find(x => x.pubkey === pubkey);
  return m ? m.role : null;
}

/**
 * Check whether pubkey has a given scope.
 */
function hasScope(manifest, pubkey, scope) {
  const role = roleOf(manifest, pubkey);
  if (!role) return false;
  const scopes = manifest.scopes[role] || [];
  return scopes.includes(scope) || scopes.includes('write_all') || scopes.includes('read_all') && scope.startsWith('read_');
}

/**
 * Deterministic JSON — required so signatures verify across platforms.
 * Sorts keys, drops undefined, no trailing whitespace.
 */
function canonicalize(obj) {
  return JSON.stringify(sortKeys(obj));
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

if (IS_NODE && typeof module !== 'undefined') {
  module.exports = {
    createTeam, addMember, removeMember, verifyManifest,
    roleOf, hasScope, canonicalize, DEFAULT_SCOPES,
  };
}
if (typeof window !== 'undefined') {
  window.MisterTeamManifest = {
    createTeam, addMember, removeMember, verifyManifest,
    roleOf, hasScope, DEFAULT_SCOPES,
  };
}

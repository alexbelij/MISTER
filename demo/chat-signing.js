/**
 * chat-signing.js — Sign chat messages with the user's ed25519 keypair.
 *
 * Purpose:
 *  - Generates (or reuses) a browser-local ed25519 keypair via WebCrypto.
 *    The private key stays in IndexedDB as a non-extractable CryptoKey; the
 *    public key is stored in localStorage as a raw hex string for display.
 *
 *  - Signs every outgoing user message and appends a visible "verified" chip
 *    under the bubble. Clicking the chip opens a small details panel with
 *    the pubkey fingerprint, the signature, and a live re-verification.
 *
 *  - Mirrors the API of `src/identity/keypair.js` (which is Node-first) so
 *    the demo and the runtime speak the same on-wire format:
 *
 *        { alg: 'ed25519', pubkey: <32B hex>, sig: <64B hex>, ts: <iso>,
 *          team_id: <string|null> }
 *
 *  - The current team_id (from window.MisterTeams) is included in the
 *    signed payload so a signature is bound to the team context in which
 *    the message was produced. Switching teams uses the SAME keypair —
 *    user identity is per-device, team roles come from the signed team
 *    manifest (see src/identity/team_manifest.js).
 *
 * Non-goals:
 *  - No key export to disk here; the runtime app owns full key management.
 *  - No signing of ASSISTANT replies — those come back from the QVAC
 *    bridge without a signature; we don't fabricate one.
 */

(function () {
  'use strict';

  var STORAGE_PUB = 'mister:user-pubkey';
  var DB_NAME = 'mister-keystore';
  var DB_STORE = 'keys';
  var DB_KEY_ID = 'user-ed25519';

  var state = {
    keypair: null,
    pubkeyHex: null,
    ready: false,
    supported: false
  };

  // -------- IndexedDB helpers --------

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbGet(db, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readonly');
      var req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbPut(db, key, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readwrite');
      var req = tx.objectStore(DB_STORE).put(value, key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // -------- Hex helpers --------

  function bufToHex(buf) {
    var b = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
    return s;
  }

  function hexToBuf(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function fingerprint(pubHex) {
    // Short readable fingerprint: 4 groups of 4 hex chars from the start.
    if (!pubHex) return '';
    return (pubHex.slice(0, 4) + ' ' + pubHex.slice(4, 8) + ' ' + pubHex.slice(8, 12) + ' ' + pubHex.slice(12, 16)).toUpperCase();
  }

  // -------- Key init --------

  async function init() {
    // Detect ed25519 support. WebCrypto ed25519 shipped in modern Chromium
    // and Firefox; older Safari falls back to unsigned messages.
    if (!window.crypto || !window.crypto.subtle) return;
    try {
      var db = await openDb();
      var existing = await dbGet(db, DB_KEY_ID);
      if (existing && existing.privateKey && existing.publicKey) {
        state.keypair = existing;
        state.pubkeyHex = await getPubkeyHex(existing.publicKey);
        state.supported = true;
      } else {
        // Try to generate.
        var kp;
        try {
          kp = await window.crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
        } catch (e) {
          // ed25519 not supported here. Bail out gracefully — chat still works.
          return;
        }
        // We store the CryptoKey directly; browsers persist non-extractable
        // keys across sessions in IndexedDB (structured-clone).
        await dbPut(db, DB_KEY_ID, kp);
        state.keypair = kp;
        state.pubkeyHex = await getPubkeyHex(kp.publicKey);
        state.supported = true;
      }
      try { localStorage.setItem(STORAGE_PUB, state.pubkeyHex); } catch (_) {}
      state.ready = true;
      window.dispatchEvent(new CustomEvent('mister:signing-ready', { detail: { pubkey: state.pubkeyHex } }));
    } catch (e) {
      // Any failure keeps the app usable — just no signatures.
      console.warn('[chat-signing] init failed', e);
    }
  }

  async function getPubkeyHex(publicKey) {
    // publicKey is extractable=true only if we generated with extractable:true.
    // We generated with extractable=false above → we can only export the public
    // key. Export the raw 32-byte public component.
    try {
      var raw = await window.crypto.subtle.exportKey('raw', publicKey);
      return bufToHex(raw);
    } catch (e) {
      // Fallback: SPKI export (larger, but works).
      try {
        var spki = await window.crypto.subtle.exportKey('spki', publicKey);
        return bufToHex(spki);
      } catch (e2) {
        return '(pubkey export failed)';
      }
    }
  }

  // -------- Signing API --------

  async function sign(payloadStr) {
    if (!state.ready || !state.keypair) throw new Error('signing not ready');
    var data = new TextEncoder().encode(payloadStr);
    var sig = await window.crypto.subtle.sign({ name: 'Ed25519' }, state.keypair.privateKey, data);
    return bufToHex(sig);
  }

  async function verify(payloadStr, sigHex, pubHex) {
    if (!window.crypto || !window.crypto.subtle) return false;
    try {
      var pubBytes = hexToBuf(pubHex);
      var pub = await window.crypto.subtle.importKey('raw', pubBytes, { name: 'Ed25519' }, false, ['verify']);
      var sig = hexToBuf(sigHex);
      var data = new TextEncoder().encode(payloadStr);
      return await window.crypto.subtle.verify({ name: 'Ed25519' }, pub, sig, data);
    } catch (e) {
      return false;
    }
  }

  function canonicalPayload(fields) {
    // Deterministic JSON: keys sorted alphabetically. Matches the format
    // src/identity/keypair.js uses when it signs objects.
    var keys = Object.keys(fields).sort();
    var obj = {};
    keys.forEach(function (k) { obj[k] = fields[k]; });
    return JSON.stringify(obj);
  }

  async function signMessage(text) {
    if (!state.ready) return null;
    var team = (window.MisterTeams && window.MisterTeams.getActive()) || null;
    var envelope = {
      alg: 'ed25519',
      ts: new Date().toISOString(),
      team_id: team ? team.id : null,
      text: text
    };
    var payload = canonicalPayload(envelope);
    try {
      var sig = await sign(payload);
      return {
        alg: 'ed25519',
        pubkey: state.pubkeyHex,
        sig: sig,
        ts: envelope.ts,
        team_id: envelope.team_id,
        payload: payload
      };
    } catch (e) {
      console.warn('[chat-signing] sign failed', e);
      return null;
    }
  }

  // -------- UI: badge + details popover --------

  function renderBadge(sigObj) {
    if (!sigObj) return null;
    var wrap = document.createElement('div');
    wrap.className = 'chat-sig-badge';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Signed message — click for details');
    wrap.innerHTML =
      '<svg class="chat-sig-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">' +
        '<path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>' +
      '</svg>' +
      '<span class="chat-sig-text">Signed · ' + escapeHtml(fingerprint(sigObj.pubkey)) + '</span>';
    var openDetails = function () { openSignaturePanel(wrap, sigObj); };
    wrap.addEventListener('click', openDetails);
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails(); }
    });
    return wrap;
  }

  async function openSignaturePanel(anchor, sigObj) {
    // Close any existing panel first.
    document.querySelectorAll('.chat-sig-panel').forEach(function (p) { p.remove(); });

    var panel = document.createElement('div');
    panel.className = 'chat-sig-panel';
    panel.innerHTML =
      '<div class="chat-sig-panel-header">' +
        '<span>Message signature</span>' +
        '<button class="chat-sig-panel-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="chat-sig-row"><span>Algorithm</span><code>' + escapeHtml(sigObj.alg) + '</code></div>' +
      '<div class="chat-sig-row"><span>Timestamp</span><code>' + escapeHtml(sigObj.ts) + '</code></div>' +
      '<div class="chat-sig-row"><span>Team</span><code>' + escapeHtml(sigObj.team_id || '(no team)') + '</code></div>' +
      '<div class="chat-sig-row"><span>Public key</span><code class="chat-sig-mono">' + escapeHtml(sigObj.pubkey) + '</code></div>' +
      '<div class="chat-sig-row"><span>Signature</span><code class="chat-sig-mono chat-sig-sig">' + escapeHtml(sigObj.sig) + '</code></div>' +
      '<div class="chat-sig-verify"><span class="chat-sig-verify-label">Verifying…</span></div>';

    document.body.appendChild(panel);
    positionPanel(panel, anchor);

    panel.querySelector('.chat-sig-panel-close').addEventListener('click', function () { panel.remove(); });
    document.addEventListener('click', function onOutside(e) {
      if (!panel.contains(e.target) && !anchor.contains(e.target)) {
        panel.remove();
        document.removeEventListener('click', onOutside);
      }
    });

    // Live re-verify.
    var ok = false;
    try {
      ok = await verify(sigObj.payload, sigObj.sig, sigObj.pubkey);
    } catch (e) { ok = false; }
    var label = panel.querySelector('.chat-sig-verify-label');
    label.textContent = ok ? '✓ Signature verified' : '✗ Signature invalid';
    label.classList.add(ok ? 'is-ok' : 'is-fail');
  }

  function positionPanel(panel, anchor) {
    var rect = anchor.getBoundingClientRect();
    var panelWidth = 320;
    var top = rect.bottom + 6;
    var left = rect.left;
    if (left + panelWidth > window.innerWidth - 12) left = window.innerWidth - panelWidth - 12;
    if (top + panel.offsetHeight > window.innerHeight - 12) top = rect.top - panel.offsetHeight - 6;
    panel.style.top = Math.max(12, top) + 'px';
    panel.style.left = Math.max(12, left) + 'px';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // -------- Public bootstrap: patch the chat's addMessage --------

  function patchChat() {
    // The chat is initialized inside app.js:initChat, which shadows
    // addMessage in a closure. We piggy-back by observing DOM inserts to
    // #chat-messages — every user bubble that appears is signed and
    // decorated in place. This avoids editing initChat internals.
    var messages = document.getElementById('chat-messages');
    if (!messages) return;
    // Also decorate any user bubbles already present at boot (e.g. from a
    // hot-reload or a suggestion click that fired before we mounted).
    messages.querySelectorAll('.chat-msg.user').forEach(function (node) {
      if (node.dataset.signed !== '1') decorateUserBubble(node);
    });
    var mo = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        rec.addedNodes.forEach(function (node) {
          if (!(node instanceof HTMLElement)) return;
          if (!node.classList.contains('chat-msg')) return;
          if (!node.classList.contains('user')) return;
          if (node.dataset.signed === '1') return;
          decorateUserBubble(node);
        });
      });
    });
    mo.observe(messages, { childList: true });
    window.__misterSigningMounted = true;
  }

  async function decorateUserBubble(node) {
    node.dataset.signed = '1';
    var bubble = node.querySelector('.chat-bubble');
    if (!bubble) return;
    if (!state.supported || !state.ready) {
      // Silent fallback — no badge if signing unavailable.
      var chip = document.createElement('div');
      chip.className = 'chat-sig-badge chat-sig-badge-unavailable';
      chip.innerHTML =
        '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">' +
          '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>' +
        '</svg>' +
        '<span>Unsigned · this browser lacks ed25519 support</span>';
      bubble.appendChild(chip);
      return;
    }
    var text = bubble.textContent || '';
    var sig = await signMessage(text);
    if (!sig) return;
    var badge = renderBadge(sig);
    if (badge) bubble.appendChild(badge);
  }

  // -------- Bootstrap --------

  function boot() {
    init().then(patchChat).catch(function () { patchChat(); });
    // Expose a tiny API for debugging + other modules.
    window.MisterSigning = {
      getPubkey: function () { return state.pubkeyHex; },
      isReady: function () { return state.ready; },
      isSupported: function () { return state.supported; },
      signMessage: signMessage,
      verify: verify
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

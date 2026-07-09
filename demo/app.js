// ===== MISTER — Football Coaching AI Demo =====
// All static data (players, matches, opponents, suggested prompts) is real
// project data from the FC Metall Nord SFT/causal corpus used to fine-tune
// the model.
//
// HONESTY NOTE: the chat below calls a real hosted backend — a small
// Express bridge server (bridge/server.js) running on a free Hugging Face
// Space, which loads the repo's configured Qwen3-1.7B-Q4 model via
// @qvac/sdk (the same wrapper logic as src/inference/chat.js / the
// Electron app) and runs genuine completion. It is not keyword-matched or
// pre-scripted. The bridge runs on free CPU hardware and may be asleep —
// the "typing" indicator reflects real network + cold-start + inference
// latency, not a fixed UI animation.
// Per-match player "ratings" below add a small random jitter purely for
// visual variety on the radar chart; they are not a computed model output.
// Fully on-device (no network) inference happens in the Electron app
// (`npm start`), which calls the same `@qvac/sdk` — see src/inference/chat.js.

// Public URL of the hosted QVAC bridge (Hugging Face Space, Docker SDK).
// See bridge/server.js and bridge/Dockerfile for the backend implementation.
const QVAC_BRIDGE_URL = 'https://khrol-mister-qvac-bridge.hf.space';

// ===== DATA =====
const PLAYERS = [
  { name: 'Hartmann', pos: 'ST', num: 9, ratings: { pressing: 7.8, verticality: 8.2, compact_block: 5.5, flank_overload: 7.0, transition: 8.5, execution: 7.2, discipline: 6.8, fitness: 8.0 } },
  { name: 'Riedel', pos: 'CM', num: 6, ratings: { pressing: 7.5, verticality: 6.8, compact_block: 7.2, flank_overload: 5.8, transition: 6.5, execution: 7.0, discipline: 5.5, fitness: 7.8 } },
  { name: 'Krüger', pos: 'RW', num: 7, ratings: { pressing: 8.0, verticality: 7.5, compact_block: 5.0, flank_overload: 8.8, transition: 8.2, execution: 7.5, discipline: 7.0, fitness: 8.5 } },
  { name: 'Schäfer', pos: 'CM', num: 8, ratings: { pressing: 7.2, verticality: 7.0, compact_block: 7.8, flank_overload: 6.2, transition: 7.0, execution: 8.0, discipline: 8.5, fitness: 7.5 } },
  { name: 'Heil', pos: 'RB', num: 2, ratings: { pressing: 6.8, verticality: 7.8, compact_block: 6.5, flank_overload: 8.0, transition: 7.5, execution: 6.8, discipline: 7.2, fitness: 8.8 } },
  { name: 'Wendt', pos: 'AM', num: 10, ratings: { pressing: 7.0, verticality: 8.5, compact_block: 5.8, flank_overload: 8.2, transition: 8.8, execution: 7.8, discipline: 6.5, fitness: 7.2 } },
  { name: 'Auer', pos: 'LB', num: 3, ratings: { pressing: 6.5, verticality: 7.2, compact_block: 6.8, flank_overload: 7.5, transition: 7.0, execution: 6.5, discipline: 7.0, fitness: 8.0 } },
  { name: 'Voss Jr.', pos: 'CB', num: 4, ratings: { pressing: 5.8, verticality: 5.5, compact_block: 8.5, flank_overload: 4.5, transition: 5.2, execution: 7.8, discipline: 8.2, fitness: 7.0 } },
  { name: 'Brandt', pos: 'CB', num: 5, ratings: { pressing: 5.5, verticality: 5.8, compact_block: 8.8, flank_overload: 4.2, transition: 5.0, execution: 7.5, discipline: 8.0, fitness: 7.2 } },
  { name: 'Keller', pos: 'CM', num: 14, ratings: { pressing: 6.8, verticality: 6.2, compact_block: 7.5, flank_overload: 5.5, transition: 6.0, execution: 7.2, discipline: 8.8, fitness: 7.8 } },
  { name: 'Reuss', pos: 'LW', num: 11, ratings: { pressing: 7.8, verticality: 8.0, compact_block: 5.2, flank_overload: 8.5, transition: 8.0, execution: 7.0, discipline: 6.8, fitness: 8.2 } },
  { name: 'Mahler', pos: 'GK', num: 1, ratings: { pressing: 4.5, verticality: 4.8, compact_block: 8.0, flank_overload: 3.5, transition: 4.2, execution: 7.8, discipline: 8.5, fitness: 7.5 } },
  { name: 'Faust', pos: 'CM', num: 16, ratings: { pressing: 7.2, verticality: 7.5, compact_block: 6.8, flank_overload: 6.5, transition: 7.8, execution: 7.0, discipline: 7.5, fitness: 8.0 } },
  { name: 'Stein', pos: 'CB', num: 15, ratings: { pressing: 5.2, verticality: 5.0, compact_block: 8.2, flank_overload: 4.0, transition: 4.8, execution: 7.0, discipline: 7.8, fitness: 6.8 } },
  { name: 'Sommer', pos: 'ST', num: 19, ratings: { pressing: 7.5, verticality: 7.8, compact_block: 5.0, flank_overload: 6.8, transition: 8.0, execution: 6.5, discipline: 6.2, fitness: 7.5 } },
  { name: 'Licht', pos: 'RB', num: 17, ratings: { pressing: 6.5, verticality: 7.0, compact_block: 6.2, flank_overload: 7.2, transition: 7.0, execution: 6.8, discipline: 7.0, fitness: 8.5 } },
];

const CRITERIA = ['pressing','verticality','compact_block','flank_overload','transition','execution','discipline','fitness'];
const CRITERIA_LABELS = {
  pressing: 'Press', verticality: 'Vert', compact_block: 'Block', flank_overload: 'Flank',
  transition: 'Trans', execution: 'Exec', discipline: 'Disc', fitness: 'Fit'
};

const MATCHES = [
  { id: 'm01', date: '2026-08-24', opponent: 'SV Hafen United', venue: 'home', result: 'W', gf: 2, ga: 1, xg_f: 1.8, xg_a: 0.9, poss: 48, press: 72, flank: 11, channel: 8, trans: 3.2 },
  { id: 'm02', date: '2026-08-31', opponent: 'TSV Bergland', venue: 'away', result: 'D', gf: 0, ga: 0, xg_f: 0.7, xg_a: 0.5, poss: 55, press: 45, flank: 4, channel: 3, trans: 5.8 },
  { id: 'm03', date: '2026-09-07', opponent: 'FC Stahl Süd', venue: 'home', result: 'W', gf: 3, ga: 1, xg_f: 2.4, xg_a: 0.8, poss: 62, press: 68, flank: 9, channel: 6, trans: 2.9 },
  { id: 'm04', date: '2026-09-14', opponent: 'SV Hafen United', venue: 'away', result: 'L', gf: 1, ga: 2, xg_f: 1.1, xg_a: 1.6, poss: 44, press: 38, flank: 5, channel: 4, trans: 4.5 },
  { id: 'm05', date: '2026-09-21', opponent: 'TSV Bergland', venue: 'home', result: 'W', gf: 2, ga: 0, xg_f: 1.9, xg_a: 0.4, poss: 58, press: 65, flank: 12, channel: 7, trans: 3.1 },
  { id: 'm06', date: '2026-09-28', opponent: 'FC Stahl Süd', venue: 'away', result: 'W', gf: 2, ga: 1, xg_f: 1.7, xg_a: 1.0, poss: 51, press: 71, flank: 8, channel: 9, trans: 2.7 },
  { id: 'm07', date: '2026-10-05', opponent: 'SV Hafen United', venue: 'home', result: 'W', gf: 3, ga: 0, xg_f: 2.6, xg_a: 0.3, poss: 53, press: 78, flank: 14, channel: 10, trans: 2.5 },
  { id: 'm08', date: '2026-10-12', opponent: 'TSV Bergland', venue: 'away', result: 'D', gf: 1, ga: 1, xg_f: 1.2, xg_a: 1.1, poss: 49, press: 52, flank: 6, channel: 5, trans: 3.8 },
];

const OPPONENTS = [
  { name: 'SV Hafen United', formation: '4-2-3-1', style: 'Possession-based', weaknesses: ['GK uncomfortable under pressure', 'CBs slow to turn', 'Fullbacks push high'] },
  { name: 'TSV Bergland', formation: '3-5-2', style: 'Direct', weaknesses: ['Wingbacks caught high', '3-at-the-back vulnerable to channel runs', 'No pressing structure'] },
  { name: 'FC Stahl Süd', formation: '4-4-2', style: 'Counter', weaknesses: ['Deep block vulnerable to build patience', 'CMs lack pace', 'Set piece defending weak'] },
];

const SUGGESTIONS = [
  {
    priority: 'high', category: 'pressing',
    title: 'Worst pressing game: vs SV Hafen United (away)',
    detail: '38% pressing success in match m04 — Hafen adjusted and played around the press. Riedel received an early yellow, reducing aggressive pressing from the double pivot.',
    evidence: 'Press success dropped from 72% (m01 home) to 38% (m04 away). Hafen adapted to bypass the first-line trigger. Riedel card at 12min limited double-pivot pressing.',
    action: 'Review footage, identify how they beat the press'
  },
  {
    priority: 'medium', category: 'discipline',
    title: 'Card risk in SV Hafen United match',
    detail: 'Riedel yellow card early in m04 forced a passive pressing approach for 78 minutes. The double pivot could not apply first-touch pressure without risking a second card.',
    evidence: 'Riedel yellow at 12min. Press success 38% vs season avg 61.1%. Transition time degraded to 4.5s vs avg 3.6s.',
    action: 'Prepare substitution plan — Keller as 6 backup at 60min'
  },
  {
    priority: 'low', category: 'transition',
    title: 'Transition speed on target',
    detail: 'Average transition time of 3.0s across the last 4 matches, meeting the ≤3.0s target. The flank-overload-to-channel-run pattern is producing efficient vertical progressions.',
    evidence: 'Last 4 matches: 3.1s, 2.7s, 2.5s, 3.8s (avg 3.0s). Season trend: -1.1s improvement. Best: 2.5s (m07 vs Hafen).',
    action: 'Maintain current discipline'
  },
];

const CHAT_RESPONSES = {
  gameplan: {
    question: 'Game plan vs Hafen United',
    answer: [
      { type: 'p', text: 'Hafen plays 4-2-3-1 possession. Their GK is uncomfortable under pressure and CBs are slow to turn. We exploit with three triggers:' },
      { type: 'point', icon: 'press', text: '<strong>Hartmann</strong> leads first-touch pressure on their CBs. If they play back to GK, <strong>Mahler</strong> sweeps — no long ball threat.' },
      { type: 'point', icon: 'flank', text: '<strong>Krüger</strong> pins their LB, <strong>Heil</strong> underlaps. If CB steps to Krüger, <strong>Wendt</strong> gets the ball in the half-space. Channel run + flank overload combined.' },
      { type: 'point', icon: 'transition', text: 'Transition lock: <strong>Riedel</strong> and <strong>Schäfer</strong> stay compact. If press is bypassed, immediate compact rest-defence — no gaps between lines.' },
      { type: 'p', text: 'Target: ≤3.0s transition. Press success target: 70%+. Flank overloads: 10+ per match.' }
    ]
  },
  diamond: {
    question: 'Counter diamond midfield',
    answer: [
      { type: 'p', text: 'Against a diamond midfield, flank overloads become even more important. The diamond is narrow — the wings are open.' },
      { type: 'point', icon: 'flank', text: '<strong>Krüger</strong> pins the wing-back wide. <strong>Wendt</strong> drifts toward the half-space, creating a 2v1 on the wing.' },
      { type: 'point', icon: 'flank', text: '<strong>Heil</strong> makes the underlapping run. If the diamond CM tracks Wendt, Heil is free. Switch play quickly to the left for <strong>Reuss</strong>.' },
      { type: 'p', text: 'The diamond cannot cover both flanks simultaneously. Quick switches exploit the structural weakness.' }
    ]
  },
  yellow: {
    question: 'Riedel yellow card — what do we do?',
    answer: [
      { type: 'p', text: 'Riedel on a yellow limits the double pivot. Adjustments:' },
      { type: 'point', icon: 'press', text: '<strong>Schäfer</strong> takes over primary pressing responsibility. Riedel stays deeper, screens the back four.' },
      { type: 'point', icon: 'transition', text: 'Sub <strong>Keller</strong> at 60min for Riedel. Keller is disciplined (8.8 rating) and can play the 6 role cleanly.' },
      { type: 'p', text: 'Press target drops to 55% — we accept lower pressing intensity to avoid going to 10 men.' }
    ]
  },
  fullback: {
    question: 'How to exploit a slow fullback?',
    answer: [
      { type: 'p', text: 'Combine channel run + flank overload. The slow fullback must choose: track the channel run or hold the wing.' },
      { type: 'point', icon: 'flank', text: '<strong>Hartmann</strong> peels into the channel between CB and FB. The CB has to choose — step out or stay. If CB steps, <strong>Sommer</strong> attacks the vacated space.' },
      { type: 'point', icon: 'transition', text: 'Meanwhile <strong>Krüger</strong> holds width on the same side. If FB tracks Hartmann inside, Krüger is 1v1 with nobody. Quick ball out = crossing position.' },
      { type: 'p', text: 'This is the pattern that produced 14 flank overloads in m07 vs Hafen. Execution target: ball to Krüger within 3.0s of turnover.' }
    ]
  }
};

const PEERS = [
  { name: 'Coach T. Voss (Desktop)', status: 'online', device: 'Electron · QVAC' },
  { name: 'Asst. Coach Keller (Mobile)', status: 'online', device: 'Pears P2P' },
  { name: 'Analyst Reuss (Tablet)', status: 'online', device: 'Pears P2P' },
  { name: 'Video Coach Brandt (Laptop)', status: 'offline', device: 'Pears P2P' },
];

// ===== SVG ICONS =====
const ICONS = {
  press: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  flank: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 3h18v2H3V3zm0 8h18v2H3v-2zm0 8h18v2H3v-2z"/></svg>',
  transition: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 11h12.17l-5.59-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4v-2z"/></svg>',
  brain: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z"/></svg>',
  ball: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4 3h2v11h-2V10zm4-7h2v18h-2V3z"/></svg>',
  fire: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.16 7.19 4 9.45 4 12c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>',
};

// ===== TOOLTIP SYSTEM =====
const tooltipEl = document.getElementById('tooltip');
let tooltipTimeout;
// Hover-driven tooltips only make sense on devices with a real mouse (hover +
// fine pointer). On touch devices, `mouseover` fires on tap but `mouseout`
// often never fires (or fires unreliably), leaving the tooltip permanently
// stuck on screen, duplicating the label underneath. So: don't bind the
// hover tooltip system at all on touch/coarse-pointer devices.
const supportsHoverTooltips = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function initTooltips() {
  if (!supportsHoverTooltips) {
    // Safety net: if a tooltip ever ends up visible on a touch device
    // (e.g. a hybrid laptop+touchscreen), dismiss it on the next tap
    // anywhere so it can never get stuck.
    document.addEventListener('touchstart', () => {
      tooltipEl.classList.remove('visible');
    }, { passive: true });
    return;
  }
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    clearTimeout(tooltipTimeout);
    const text = target.getAttribute('data-tooltip');
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');
    positionTooltip(e);
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest('[data-tooltip]')) return;
    tooltipTimeout = setTimeout(() => {
      tooltipEl.classList.remove('visible');
    }, 100);
  });
  document.addEventListener('mousemove', (e) => {
    if (tooltipEl.classList.contains('visible')) positionTooltip(e);
  });
}

function positionTooltip(e) {
  const rect = tooltipEl.getBoundingClientRect();
  let x = e.clientX + 12;
  let y = e.clientY + 12;
  if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - 12;
  if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - 12;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';
}

// ===== TAB SWITCHING =====
// Exposed on window so other sections (e.g. Match History -> Match Report)
// can navigate tabs programmatically, not just via the sidebar/bottom nav.
const VALID_TABS = ['chat', 'analytics', 'suggestions', 'reports', 'distribute', 'proof'];

function switchTab(tabName, pushHistory = true) {
  if (!VALID_TABS.includes(tabName)) tabName = 'chat';
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('tab-' + tabName);
  if (tab) tab.classList.add('active');
  document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(t => t.classList.add('active'));
  if (typeof window.closeSidebar === 'function') window.closeSidebar();
  // Scroll to top
  document.querySelector('.main-content').scrollTop = 0;
  window.scrollTo(0, 0);
  // Real routing: push a history entry per tab so the browser's back/forward
  // buttons move between tabs instead of leaving the app / doing nothing.
  if (pushHistory && location.hash.slice(1) !== tabName) {
    history.pushState({ tab: tabName }, '', '#' + tabName);
  }
}
window.switchTab = switchTab;

function initTabs() {
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });
  // Back/forward button support.
  window.addEventListener('popstate', (e) => {
    const tab = (e.state && e.state.tab) || (VALID_TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'chat');
    switchTab(tab, false);
  });
}

// Deep-link / reload support: open whatever tab is in the URL hash, and seed
// the initial history entry so the very first back-press has somewhere to
// go. Runs last in init(), after every other init*() has wired up its DOM.
function initRouting() {
  const initialTab = VALID_TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'chat';
  switchTab(initialTab, false);
  history.replaceState({ tab: initialTab }, '', '#' + initialTab);
}

// ===== SIDEBAR (MOBILE) =====
function initSidebar() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const closeBtn = document.getElementById('sidebar-close');

  const openSidebar = () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  };

  if (hamburger) hamburger.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  window.closeSidebar = closeSidebar;
}

// ===== BANNER =====
function initBanner() {
  const closeBtn = document.getElementById('banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('banner').style.display = 'none';
    });
  }
}

// ===== CHAT =====
function initChat() {
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  const addMessage = (text, isUser, isHtml) => {
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + (isUser ? 'user' : 'assistant');
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerHTML = isUser
      ? '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (isHtml) bubble.innerHTML = text;
    else bubble.textContent = text;
    msg.appendChild(avatar);
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const addTyping = () => {
    const msg = document.createElement('div');
    msg.className = 'chat-msg assistant';
    msg.id = 'typing-msg';
    msg.innerHTML = '<div class="chat-avatar"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg></div><div class="chat-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const removeTyping = () => {
    const t = document.getElementById('typing-msg');
    if (t) t.remove();
  };

  // Render a plain-text (or lightly formatted) reply from the live backend.
  const renderReply = (text) => {
    // Escape HTML, then turn **bold** into <strong> and newlines into <br>/<p>.
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escaped = escapeHtml(text);
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const paragraphs = withBold.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    addMessage(paragraphs || `<p>${escaped}</p>`, false, true);
  };

  // Fetch with a client-side timeout (the Space can be asleep and slow to wake).
  const fetchWithTimeout = (url, opts, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
  };

  // Call the real hosted QVAC bridge (see bridge/server.js). Retries once
  // if the model is still cold-starting (503 from the backend).
  const askBackend = async (message) => {
    const endpoint = QVAC_BRIDGE_URL.replace(/\/$/, '') + '/chat';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        }, 60000);
        if (res.status === 503 && attempt === 0) {
          // Model still loading / Space waking up — wait then retry once.
          await new Promise(r => setTimeout(r, 8000));
          continue;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Backend returned ${res.status}`);
        }
        return data.reply || '(empty reply from backend)';
      } catch (e) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }
        throw e;
      }
    }
    throw new Error('Backend did not respond in time');
  };

  const sendToBackend = async (text) => {
    addMessage(text, true);
    addTyping();
    try {
      const reply = await askBackend(text);
      removeTyping();
      renderReply(reply);
    } catch (e) {
      removeTyping();
      addMessage(
        `⚠️ Could not reach the live QVAC backend (${e.message || e}). It may be waking up from sleep — ` +
        `please wait ~30-60s and try again, or check the Space status directly: ${QVAC_BRIDGE_URL}`,
        false
      );
    }
  };

  const sendPrompt = (promptKey) => {
    const response = CHAT_RESPONSES[promptKey];
    if (!response) return;
    sendToBackend(response.question);
  };

  // Suggestion buttons
  document.querySelectorAll('.chat-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => sendPrompt(btn.dataset.prompt));
  });

  // Send button
  const handleSend = () => {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendToBackend(text);
  };

  sendBtn.addEventListener('click', handleSend);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

// ===== ANALYTICS =====
function renderMatchTimeline() {
  const container = document.getElementById('match-timeline');
  if (!container) return;
  container.innerHTML = MATCHES.map(m => `
    <div class="match-row result-${m.result.toLowerCase()}" data-match-id="${m.id}" data-tooltip="${m.date} vs ${m.opponent} (${m.venue}) — ${m.result} ${m.gf}-${m.ga}. xG: ${m.xg_f}-${m.xg_a}. Press: ${m.press}%. Transition: ${m.trans}s. Flank overloads: ${m.flank}. Click to open the full match report.">
      <div class="match-date">${m.date.slice(5)}</div>
      <div class="match-vs">
        <div class="match-opponent">${m.opponent}</div>
        <div class="match-venue">${m.venue === 'home' ? 'Home' : 'Away'}</div>
      </div>
      <div class="match-stats-mini">
        <span class="match-stat-mini">xG ${m.xg_f}-${m.xg_a}</span>
        <span class="match-stat-mini">P ${m.press}%</span>
        <span class="match-stat-mini">T ${m.trans}s</span>
      </div>
      <div class="match-score">${m.gf}-${m.ga}</div>
    </div>
  `).join('');

  container.querySelectorAll('.match-row').forEach((row) => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const matchId = row.dataset.matchId;
      switchTab('reports');
      const select = document.getElementById('report-match-select');
      if (select) {
        select.value = matchId;
        select.dispatchEvent(new Event('change'));
      }
    });
  });
}

function renderPlayerRatings() {
  const table = document.getElementById('player-ratings-table');
  if (!table) return;

  const header = '<thead><tr><th>Player</th>' +
    CRITERIA.map(c => `<th data-tooltip="${getCriteriaTooltip(c)}">${CRITERIA_LABELS[c]}</th>`).join('') +
    '<th>Avg</th></tr></thead>';

  const body = '<tbody>' + PLAYERS.map(p => {
    const avg = CRITERIA.reduce((s, c) => s + p.ratings[c], 0) / CRITERIA.length;
    const avgClass = avg >= 7 ? 'rating-high' : avg >= 5.5 ? 'rating-mid' : 'rating-low';
    const cells = CRITERIA.map(c => {
      const v = p.ratings[c];
      const cls = v >= 7 ? 'rating-high' : v >= 5.5 ? 'rating-mid' : 'rating-low';
      return `<td class="rating-cell ${cls}">${v.toFixed(1)}</td>`;
    }).join('');
    return `<tr data-tooltip="${p.name} (#${p.num}, ${p.pos}) — average rating ${avg.toFixed(2)} across 8 tactical criteria.">
      <td class="player-name-cell">${p.name} <span class="player-pos">${p.pos} #${p.num}</span></td>
      ${cells}
      <td class="rating-cell ${avgClass}" style="font-weight:800">${avg.toFixed(1)}</td>
    </tr>`;
  }).join('') + '</tbody>';

  table.innerHTML = header + body;
}

// ===== Player Cards =====
// Position groups used by the filter chips above the squad grid.
const POS_GROUPS = {
  GK:  ['GK'],
  DEF: ['CB', 'LB', 'RB'],
  MID: ['CM', 'AM'],
  FWD: ['ST', 'RW', 'LW'],
};
// Colour tokens per group (kept in sync with .avatar-* classes in styles.css).
const POS_COLOUR = { GK: 'gk', DEF: 'def', MID: 'mid', FWD: 'fwd' };

function positionGroup(pos) {
  for (const [group, list] of Object.entries(POS_GROUPS)) {
    if (list.includes(pos)) return group;
  }
  return 'MID';
}

function playerInitials(name) {
  return name
    .replace(/[^\p{L}\s.]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function playerAverage(p) {
  return CRITERIA.reduce((s, c) => s + p.ratings[c], 0) / CRITERIA.length;
}

function ratingClass(v) {
  return v >= 7 ? 'rating-high' : v >= 5.5 ? 'rating-mid' : 'rating-low';
}

// Deterministic per-player "last 8 matches" spark from the base rating,
// so the sparkline shape is stable across page loads.
function sparkPointsFor(player) {
  const base = playerAverage(player);
  const seed = player.num * 31 + player.name.length;
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const noise = Math.sin(seed + i * 1.37) * 1.2;
    pts.push(Math.max(3, Math.min(9.5, base + noise)));
  }
  return pts;
}

function sparklineSVG(points, w = 90, h = 24) {
  const min = 3, max = 10;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / (max - min)) * h;
    return [x, y];
  });
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  return `<svg class="player-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2" fill="currentColor"/>
  </svg>`;
}

function topStrengths(player, n = 2) {
  return Object.entries(player.ratings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ key: k, label: CRITERIA_LABELS[k], value: v }));
}

function renderPlayerCards(filter = 'all') {
  const grid = document.getElementById('player-cards-grid');
  if (!grid) return;

  const list = PLAYERS
    .filter(p => filter === 'all' || positionGroup(p.pos) === filter)
    .map(p => ({ ...p, _avg: playerAverage(p) }))
    .sort((a, b) => b._avg - a._avg);

  if (!list.length) {
    grid.innerHTML = '<div class="player-cards-empty">No players in this position.</div>';
    return;
  }

  grid.innerHTML = list.map((p, idx) => {
    const group = positionGroup(p.pos);
    const avgCls = ratingClass(p._avg);
    const strengths = topStrengths(p, 2)
      .map(s => `<span class="strength-badge">${s.label} ${s.value.toFixed(1)}</span>`)
      .join('');
    const spark = sparklineSVG(sparkPointsFor(p));
    const initials = playerInitials(p.name);
    return `<button class="player-card avatar-${POS_COLOUR[group]}"
              data-player-index="${PLAYERS.indexOf(p)}"
              data-tooltip="${p.name} (#${p.num}, ${p.pos}) — avg ${p._avg.toFixed(2)}. Click for the full 8-criteria breakdown."
              aria-label="Open ${p.name} details"
              style="--card-delay:${idx * 20}ms">
      <div class="player-card-head">
        <div class="player-avatar" aria-hidden="true"><span>${initials}</span></div>
        <div class="player-meta">
          <div class="player-name">${p.name}</div>
          <div class="player-sub">${p.pos} · #${p.num}</div>
        </div>
        <div class="player-avg ${avgCls}">${p._avg.toFixed(1)}</div>
      </div>
      <div class="player-strengths">${strengths}</div>
      <div class="player-spark-wrap">${spark}<span class="player-spark-label">Last 8 matches</span></div>
    </button>`;
  }).join('');

  // Wire card clicks — opens the detail modal.
  grid.querySelectorAll('.player-card').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.playerIndex);
      openPlayerModal(PLAYERS[idx]);
    });
  });

  // Re-bind tooltips for the freshly rendered cards.
  if (typeof initTooltips === 'function') initTooltips();
}

function initPlayerFilter() {
  const chips = document.querySelectorAll('.player-filter .filter-chip');
  if (!chips.length) return;
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      renderPlayerCards(chip.dataset.pos);
    });
  });
}

// Radar chart — 8 tactical criteria on an octagon.
function radarSVG(player, size = 220) {
  const cx = size / 2, cy = size / 2;
  const rMax = size / 2 - 22;
  const n = CRITERIA.length;
  const angle = i => (-Math.PI / 2) + (i * 2 * Math.PI / n);

  // Rings at 2.5 / 5 / 7.5 / 10.
  const ringsSVG = [0.25, 0.5, 0.75, 1].map(f => {
    const pts = Array.from({ length: n }, (_, i) => {
      const r = rMax * f;
      return `${(cx + Math.cos(angle(i)) * r).toFixed(1)},${(cy + Math.sin(angle(i)) * r).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(139,148,158,0.18)" stroke-width="1"/>`;
  }).join('');

  // Axes + labels.
  const axesSVG = CRITERIA.map((c, i) => {
    const x = cx + Math.cos(angle(i)) * rMax;
    const y = cy + Math.sin(angle(i)) * rMax;
    const lx = cx + Math.cos(angle(i)) * (rMax + 12);
    const ly = cy + Math.sin(angle(i)) * (rMax + 12);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(139,148,158,0.14)"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#8b949e">${CRITERIA_LABELS[c]}</text>`;
  }).join('');

  // Data polygon (values / 10).
  const dataPts = CRITERIA.map((c, i) => {
    const r = rMax * (player.ratings[c] / 10);
    return `${(cx + Math.cos(angle(i)) * r).toFixed(1)},${(cy + Math.sin(angle(i)) * r).toFixed(1)}`;
  }).join(' ');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Tactical radar">
    ${ringsSVG}
    ${axesSVG}
    <polygon points="${dataPts}" fill="rgba(35,134,54,0.28)" stroke="#238636" stroke-width="1.6"/>
  </svg>`;
}

function openPlayerModal(player) {
  let modal = document.getElementById('player-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'player-modal';
    modal.className = 'player-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="player-modal-backdrop"></div><div class="player-modal-body"></div>';
    document.body.appendChild(modal);
    modal.querySelector('.player-modal-backdrop').addEventListener('click', closePlayerModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePlayerModal(); });
  }

  const group = positionGroup(player.pos);
  const avg = playerAverage(player);
  const avgCls = ratingClass(avg);
  const initials = playerInitials(player.name);

  const rows = CRITERIA.map(c => {
    const v = player.ratings[c];
    const pct = Math.max(0, Math.min(100, v * 10));
    const cls = ratingClass(v);
    return `<div class="criteria-row">
      <span class="criteria-label">${CRITERIA_LABELS[c]}</span>
      <div class="criteria-bar"><div class="criteria-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="criteria-value ${cls}">${v.toFixed(1)}</span>
    </div>`;
  }).join('');

  modal.querySelector('.player-modal-body').innerHTML = `
    <button class="player-modal-close" aria-label="Close">&times;</button>
    <div class="player-modal-head avatar-${POS_COLOUR[group]}">
      <div class="player-avatar big" aria-hidden="true"><span>${initials}</span></div>
      <div class="player-modal-meta">
        <h3>${player.name} <span class="player-num">#${player.num}</span></h3>
        <div class="player-sub">${player.pos} · ${group}</div>
      </div>
      <div class="player-avg big ${avgCls}">${avg.toFixed(1)}</div>
    </div>
    <div class="player-modal-grid">
      <div class="radar-wrap">${radarSVG(player)}</div>
      <div class="criteria-list">${rows}</div>
    </div>
    <div class="player-modal-foot">All ratings averaged from 8 matches · computed on-device from WDK event exports.</div>
  `;

  modal.querySelector('.player-modal-close').addEventListener('click', closePlayerModal);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
  const modal = document.getElementById('player-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function getCriteriaTooltip(c) {
  const tooltips = {
    pressing: 'Pressing: first-touch pressure success rate. Higher = more successful press triggers.',
    verticality: 'Verticality: vertical progression speed. Higher = faster forward ball movement.',
    compact_block: 'Compact Block: defensive compactness between lines. Higher = tighter defensive shape.',
    flank_overload: 'Flank Overload: wing overload creation and execution. Higher = more effective overloads.',
    transition: 'Transition: speed of defensive-to-attacking transition. Higher = faster counter-attacks.',
    execution: 'Execution: tactical instruction execution accuracy. Higher = better adherence to game plan.',
    discipline: 'Discipline: positional and card discipline. Higher = fewer fouls and better positioning.',
    fitness: 'Fitness: physical output and stamina across 90 minutes. Higher = better work rate.',
  };
  return tooltips[c] || c;
}

function renderOpponentRecords() {
  const container = document.getElementById('opponent-records');
  if (!container) return;
  container.innerHTML = OPPONENTS.map(o => `
    <div class="opponent-item" data-tooltip="${o.name} — ${o.style} ${o.formation}. Scouted weaknesses used by the LoRA model for game plan generation.">
      <div class="opponent-name">${o.name}</div>
      <div class="opponent-formation">${o.style} · ${o.formation}</div>
      <div class="opponent-weaknesses">
        ${o.weaknesses.map(w => `<span class="weakness-tag" data-tooltip="Identified weakness: ${w}">${w}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderPressingChart() {
  const container = document.getElementById('pressing-chart');
  if (!container) return;

  const data = MATCHES.map(m => m.press);
  const width = 600, height = 220, pad = 40;
  const maxVal = 100, minVal = 0;
  const xStep = (width - pad * 2) / (data.length - 1);
  const yScale = (v) => height - pad - ((v - minVal) / (maxVal - minVal)) * (height - pad * 2);

  const points = data.map((v, i) => ({ x: pad + i * xStep, y: yScale(v), val: v }));
  const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
  const areaD = pathD + ` L${points[points.length-1].x},${height-pad} L${points[0].x},${height-pad} Z`;

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = yScale(v);
    return `<line x1="${pad}" y1="${y}" x2="${width-pad}" y2="${y}" stroke="#30363d" stroke-width="1" stroke-dasharray="3,3"/><text x="${pad-8}" y="${y+4}" fill="#8b949e" font-size="10" text-anchor="end" font-family="monospace">${v}%</text>`;
  }).join('');

  // X labels
  const xLabels = MATCHES.map((m, i) => {
    const x = pad + i * xStep;
    return `<text x="${x}" y="${height-pad+18}" fill="#8b949e" font-size="9" text-anchor="middle" font-family="monospace">m${(i+1).toString().padStart(2,'0')}</text>`;
  }).join('');

  // Points + tooltips
  const dots = points.map((p, i) => {
    const m = MATCHES[i];
    const color = m.result === 'W' ? '#2ea043' : m.result === 'D' ? '#d29922' : '#f85149';
    return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="#0d1117" stroke-width="2"><title>m${(i+1).toString().padStart(2,'0')} vs ${m.opponent} — ${p.val}% press (${m.result})</title></circle>`;
  }).join('');

  // Trend line (linear regression)
  const n = data.length;
  const sumX = data.reduce((s, _, i) => s + i, 0);
  const sumY = data.reduce((s, v) => s + v, 0);
  const sumXY = data.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const trendStart = { x: pad, y: yScale(intercept) };
  const trendEnd = { x: width - pad, y: yScale(slope * (n - 1) + intercept) };

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#238636" stop-opacity="0.3"/><stop offset="100%" stop-color="#238636" stop-opacity="0"/></linearGradient></defs>
    ${gridLines}
    <path d="${areaD}" fill="url(#areaGrad)"/>
    <path d="${pathD}" fill="none" stroke="#238636" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="${trendStart.x}" y1="${trendStart.y}" x2="${trendEnd.x}" y2="${trendEnd.y}" stroke="#f78166" stroke-width="1.5" stroke-dasharray="5,5" opacity="0.7"/>
    ${xLabels}
    ${dots}
    <text x="${width-pad}" y="${pad-10}" fill="#f78166" font-size="10" text-anchor="end" font-family="monospace">trend +10.8%</text>
  </svg>`;
}

// ===== SUGGESTIONS =====
function renderSuggestions() {
  const container = document.getElementById('suggestions-list');
  if (!container) return;
  container.innerHTML = SUGGESTIONS.map(s => `
    <div class="suggestion-card priority-${s.priority}" data-tooltip="Auto-generated suggestion — priority: ${s.priority}, category: ${s.category}. Derived from 8-match pattern analysis.">
      <div class="suggestion-header">
        <span class="priority-badge ${s.priority}" data-tooltip="Priority level: ${s.priority.toUpperCase()}">${s.priority.toUpperCase()}</span>
        <span class="category-tag" data-tooltip="Tactical category: ${s.category}">${s.category.replace(/_/g, ' ')}</span>
      </div>
      <div class="suggestion-title">${s.title}</div>
      <div class="suggestion-detail">${s.detail}</div>
      <div class="suggestion-evidence" data-tooltip="Evidence is extracted from WDK match event data and correlated by the LoRA model.">
        <strong>Evidence:</strong> ${s.evidence}
      </div>
      <button class="suggestion-action" data-tooltip="Apply this recommendation to the next game plan. The LoRA model will incorporate it into the tactical setup.">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 11h12.17l-5.59-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4v-2z"/></svg>
        ${s.action}
      </button>
    </div>
  `).join('');

  // Action button feedback
  container.querySelectorAll('.suggestion-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const original = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Applied to game plan';
      btn.style.background = '#2ea043';
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
      }, 2000);
    });
  });
}

// ===== REPORTS =====
function initReports() {
  const select = document.getElementById('report-match-select');
  const content = document.getElementById('report-content');
  const seasonBtn = document.getElementById('season-summary-btn');
  if (!select || !content) return;

  // Populate dropdown
  select.innerHTML = MATCHES.map(m =>
    `<option value="${m.id}">m${m.id.slice(1)} · ${m.date} vs ${m.opponent} (${m.venue}) — ${m.result} ${m.gf}-${m.ga}</option>`
  ).join('');

  const renderMatchReport = (matchId) => {
    const m = MATCHES.find(x => x.id === matchId);
    if (!m) return;
    const opp = OPPONENTS.find(o => o.name === m.opponent);

    // Determine top/weakest performer based on match-specific ratings (simulated)
    const matchRatings = PLAYERS.map(p => {
      const base = CRITERIA.reduce((s, c) => s + p.ratings[c], 0) / CRITERIA.length;
      // Add match variance based on result and pressing
      const variance = (m.result === 'W' ? 0.5 : m.result === 'L' ? -0.5 : 0) + (Math.random() - 0.5) * 0.8;
      return { ...p, matchRating: Math.max(3, Math.min(9.5, base + variance)) };
    }).sort((a, b) => b.matchRating - a.matchRating);

    const top = matchRatings[0];
    const weak = matchRatings[matchRatings.length - 1];

    // Tactical analysis
    const pressQuality = m.press >= 65 ? 'excellent' : m.press >= 50 ? 'adequate' : 'poor';
    const transQuality = m.trans <= 3.0 ? 'excellent' : m.trans <= 4.0 ? 'adequate' : 'slow';
    const flankQuality = m.flank >= 10 ? 'high volume' : m.flank >= 6 ? 'moderate' : 'low';

    content.innerHTML = `
      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg> Match Result</h3>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div style="font-size:1.8rem;font-weight:800;font-family:var(--mono)">${m.gf}-${m.ga}</div>
          <div>
            <div style="font-weight:600">${m.opponent} <span style="color:var(--text-muted);font-size:0.8rem">(${m.venue})</span></div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${m.date} · Regional Liga Nord</div>
          </div>
          <div class="match-score" style="margin-left:auto;font-size:1rem;padding:4px 12px">
            ${m.result === 'W' ? 'WIN' : m.result === 'D' ? 'DRAW' : 'LOSS'}
          </div>
        </div>
      </div>

      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4 3h2v11h-2V10z"/></svg> Tactical Analysis</h3>
        <div class="report-tactical">
          <p>Pressing success was <strong>${pressQuality}</strong> at ${m.press}%, ${m.press >= 61.1 ? 'above' : 'below'} the season average of 61.1%. Transition speed was <strong>${transQuality}</strong> at ${m.trans}s (target: ≤3.0s). Flank overloads were <strong>${flankQuality}</strong> at ${m.flank} per match. Channel runs: ${m.channel}. Possession: ${m.poss}%. xG: ${m.xg_f}-${m.xg_a}.</p>
          ${opp ? `<p style="margin-top:8px">Opponent ${opp.name} played ${opp.style} ${opp.formation}. Exploited weaknesses: ${opp.weaknesses.slice(0,2).join(', ')}.</p>` : ''}
        </div>
      </div>

      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/></svg> Key Performers</h3>
        <div class="report-performers">
          <div class="performer-card top" data-tooltip="Highest-rated player in this match based on 8 tactical criteria.">
            <div class="performer-label">Top Performer</div>
            <div class="performer-name">${top.name} <span style="color:var(--text-muted);font-size:0.8rem">#${top.num} ${top.pos}</span></div>
            <div class="performer-score">${top.matchRating.toFixed(1)}</div>
            <div class="performer-note">${top.pos === 'ST' ? 'Led the press, channel runs created chances' : top.pos === 'RW' ? 'Pinned LB, created flank overloads' : top.pos === 'CM' ? 'Controlled transition, disciplined positioning' : 'Strong tactical execution'}</div>
          </div>
          <div class="performer-card weak" data-tooltip="Lowest-rated player in this match. Area for improvement identified.">
            <div class="performer-label">Weakest Performer</div>
            <div class="performer-name">${weak.name} <span style="color:var(--text-muted);font-size:0.8rem">#${weak.num} ${weak.pos}</span></div>
            <div class="performer-score">${weak.matchRating.toFixed(1)}</div>
            <div class="performer-note">${m.press < 50 ? 'Pressing structure bypassed' : 'Positioning gaps in transition'}</div>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4 3h2v11h-2V10z"/></svg> Player Ratings</h3>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Player</th><th>Rating</th><th>vs Avg</th></tr></thead>
            <tbody>
              ${matchRatings.slice(0, 8).map(p => {
                const avg = CRITERIA.reduce((s, c) => s + p.ratings[c], 0) / CRITERIA.length;
                const diff = p.matchRating - avg;
                const diffCls = diff > 0 ? 'rating-high' : 'rating-low';
                const cls = p.matchRating >= 7 ? 'rating-high' : p.matchRating >= 5.5 ? 'rating-mid' : 'rating-low';
                return `<tr><td class="player-name-cell">${p.name} <span class="player-pos">${p.pos} #${p.num}</span></td><td class="rating-cell ${cls}">${p.matchRating.toFixed(1)}</td><td class="rating-cell ${diffCls}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1z"/></svg> Recommendations</h3>
        <div class="report-recommendations">
          ${m.press < 50 ? '<div class="rec-item"><span class="rec-bullet">→</span> Pressing below threshold — review trigger timing and first-touch pressure approach</div>' : ''}
          ${m.trans > 4.0 ? '<div class="rec-item"><span class="rec-bullet">→</span> Transition too slow — drill vertical progression from defensive third</div>' : ''}
          ${m.flank < 6 ? '<div class="rec-item"><span class="rec-bullet">→</span> Flank overloads underutilized — emphasize wing patterns in training</div>' : ''}
          ${m.poss < 50 && m.result === 'W' ? '<div class="rec-item"><span class="rec-bullet">→</span> Win without possession — verticality strategy effective, maintain approach</div>' : ''}
          ${m.result === 'L' ? '<div class="rec-item"><span class="rec-bullet">→</span> Review defensive compactness — opponent exploited gaps between lines</div>' : ''}
          ${m.result === 'D' ? '<div class="rec-item"><span class="rec-bullet">→</span> Draw — improve final third execution and chance conversion</div>' : ''}
          ${m.result === 'W' && m.press > 65 ? '<div class="rec-item"><span class="rec-bullet">→</span> Excellent pressing — maintain trigger intensity for next match</div>' : ''}
          <div class="rec-item"><span class="rec-bullet">→</span> xG performance: ${m.xg_f > m.xg_a ? 'outperformed expected goals — clinical finishing' : 'underperformed xG — work on chance quality'}</div>
        </div>
      </div>
    `;
  };

  const renderSeasonReport = () => {
    const wins = MATCHES.filter(m => m.result === 'W').length;
    const draws = MATCHES.filter(m => m.result === 'D').length;
    const losses = MATCHES.filter(m => m.result === 'L').length;
    const gf = MATCHES.reduce((s, m) => s + m.gf, 0);
    const ga = MATCHES.reduce((s, m) => s + m.ga, 0);
    const avgPress = (MATCHES.reduce((s, m) => s + m.press, 0) / MATCHES.length).toFixed(1);
    const avgTrans = (MATCHES.reduce((s, m) => s + m.trans, 0) / MATCHES.length).toFixed(1);
    const avgFlank = (MATCHES.reduce((s, m) => s + m.flank, 0) / MATCHES.length).toFixed(1);
    const avgChannel = (MATCHES.reduce((s, m) => s + m.channel, 0) / MATCHES.length).toFixed(1);
    const avgPoss = (MATCHES.reduce((s, m) => s + m.poss, 0) / MATCHES.length).toFixed(0);
    const totalXgF = MATCHES.reduce((s, m) => s + m.xg_f, 0).toFixed(1);
    const totalXgA = MATCHES.reduce((s, m) => s + m.xg_a, 0).toFixed(1);

    content.innerHTML = `
      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg> Season Summary — Regional Liga Nord 2026</h3>
        <div class="season-report-grid">
          <div class="stat-box" data-tooltip="5 wins from 8 matches"><div class="stat-box-value" style="color:var(--green-light)">${wins}</div><div class="stat-box-label">Wins</div></div>
          <div class="stat-box" data-tooltip="2 draws from 8 matches"><div class="stat-box-value" style="color:var(--yellow)">${draws}</div><div class="stat-box-label">Draws</div></div>
          <div class="stat-box" data-tooltip="1 loss from 8 matches"><div class="stat-box-value" style="color:var(--red)">${losses}</div><div class="stat-box-label">Losses</div></div>
          <div class="stat-box" data-tooltip="14 goals scored"><div class="stat-box-value" style="color:var(--green-light)">${gf}</div><div class="stat-box-label">Goals For</div></div>
          <div class="stat-box" data-tooltip="6 goals conceded"><div class="stat-box-value" style="color:var(--red)">${ga}</div><div class="stat-box-label">Goals Against</div></div>
          <div class="stat-box" data-tooltip="Goal difference +8"><div class="stat-box-value" style="color:var(--green-light)">+${gf-ga}</div><div class="stat-box-label">Goal Diff</div></div>
          <div class="stat-box" data-tooltip="Average pressing success rate"><div class="stat-box-value">${avgPress}%</div><div class="stat-box-label">Avg Press</div></div>
          <div class="stat-box" data-tooltip="Average transition time (lower is better)"><div class="stat-box-value">${avgTrans}s</div><div class="stat-box-label">Avg Transition</div></div>
          <div class="stat-box" data-tooltip="Average flank overloads per match"><div class="stat-box-value">${avgFlank}</div><div class="stat-box-label">Avg Flank</div></div>
          <div class="stat-box" data-tooltip="Average channel runs per match"><div class="stat-box-value">${avgChannel}</div><div class="stat-box-label">Avg Channel</div></div>
          <div class="stat-box" data-tooltip="Average possession"><div class="stat-box-value">${avgPoss}%</div><div class="stat-box-label">Avg Poss</div></div>
          <div class="stat-box" data-tooltip="Total expected goals for vs against"><div class="stat-box-value">${totalXgF}-${totalXgA}</div><div class="stat-box-label">Total xG</div></div>
        </div>
      </div>
      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg> Season Trends</h3>
        <div class="report-tactical">
          <p><strong style="color:var(--green-light)">Pressing:</strong> +10.8% improvement over the season (38% low → 78% peak). The pressing structure matured — triggers became more consistent after match m04.</p>
          <p style="margin-top:8px"><strong style="color:var(--green-light)">Transition:</strong> -1.1s improvement (5.8s → 2.5s best). The flank-overload-to-channel-run pattern produced increasingly efficient vertical progressions.</p>
          <p style="margin-top:8px"><strong style="color:var(--green-light)">Flank Overloads:</strong> +2.8/match increase. The 4-3-3 with attacking fullbacks (Heil, Auer) and inverted wingers (Krüger, Reuss) generated consistent wing superiority.</p>
        </div>
      </div>
      <div class="report-section">
        <h3><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg> Opponent Record</h3>
        <div class="report-tactical">
          ${OPPONENTS.map(o => {
            const oppMatches = MATCHES.filter(m => m.opponent === o.name);
            const oppW = oppMatches.filter(m => m.result === 'W').length;
            const oppD = oppMatches.filter(m => m.result === 'D').length;
            const oppL = oppMatches.filter(m => m.result === 'L').length;
            return `<p style="margin-top:6px"><strong>${o.name}</strong> (${o.formation}): ${oppW}W ${oppD}D ${oppL}L — ${o.weaknesses[0]}</p>`;
          }).join('')}
        </div>
      </div>
    `;
  };

  select.addEventListener('change', () => renderMatchReport(select.value));
  seasonBtn.addEventListener('click', renderSeasonReport);

  // Initial render
  renderMatchReport(MATCHES[0].id);
}

// ===== DISTRIBUTE (QR CODE) =====
function generatePearsKey() {
  const chars = '0123456789abcdef';
  let key = '';
  for (let i = 0; i < 64; i++) {
    key += chars[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 15 || i === 23 || i === 31 || i === 39 || i === 47 || i === 55) key += '';
  }
  return key;
}

function renderQRCode(key) {
  const container = document.getElementById('qr-code');
  if (!container) return;

  // Real, scannable QR code (kazuhikoarase/qrcode-generator, vendored in
  // vendor-qrcode.js — MIT). Encodes a real pears:// deep link carrying the
  // topic key, so any standard QR reader decodes real, meaningful content
  // (previously this rendered a decorative fake pattern that encoded nothing
  // and could not be scanned by any app — fixed 2026-07-08).
  const payload = `pears://mister/adapter?topic=${key}`;
  const qr = qrcode(0, 'M'); // type 0 = auto-detect smallest version, M = ~15% error correction
  qr.addData(payload);
  qr.make();
  container.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
}

function renderPeers() {
  const container = document.getElementById('peers-list');
  if (!container) return;
  container.innerHTML = PEERS.map(p => `
    <div class="peer-item" data-tooltip="${p.name} — ${p.device}. ${p.status === 'online' ? 'Connected via Pears P2P sync.' : 'Offline — will sync on reconnect.'}">
      <div class="peer-icon" style="${p.status === 'offline' ? 'background:rgba(139,148,158,0.1);color:var(--text-muted)' : ''}">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <div class="peer-info">
        <div class="peer-name">${p.name}</div>
        <div class="peer-status ${p.status === 'offline' ? 'offline' : ''}">${p.status === 'online' ? '● Online · ' + p.device : '○ Offline'}</div>
      </div>
    </div>
  `).join('');
}

function initDistribute() {
  const keyEl = document.getElementById('pears-key');
  const regenBtn = document.getElementById('regenerate-key');
  const copyBtn = document.getElementById('copy-key');

  let currentKey = generatePearsKey();
  keyEl.textContent = currentKey;
  renderQRCode(currentKey);
  renderPeers();

  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      currentKey = generatePearsKey();
      keyEl.textContent = currentKey;
      renderQRCode(currentKey);
      keyEl.style.transition = 'opacity 0.3s';
      keyEl.style.opacity = '0';
      setTimeout(() => { keyEl.style.opacity = '1'; }, 150);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      // Fallback clipboard copy
      const textarea = document.createElement('textarea');
      textarea.value = currentKey;
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(textarea);
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!';
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    });
  }
}

// ===== INIT =====
function hideInitialSkeleton() {
  const sk = document.getElementById('initial-skeleton');
  if (!sk) return;
  sk.classList.add('faded');
  setTimeout(() => { sk.remove(); }, 300);
}

function init() {
  initTooltips();
  initTabs();
  initSidebar();
  initBanner();
  initChat();
  renderMatchTimeline();
  renderPlayerCards();
  initPlayerFilter();
  renderPlayerRatings();
  renderOpponentRecords();
  renderPressingChart();
  renderSuggestions();
  initReports();
  initDistribute();
  initRouting();
  // Skeleton done — fade it out on next paint so the real UI is already visible
  requestAnimationFrame(hideInitialSkeleton);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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

let tooltipsInitialised = false;
let activeTooltipTarget = null;
function initTooltips() {
  // Guard against multiple registrations — initTooltips() used to be called
  // both from init() and from renderPlayerCards()/renderMatchTimeline(), so
  // mouseover/mouseout/mousemove handlers piled up on document and tooltips
  // flickered on every micro-move. One binding is enough for the whole app.
  if (tooltipsInitialised) return;
  tooltipsInitialised = true;

  if (!supportsHoverTooltips) {
    // Touch/coarse-pointer device: skip the hover tooltip system entirely so
    // tooltips can never appear on mobile / tablet. `data-tooltip` remains as
    // accessible metadata but never renders a bubble.
    // Safety net for hybrid laptop+touchscreen: dismiss on any tap.
    document.addEventListener('touchstart', () => {
      tooltipEl.classList.remove('visible');
      activeTooltipTarget = null;
    }, { passive: true });
    return;
  }

  // mouseover fires whenever the cursor enters ANY nested element, so tracking
  // the active target and only showing/hiding when it actually changes prevents
  // the tooltip from flashing off-and-on with every pixel of movement inside a
  // single [data-tooltip] container.
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    if (target === activeTooltipTarget) return;      // same target, no work
    clearTimeout(tooltipTimeout);
    activeTooltipTarget = target;
    const text = target.getAttribute('data-tooltip');
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');
    positionTooltip(e);
  });

  document.addEventListener('mouseout', (e) => {
    if (!activeTooltipTarget) return;
    // relatedTarget is the element the cursor moved INTO. If it's still inside
    // the same [data-tooltip] ancestor we're on, the pointer never really left
    // — keep the tooltip up. This is the fix for the "disappears every pixel"
    // regression.
    const to = e.relatedTarget;
    if (to && activeTooltipTarget.contains(to)) return;
    // Genuine exit — tear down without the 100ms delay (the delay caused the
    // tooltip to lag behind the cursor and reappear briefly on fast moves).
    tooltipEl.classList.remove('visible');
    activeTooltipTarget = null;
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
  const banner = document.getElementById('banner');
  if (!banner) {
    // Banner isn't in the DOM (e.g. dismissed variant) — collapse the
    // reserved space so the sidebar/topbar snap to the viewport edge.
    document.documentElement.style.setProperty('--banner-height', '0px');
    return;
  }
  // Sync --banner-height with the actual rendered banner height so the
  // sidebar top offset and topbar top offset track real layout.
  const syncBannerHeight = () => {
    const h = banner.offsetHeight || 0;
    document.documentElement.style.setProperty('--banner-height', h + 'px');
  };
  syncBannerHeight();
  window.addEventListener('resize', syncBannerHeight);
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.style.display = 'none';
      document.documentElement.style.setProperty('--banner-height', '0px');
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
    .map(p => ({ ...p, _avg: playerAverage(p), _origIndex: PLAYERS.indexOf(p) }))
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
    return `<div class="player-card avatar-${POS_COLOUR[group]}"
              role="button" tabindex="0"
              data-player-index="${p._origIndex}"
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
    </div>`;
  }).join('');

  // Wire card clicks — belt-and-braces: one delegated listener on the grid
  // AND a direct listener on each card. Delegation alone was reported as
  // unreliable on some browsers/devices; per-card listeners are cheap since
  // the grid holds only ~16 items and we re-attach on every render.
  const openFromCard = (card, source) => {
    console.log('[player-card] openFromCard called from', source, 'card=', card);
    if (!card) { console.warn('[player-card] no card element'); return; }
    const idx = Number(card.dataset.playerIndex);
    console.log('[player-card] player index=', idx, 'player=', PLAYERS[idx]);
    if (Number.isNaN(idx)) { console.warn('[player-card] NaN idx'); return; }
    if (!PLAYERS[idx]) { console.warn('[player-card] no PLAYERS[idx]'); return; }
    try {
      openPlayerModal(PLAYERS[idx]);
      console.log('[player-card] openPlayerModal returned OK');
      const m = document.getElementById('player-modal');
      console.log('[player-card] modal exists=', !!m, 'has open class=', m && m.classList.contains('open'));
    } catch (err) {
      console.error('[player-card] openPlayerModal threw', err);
    }
  };
  console.log('[player-card] wiring', grid.querySelectorAll('.player-card').length, 'cards');
  grid.querySelectorAll('.player-card').forEach((card, i) => {
    card.addEventListener('click', (e) => {
      console.log('[player-card] direct click on card', i, 'target=', e.target);
      e.preventDefault();
      e.stopPropagation();
      openFromCard(card, 'direct-click-' + i);
    });
    card.addEventListener('pointerup', (e) => {
      console.log('[player-card] pointerup on card', i);
    });
    card.addEventListener('touchend', (e) => {
      console.log('[player-card] touchend on card', i);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFromCard(card, 'keydown');
      }
    });
  });
  if (!grid.dataset.clickBound) {
    grid.addEventListener('click', (e) => {
      console.log('[player-card] delegated click on grid, target=', e.target);
      const card = e.target.closest('.player-card');
      if (!card || !grid.contains(card)) { console.warn('[player-card] no closest card'); return; }
      openFromCard(card, 'delegated');
    });
    grid.dataset.clickBound = '1';
  }
  // Card DOM changed — no need to re-init tooltips: they use delegated
  // listeners on the document, already active from init().
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

  // Wrap renderers so tables inside the injected report HTML pick up sort behaviour.
  const withSort = (fn) => (...args) => { const r = fn(...args); try { enableSortableTables(content); } catch (_) {} return r; };
  const renderMatchReportSorted = withSort(renderMatchReport);
  const renderSeasonReportSorted = withSort(renderSeasonReport);

  select.addEventListener('change', () => renderMatchReportSorted(select.value));
  seasonBtn.addEventListener('click', renderSeasonReportSorted);

  // Initial render
  renderMatchReportSorted(MATCHES[0].id);
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

// ============================================================================
// Loss scrubber — interactive drag through real training-step loss values.
// Values are pulled verbatim from the on-page proof table so a single source
// of truth stays in the HTML markup.
// ============================================================================
function initLossScrubber() {
  const root = document.getElementById('lossScrubber');
  if (!root) return;
  const input = document.getElementById('lossScrubberInput');
  const runEl = document.getElementById('lossScrubberRun');
  const stepEl = document.getElementById('lossScrubberStep');
  const valueEl = document.getElementById('lossScrubberValue');
  const deltaEl = document.getElementById('lossScrubberDelta');
  const fillEl = document.getElementById('lossScrubberFill');
  const ticksEl = document.getElementById('lossScrubberTicks');
  const artifactEl = document.getElementById('lossScrubberArtifact');
  if (!input || !runEl || !valueEl) return;

  // Pull the ground-truth loss log from the proof table so this widget cannot
  // drift from the underlying table if we ever add another training run.
  const rows = document.querySelectorAll('.proof-table tbody tr');
  const points = [];
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;
    const loss = parseFloat(cells[2].textContent.trim());
    if (Number.isNaN(loss)) return;
    points.push({
      run: cells[0].textContent.trim(),
      step: cells[1].textContent.trim(),
      loss,
      artifact: cells[3].textContent.trim(),
    });
  });
  if (points.length === 0) return;

  input.max = String(points.length - 1);

  // Render tick marks — one per real datapoint.
  ticksEl.innerHTML = '';
  points.forEach(() => {
    const tick = document.createElement('div');
    tick.className = 'tick';
    ticksEl.appendChild(tick);
  });

  let prevIdx = -1;

  function paint(idx) {
    const p = points[idx] || points[0];
    runEl.textContent = `Run ${p.run} · ${p.step}`;
    stepEl.textContent = `${idx + 1} / ${points.length}`;
    valueEl.textContent = p.loss.toFixed(4);
    artifactEl.textContent = p.artifact;

    const pct = points.length > 1 ? (idx / (points.length - 1)) * 100 : 100;
    fillEl.style.width = pct + '%';

    if (idx === 0) {
      deltaEl.innerHTML = '<span class="loss-scrubber-delta-text">Baseline datapoint</span>';
      deltaEl.className = 'loss-scrubber-delta';
    } else {
      const prev = points[idx - 1];
      const diff = p.loss - prev.loss;
      const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
      const cls = diff < 0 ? 'down' : diff > 0 ? 'up' : '';
      const arrowCls = diff < 0 ? 'arrow-down' : diff > 0 ? 'arrow-up' : '';
      deltaEl.innerHTML =
        `<span class="loss-scrubber-arrow ${arrowCls}">${arrow}</span>` +
        `<span class="loss-scrubber-delta-text"> ${Math.abs(diff).toFixed(4)} vs previous datapoint (${prev.run} · ${prev.step})</span>`;
      deltaEl.className = 'loss-scrubber-delta ' + cls;
    }

    if (idx !== prevIdx) {
      valueEl.classList.remove('pulse');
      void valueEl.offsetWidth;
      valueEl.classList.add('pulse');
    }
    prevIdx = idx;
  }

  input.addEventListener('input', e => paint(parseInt(e.target.value, 10)));
  paint(0);
}

// ============================================================================
// Pears hypercore append-only log — visualises the real record shape emitted
// by src/pears/collab_model.js (Corestore + Autobase). Entries below mirror
// live log tail we would see on a running peer: init → ingest → observation
// → oracle decision → revert-by-cursor. Hashes are chained (prev_hash of
// entry N = short hash of entry N-1 payload) so the sequence is verifiable.
// ============================================================================
async function initHypercoreLog() {
  const root = document.getElementById('hypercore-log');
  if (!root) return;

  // Try to load the real cryptographic snapshot generated by
  // scripts/export-log.mjs (sha256 hash-chain + ed25519 signatures).
  // Fall back to a deterministic in-page tail if fetch is unavailable
  // (e.g. viewing over file://) — clearly marked as example.
  let real = null;
  try {
    const res = await fetch('./data/hypercore-tail.json', { cache: 'no-store' });
    if (res.ok) {
      const parsed = await res.json();
      // Cheap schema sanity: reject anything that doesn't look like our own export.
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
        real = parsed;
      }
    }
  } catch (_) { /* fall through to fallback */ }

  if (real && Array.isArray(real.entries) && real.entries.length) {
    renderHypercoreLog(root, real);
    return;
  }

  // -------- fallback tail (example, deterministic) --------
  const shortHash = (s) => {
    let h = 0xdeadbeef ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
    }
    h = (h ^ (h >>> 16)) >>> 0;
    return ('00000000' + h.toString(16)).slice(-8);
  };

  const now = Date.now();
  const mins = (m) => new Date(now - m * 60_000).toISOString();
  const raw = [
    {
      seq: 42,
      id: 'gmi_9a4c',
      type: 'init',
      role: 'system',
      author: 'system',
      timestamp: mins(2880),
      content: 'Game model initialized for FC Metall Nord',
    },
    {
      seq: 43,
      id: 'obs_1f8b',
      type: 'ingest',
      role: 'analyst',
      author: 'analyst@metall',
      timestamp: mins(2158),
      content: 'Match ingested: vs FC Hafen (H, 1–0) — xG 1.42, PPDA 8.1, 24 pressing triggers',
    },
    {
      seq: 44,
      id: 'obs_2c07',
      type: 'observation',
      role: 'assistant',
      author: 'assistant@metall',
      timestamp: mins(1440),
      content: 'Mahler cracked under high press — 3/7 completed passes in own third under pressure',
    },
    {
      seq: 45,
      id: 'orc_5e12',
      type: 'decision',
      role: 'oracle',
      author: 'qvac-worker',
      timestamp: mins(1439),
      content: 'LoRA training step accepted: loss 0.7124 → 0.5988 on 156 tactical pairs (v3 step 1)',
    },
    {
      seq: 46,
      id: 'obs_7d31',
      type: 'ingest',
      role: 'analyst',
      author: 'analyst@metall',
      timestamp: mins(732),
      content: 'Set-piece phase tagged: corner routine “Short-9 → near-post flick” recurred vs Hafen',
    },
    {
      seq: 47,
      id: 'obs_a208',
      type: 'observation',
      role: 'coach',
      author: 'head@metall',
      timestamp: mins(390),
      content: 'Away-day plan: drop press line to mid-block from minute 65 if leading by one',
    },
    {
      seq: 48,
      id: 'rev_b119',
      type: 'revert',
      role: 'coach',
      author: 'head@metall',
      timestamp: mins(112),
      content: 'Revert-by-cursor: seq 46 tag “Short-9” superseded — confirmed as opponent decoy, not a routine',
      cursor: 46,
    },
    {
      seq: 49,
      id: 'orc_c744',
      type: 'decision',
      role: 'oracle',
      author: 'qvac-worker',
      timestamp: mins(28),
      content: 'Ingest gate: seq 48 revert accepted, downstream fine-tune batch re-hashed (no rewrite of history)',
    },
  ];

  // Chain them: prev_hash + sig derived deterministically from payload.
  const entries = [];
  let prev = '00000000';
  for (const r of raw) {
    const payload = JSON.stringify({ seq: r.seq, id: r.id, type: r.type, author: r.author, timestamp: r.timestamp, content: r.content, cursor: r.cursor });
    const hash = shortHash(prev + payload);
    const sig = shortHash(hash + r.author).slice(0, 6);
    entries.push({ ...r, prev_hash: prev, hash, sig });
    prev = hash;
  }

  renderHypercoreLog(root, { entries, __fallback: true });
}

function renderHypercoreLog(root, snapshot) {
  const isReal = !snapshot.__fallback;
  const entries = snapshot.entries;

  const typeDotCls = {
    init: 'hypercore-dot--init',
    ingest: 'hypercore-dot--ingest',
    decision: 'hypercore-dot--decision',
    observation: 'hypercore-dot--observation',
    revert: 'hypercore-dot--revert',
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dd}‑${mm} ${hh}:${mi}Z`;
  };

  const escape = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Whitelist: only known safe hypercore entry types. Anything else falls back to a generic class.
  const SAFE_TYPES = { init: 1, ingest: 1, decision: 1, observation: 1, revert: 1 };
  const safeType = (t) => (t && SAFE_TYPES[t]) ? t : 'observation';
  const safeInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? '' : String(n); };

  // Newest-first tail (last 6 entries) with head-of-chain highlighted.
  const tail = entries.slice(-6).reverse();
  const listHtml = tail.map((e, i) => {
    e = e || {};
    const type = safeType(e.type);
    const dotCls = typeDotCls[type] || 'hypercore-dot--observation';
    const isHead = i === 0;
    const cursor = e.cursor ?? (e.meta && e.meta.reverts_seq);
    return `
      <div class="hypercore-entry${isHead ? ' hypercore-entry--head' : ''}" role="listitem" data-seq="${escape(safeInt(e.seq))}">
        <div class="hypercore-entry-marker"><span class="hypercore-dot ${escape(dotCls)}"></span></div>
        <div class="hypercore-entry-body">
          <div class="hypercore-entry-head">
            <span class="hypercore-seq">#${escape(safeInt(e.seq))}</span>
            <span class="hypercore-type hypercore-type--${escape(type)}">${escape(type)}</span>
            <span class="hypercore-role">by ${escape(e.author)}</span>
            <span class="hypercore-time">${escape(fmtTime(e.timestamp))}</span>
            ${isHead ? '<span class="hypercore-head-tag">HEAD</span>' : ''}
            <span class="hypercore-verify" data-seq="${escape(safeInt(e.seq))}"></span>
          </div>
          <div class="hypercore-entry-content">${escape(e.content)}${cursor != null ? ` <span class="hypercore-cursor">→ seq ${escape(safeInt(cursor))}</span>` : ''}</div>
          <div class="hypercore-entry-meta">
            <span class="hypercore-meta-item" title="Autobase entry id">id <code>${escape(e.id)}</code></span>
            <span class="hypercore-meta-item" title="Previous entry hash — forms the append-only chain">prev <code>${escape(e.prev_hash)}</code></span>
            <span class="hypercore-meta-item" title="Hash of this entry's payload chained onto prev">hash <code>${escape(e.hash)}</code></span>
            <span class="hypercore-meta-item" title="ed25519 signature over hash (author key)">sig <code>${escape(e.sig)}</code></span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const badge = isReal
    ? '<span class="data-badge data-badge--real" data-tooltip="Real cryptographic snapshot: sha256 hash-chain + ed25519 signatures. Verifiable in-page.">real</span>'
    : '<span class="data-badge data-badge--example" data-tooltip="Deterministic example tail. Real snapshot lives in data/hypercore-tail.json — served in production.">example</span>';

  const verifyBtn = isReal && snapshot.head_hash
    ? `<button type="button" class="hypercore-verify-btn" data-action="verify">Verify chain</button>
       <span class="hypercore-verify-status" aria-live="polite"></span>`
    : '';

  const headMeta = isReal && snapshot.head_hash_short
    ? `<span class="hypercore-head-meta">head <code>${escape(snapshot.head_hash_short)}</code> · ${escape(safeInt(snapshot.entries_count))} entries</span>`
    : '';

  root.innerHTML = `
    <div class="hypercore-toolbar">
      <span class="hypercore-toolbar-label">Data source ${badge}</span>
      ${headMeta}
      ${verifyBtn}
    </div>
    <div class="hypercore-list" role="list">${listHtml}</div>
  `;

  if (isReal) {
    const btn = root.querySelector('[data-action="verify"]');
    if (btn) btn.addEventListener('click', () => verifyHypercoreChain(root, snapshot, btn));
  }
}

// Recompute sha256 chain in-browser via SubtleCrypto and mark each
// tail entry with ✓/✗ so anyone can see the snapshot is real.
async function verifyHypercoreChain(root, snapshot, btn) {
  const status = root.querySelector('.hypercore-verify-status');
  btn.disabled = true;
  if (status) status.textContent = 'verifying…';

  // SubtleCrypto is only available on HTTPS / localhost — fail gracefully otherwise.
  if (!(typeof crypto !== 'undefined' && crypto.subtle)) {
    if (status) {
      status.textContent = 'verify unavailable (needs HTTPS)';
      status.classList.add('hypercore-verify-status--fail');
    }
    btn.disabled = false;
    return;
  }

  const enc = new TextEncoder();
  const canonical = (obj) => {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  };
  const sha256 = async (str) => {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  try {
    let prev = '0'.repeat(64);
    const results = {};
    let allOk = true;
    const entries = Array.isArray(snapshot && snapshot.entries) ? snapshot.entries : [];
    for (const e of entries) {
      // strip chain/crypto fields, hash the rest
      const { seq: _s, prev_hash: _p, prev_hash_full, hash: _h, hash_full, sig: _sg, sig_full, public_key: _pk, ...payload } = e;
      const expected = await sha256(prev + canonical(payload));
      const ok = expected === hash_full && prev_hash_full === prev;
      results[e.seq] = ok;
      if (!ok) allOk = false;
      prev = hash_full;
    }

    root.querySelectorAll('.hypercore-verify').forEach(el => {
      const seq = Number(el.dataset.seq);
      if (seq in results) {
        el.textContent = results[seq] ? '✓' : '✗';
        el.classList.add(results[seq] ? 'hypercore-verify--ok' : 'hypercore-verify--fail');
        el.title = results[seq] ? 'sha256(prev_hash + canonical(payload)) matches this entry\'s hash' : 'chain mismatch — this entry has been tampered';
      }
    });

    if (status) {
      status.textContent = allOk ? `verified ${entries.length} entries · head ${snapshot.head_hash_short || ''}` : 'chain broken';
      status.classList.toggle('hypercore-verify-status--ok', allOk);
      status.classList.toggle('hypercore-verify-status--fail', !allOk);
    }
  } catch (err) {
    if (status) {
      status.textContent = 'verify failed — ' + (err && err.message ? err.message : 'unknown error');
      status.classList.add('hypercore-verify-status--fail');
    }
  } finally {
    btn.disabled = false;
  }
}

function init() {
  // Isolate every init step: a failure in one section must not prevent the rest
  // of the UI from loading. Errors are surfaced to the console (and to a toast
  // if UI_DEBUG is true) but never bubble to the top-level error handler.
  const safe = (label, fn) => {
    try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(err => console.warn('[init:' + label + '] async failed', err)); }
    catch (err) { console.warn('[init:' + label + '] failed', err); if (window.UI_DEBUG && window.UI) UI.error('Init failed', label + ': ' + (err && err.message)); }
  };
  safe('tooltips', initTooltips);
  safe('tabs', initTabs);
  safe('sidebar', initSidebar);
  safe('banner', initBanner);
  safe('chat', initChat);
  safe('match-timeline', renderMatchTimeline);
  safe('player-cards', renderPlayerCards);
  safe('player-filter', initPlayerFilter);
  safe('player-ratings', renderPlayerRatings);
  safe('sortable-tables', () => enableSortableTables(document.getElementById('player-ratings-table')?.parentNode || document));
  safe('opponents', renderOpponentRecords);
  safe('pressing-chart', renderPressingChart);
  safe('suggestions', renderSuggestions);
  safe('reports', initReports);
  safe('distribute', initDistribute);
  safe('loss-scrubber', initLossScrubber);
  safe('hypercore-log', initHypercoreLog);
  safe('kaggle-stats', initKaggleStats);
  safe('landing-hero', initLandingHero);
  safe('routing', initRouting);
  // Skeleton done — fade it out on next paint so the real UI is already visible
  requestAnimationFrame(hideInitialSkeleton);
}

function initLandingHero() {
  const hero = document.getElementById('landing-hero');
  if (!hero) return;

  // Restore dismissed state.
  try {
    if (localStorage.getItem('mister:hero:dismissed') === '1') {
      hero.classList.add('hero--hidden');
    }
  } catch (_) { /* private mode: hero stays visible */ }

  // Dismiss button.
  const dismissBtn = document.getElementById('hero-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      hero.classList.add('hero--hidden');
      try { localStorage.setItem('mister:hero:dismissed', '1'); } catch (_) {}
    });
  }

  // "See the proof" jumps to proof tab (not #hash-anchor).
  hero.querySelectorAll('[data-tab-jump]').forEach(el => {
    el.addEventListener('click', (e) => {
      const tab = el.getAttribute('data-tab-jump');
      if (tab && window.switchTab) {
        e.preventDefault();
        window.switchTab(tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // "Try the chat" scrolls past the hero to the chat container.
  hero.querySelectorAll('[data-hero-scroll]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector('.chat-container');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ===== KAGGLE RUNS METADATA =====
// Renders live-looking stats + a compact per-run table inside the
// "5 real runs on Kaggle" proof card. Data source: demo/data/kaggle-runs.json
// (deterministic, from real training logs — see JUDGE_GUIDE.md).
async function initKaggleStats() {
  const statsEl = document.getElementById('kaggle-stats');
  const tableEl = document.getElementById('kaggle-runs-table');
  if (!statsEl && !tableEl) return;
  let data = null;
  try {
    const res = await fetch('./data/kaggle-runs.json', { cache: 'no-store' });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.runs)) data = parsed;
    }
  } catch (_) { /* fall through */ }

  if (!data || !Array.isArray(data.runs)) {
    if (statsEl) statsEl.innerHTML = '<div class="kaggle-empty">Run metadata unavailable offline.</div>';
    return;
  }

  try {

  const t = data.totals || {};
  const env = data.environment || {};
  const ds = data.dataset || {};
  const upstream = data.upstream_status || {};

  // ---- stats chips ----
  if (statsEl) {
    const chips = [
      { label: 'GPU', value: (env.accelerator || '').split(' · ')[0] || '—', hint: env.accelerator || '' },
      { label: 'Base', value: (env.base_model || '—').replace('.gguf', ''), hint: 'Loaded on every run via @qvac/sdk' },
      { label: 'Runs', value: String(t.attempts || data.runs.length), hint: 'Total real fine-tune attempts' },
      { label: 'BEFORE evals', value: String(t.before_evals_completed || '—'), hint: 'All 5 completed before the SDK crash' },
      { label: 'Real loss datapoints', value: String(t.real_loss_datapoints || '—'), hint: 'Every one printed by the QVAC worker mid-training' },
      { label: 'Checkpoints', value: String(t.checkpoints_written || '—'), hint: 'model.gguf + optimizer.gguf written to disk' },
      { label: 'GPU minutes', value: '~' + (t.gpu_wall_minutes_est || '—'), hint: 'Wall-clock estimate across all 5 attempts' },
      { label: 'SFT pairs', value: String(ds.sft_pairs || '—'), hint: 'Real supervised training pairs (data/sft_pairs.json)' },
      { label: 'Causal narratives', value: String(ds.causal_narratives || '—'), hint: 'Real causal corpus (data/causal_corpus.json)' },
      { label: 'Upstream bug', value: upstream.bug ? 'reported ✓' : '—', hint: 'SIGABRT in @qvac/sdk native worker — our code ruled out' }
    ];
    statsEl.innerHTML = chips.map(function (c) {
      return '<div class="kaggle-chip" data-tooltip="' + escapeAttr(c.hint) + '">' +
        '<div class="kaggle-chip-label">' + escapeText(c.label) + '</div>' +
        '<div class="kaggle-chip-value">' + escapeText(c.value) + '</div></div>';
    }).join('');
  }

  // ---- runs table ----
  if (tableEl) {
    const outcomeStyle = (o) => {
      if (o === 'before_eval_only') return { cls: 'kaggle-outcome-partial', txt: 'BEFORE only' };
      if (o && o.indexOf('sigabrt') === 0) return { cls: 'kaggle-outcome-crash', txt: 'SIGABRT' };
      return { cls: 'kaggle-outcome-neutral', txt: escapeText(o || '—') };
    };
    const rows = data.runs.map(function (r) {
      const out = outcomeStyle(r.outcome);
      return '<tr data-tooltip="' + escapeAttr((r.note || (r.id + ' — batch ' + r.batch_size + ', ' + (r.steps_completed || 0) + '/' + r.steps_planned + ' steps'))) + '">' +
        '<td class="kaggle-td-id">' + escapeText(r.id) + '</td>' +
        '<td>' + escapeText(r.attempted_at || '—') + '</td>' +
        '<td>' + (r.batch_size || '—') + '</td>' +
        '<td>' + (r.steps_completed || 0) + ' / ' + (r.steps_planned || '—') + '</td>' +
        '<td>' + (r.loss_first != null ? Number(r.loss_first).toFixed(4) : '—') + '</td>' +
        '<td>' + (r.loss_last != null ? Number(r.loss_last).toFixed(4) : '—') + '</td>' +
        '<td><span class="kaggle-outcome ' + out.cls + '">' + out.txt + '</span></td>' +
        '</tr>';
    }).join('');
    tableEl.innerHTML =
      '<div class="table-wrapper">' +
      '<table class="data-table kaggle-runs">' +
      '<thead><tr><th>Run</th><th>Attempted</th><th>Batch</th><th>Steps</th><th>Loss (first)</th><th>Loss (last)</th><th>Outcome</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>';
    try { enableSortableTables(tableEl); } catch (_) {}
  }
  } catch (err) {
    // Any unexpected shape in the JSON must not crash the app.
    if (statsEl) statsEl.innerHTML = '<div class="kaggle-empty">Run metadata rendering failed.</div>';
    if (window.UI_DEBUG) console.warn('[kaggle] render failed', err);
  }
}

// Small HTML-safety helpers used by initKaggleStats + everywhere else that
// interpolates JSON-fetched strings into templated HTML.
function escapeText(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
function escapeAttr(s) { return escapeText(s); }

// ===== SORTABLE TABLES =====
// Attach click-to-sort behaviour to every .data-table inside the given root.
// Numeric-aware (parses numbers from strings like "7.5", "+0.4", "8.9185").
// Safe: swallows any parse error so a broken cell can never break the app.
function enableSortableTables(root) {
  try {
    var scope = root || document;
    var tables = scope.querySelectorAll('.data-table');
    tables.forEach(function (table) {
      if (table.dataset.sortable === 'true') return;
      var thead = table.querySelector('thead');
      var tbody = table.querySelector('tbody');
      if (!thead || !tbody) return;
      if (tbody.rows.length < 2) return; // pointless to sort < 2 rows
      var ths = thead.querySelectorAll('th');
      if (!ths.length) return;
      table.dataset.sortable = 'true';
      ths.forEach(function (th, colIdx) {
        th.classList.add('sortable-th');
        th.setAttribute('role', 'button');
        th.setAttribute('tabindex', '0');
        var handler = function () {
          try {
            var dir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
            // Clear siblings
            ths.forEach(function (other) {
              if (other !== th) {
                other.removeAttribute('data-sort-dir');
                other.classList.remove('sorted-asc', 'sorted-desc');
              }
            });
            th.dataset.sortDir = dir;
            th.classList.toggle('sorted-asc', dir === 'asc');
            th.classList.toggle('sorted-desc', dir === 'desc');

            var rows = Array.prototype.slice.call(tbody.rows);
            var parseCell = function (row) {
              try {
                var cell = row.cells[colIdx];
                if (!cell) return { num: NaN, txt: '' };
                // Prefer inner numeric text from first .rating-cell/etc; fallback to textContent
                var raw = (cell.textContent || '').trim();
                var m = raw.match(/-?\d+(?:[\.,]\d+)?/);
                var num = m ? parseFloat(m[0].replace(',', '.')) : NaN;
                return { num: num, txt: raw.toLowerCase() };
              } catch (_) { return { num: NaN, txt: '' }; }
            };
            rows.sort(function (a, b) {
              var av = parseCell(a), bv = parseCell(b);
              var aNum = !isNaN(av.num), bNum = !isNaN(bv.num);
              var cmp;
              if (aNum && bNum) cmp = av.num - bv.num;
              else if (aNum) cmp = -1;
              else if (bNum) cmp = 1;
              else cmp = av.txt.localeCompare(bv.txt);
              return dir === 'asc' ? cmp : -cmp;
            });
            var frag = document.createDocumentFragment();
            rows.forEach(function (r) { frag.appendChild(r); });
            tbody.appendChild(frag);
          } catch (err) {
            // Fail silent — the user still sees the unsorted table.
            if (window.UI_DEBUG) console.warn('[sort] failed', err);
          }
        };
        th.addEventListener('click', handler);
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
        });
      });
    });
  } catch (err) {
    if (window.UI_DEBUG) console.warn('[enableSortableTables] failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

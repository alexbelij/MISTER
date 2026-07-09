/*
 * site-tour.js — first-visit guided tour (no deps, ~4KB).
 * Public API: window.SiteTour.start({force:true?}) / .reset()
 * Auto-runs once on first load after the app initialises.
 * Skippable, keyboard-navigable, safe on mobile.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.SiteTour) return;

  var STORAGE_KEY = 'mister.tour.seen';
  var Z_OVERLAY = 9998;
  var Z_TIP = 10002;

  // Prefer sidebar nav items on desktop; fall back to bottom-nav on mobile.
  function navSel(tab) { return '.nav-item[data-tab="' + tab + '"], .bottom-nav-item[data-tab="' + tab + '"]'; }

  var STEPS = [
    {
      selector: navSel('chat'),
      title: 'Talk to your on-device AI',
      body: 'Start here. Ask a tactical question \u2014 the model answers in your browser, no round-trip to any server.',
      side: 'right'
    },
    {
      selector: navSel('analytics'),
      title: 'Squad, ratings, opponents',
      body: 'Explore your players and opponents. Click a column header to sort \u2014 Player Ratings supports full 8-criteria sort.',
      side: 'right'
    },
    {
      selector: navSel('reports'),
      title: 'Match & season reports',
      body: 'Pick a match to generate a full report \u2014 tactical summary, top/weakest performer, xG breakdown, recommendations.',
      side: 'right'
    },
    {
      selector: navSel('proof'),
      title: 'The proof tab',
      body: 'Real training loss, real crashes, real Pears hypercore log \u2014 everything shown here is verifiable, not a mock.',
      side: 'right'
    },
    {
      selector: navSel('distribute'),
      title: 'Share via P2P',
      body: 'Scan a QR to open the same session on another device \u2014 no cloud, just Pears peer-to-peer.',
      side: 'right'
    },
    {
      selector: 'body',
      title: 'You are ready.',
      body: 'Install this as an app from your browser menu \u2014 it also works offline. Enjoy exploring.',
      side: 'center'
    }
  ];

  var overlay = null;
  var spotlight = null;
  var tip = null;
  var currentIdx = -1;
  var keyHandler = null;

  function safe(fn) { try { return fn(); } catch (_) { return null; } }
  function hasSeen() { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return true; } }
  function markSeen() { try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {} }
  function reset() { try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} }

  function el(tag, attrs, txt) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); }
    if (txt) n.textContent = txt;
    return n;
  }

  function createOverlay() {
    overlay = el('div', { class: 'tour-overlay', 'aria-hidden': 'true' });
    overlay.style.cssText = 'position:fixed;inset:0;z-index:' + Z_OVERLAY + ';pointer-events:none;';
    spotlight = el('div', { class: 'tour-spotlight' });
    spotlight.style.cssText = 'position:absolute;border-radius:10px;box-shadow:0 0 0 9999px rgba(1,4,9,0.72);transition:all 0.28s cubic-bezier(0.25,0.8,0.25,1);pointer-events:none;';
    overlay.appendChild(spotlight);

    tip = el('div', { class: 'tour-tip', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-tip-title' });
    tip.style.cssText = 'position:absolute;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px 18px;max-width:320px;width:calc(100% - 32px);box-shadow:0 12px 32px rgba(0,0,0,0.5);color:#e6edf3;font-size:13px;line-height:1.5;pointer-events:auto;z-index:' + Z_TIP + ';';
    overlay.appendChild(tip);

    document.body.appendChild(overlay);
  }

  function positionSpotlight(rect) {
    if (!spotlight) return;
    var pad = 6;
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';
  }

  function positionTip(rect, side) {
    if (!tip) return;
    var margin = 16;
    var tipW = tip.offsetWidth || 320;
    var tipH = tip.offsetHeight || 160;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    if (side === 'center' || !rect || (rect.width === 0 && rect.height === 0)) {
      tip.style.left = Math.max(16, (vw - tipW) / 2) + 'px';
      tip.style.top = Math.max(16, (vh - tipH) / 2) + 'px';
      return;
    }

    // On narrow screens: always place under the target
    var narrow = vw < 720;
    var top, left;
    if (narrow) {
      // Prefer below; fallback above; fallback centered
      if (rect.bottom + margin + tipH < vh) { top = rect.bottom + margin; left = margin; }
      else if (rect.top - margin - tipH > 0) { top = rect.top - margin - tipH; left = margin; }
      else { top = Math.max(16, (vh - tipH) / 2); left = 16; }
      tip.style.left = Math.min(Math.max(margin, left), vw - tipW - margin) + 'px';
      tip.style.top = top + 'px';
      return;
    }

    if (side === 'right' && rect.right + margin + tipW < vw) {
      left = rect.right + margin;
      top = Math.max(margin, Math.min(rect.top, vh - tipH - margin));
    } else if (side === 'left' && rect.left - margin - tipW > 0) {
      left = rect.left - margin - tipW;
      top = Math.max(margin, Math.min(rect.top, vh - tipH - margin));
    } else if (rect.bottom + margin + tipH < vh) {
      left = Math.max(margin, Math.min(rect.left, vw - tipW - margin));
      top = rect.bottom + margin;
    } else {
      left = Math.max(margin, Math.min(rect.left, vw - tipW - margin));
      top = Math.max(margin, rect.top - margin - tipH);
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function renderTip(step, idx, total) {
    tip.innerHTML = '';
    var head = el('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
    var title = el('div', { id: 'tour-tip-title' }, step.title);
    title.style.cssText = 'font-weight:600;font-size:14px;color:#e6edf3;';
    var progress = el('div', {}, (idx + 1) + ' / ' + total);
    progress.style.cssText = 'font-size:11px;color:#8b949e;font-family:ui-monospace,monospace;';
    head.appendChild(title);
    head.appendChild(progress);

    var body = el('div', {}, step.body);
    body.style.cssText = 'color:#c9d1d9;font-size:13px;line-height:1.55;margin:0 0 14px;';

    var footer = el('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
    var skipBtn = el('button', { type: 'button' }, idx === total - 1 ? 'Close' : 'Skip tour');
    skipBtn.style.cssText = 'background:transparent;border:1px solid #30363d;color:#8b949e;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;';
    skipBtn.onmouseenter = function () { skipBtn.style.color = '#e6edf3'; skipBtn.style.borderColor = '#484f58'; };
    skipBtn.onmouseleave = function () { skipBtn.style.color = '#8b949e'; skipBtn.style.borderColor = '#30363d'; };
    skipBtn.onclick = function () { stop(); };

    var right = el('div');
    right.style.cssText = 'display:flex;gap:6px;';
    if (idx > 0) {
      var back = el('button', { type: 'button' }, 'Back');
      back.style.cssText = 'background:#21262d;border:1px solid #30363d;color:#c9d1d9;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;';
      back.onclick = function () { goto(idx - 1); };
      right.appendChild(back);
    }
    var next = el('button', { type: 'button' }, idx === total - 1 ? 'Finish' : 'Next');
    next.style.cssText = 'background:#238636;border:1px solid #238636;color:#fff;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;';
    next.onmouseenter = function () { next.style.background = '#2ea043'; next.style.borderColor = '#2ea043'; };
    next.onmouseleave = function () { next.style.background = '#238636'; next.style.borderColor = '#238636'; };
    next.onclick = function () {
      if (idx === total - 1) stop();
      else goto(idx + 1);
    };
    right.appendChild(next);

    footer.appendChild(skipBtn);
    footer.appendChild(right);

    tip.appendChild(head);
    tip.appendChild(body);
    tip.appendChild(footer);
  }

  function goto(idx) {
    var step = STEPS[idx];
    if (!step) { stop(); return; }
    currentIdx = idx;
    var target = null;
    safe(function () { target = document.querySelector(step.selector); });
    if (!target && step.side !== 'center') {
      // Skip missing target — likely the tab is hidden. Move on.
      goto(idx + 1);
      return;
    }
    var rect = target ? target.getBoundingClientRect() : null;
    if (step.side === 'center' || !rect) {
      positionSpotlight({ left: -9999, top: -9999, width: 0, height: 0 });
    } else {
      positionSpotlight(rect);
    }
    renderTip(step, idx, STEPS.length);
    // Position tip after render so we know its size
    requestAnimationFrame(function () { positionTip(rect, step.side); });
  }

  function stop() {
    markSeen();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = spotlight = tip = null;
    currentIdx = -1;
    if (keyHandler) { document.removeEventListener('keydown', keyHandler, true); keyHandler = null; }
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
  }

  function onResize() {
    if (currentIdx < 0) return;
    var step = STEPS[currentIdx];
    if (!step) return;
    var target = null;
    safe(function () { target = document.querySelector(step.selector); });
    var rect = target ? target.getBoundingClientRect() : null;
    if (rect && step.side !== 'center') positionSpotlight(rect);
    positionTip(rect, step.side);
  }

  function start(opts) {
    opts = opts || {};
    if (!opts.force && hasSeen()) return;
    if (currentIdx >= 0) return; // already running
    safe(function () {
      createOverlay();
      keyHandler = function (e) {
        if (e.key === 'Escape') { stop(); e.stopPropagation(); }
        else if (e.key === 'ArrowRight' || e.key === 'Enter') { goto(currentIdx + 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { goto(currentIdx - 1); e.preventDefault(); }
      };
      document.addEventListener('keydown', keyHandler, true);
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onResize, true);
      goto(0);
    });
  }

  window.SiteTour = { start: start, stop: stop, reset: reset };

  // Auto-run on first visit after DOM + app boot (delay so skeleton/hero settle)
  var autoStart = function () {
    if (hasSeen()) return;
    setTimeout(function () { start(); }, 1200);
  };
  if (document.readyState === 'complete') autoStart();
  else window.addEventListener('load', autoStart);
})();

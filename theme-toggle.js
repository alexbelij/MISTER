/**
 * theme-toggle.js — dark/light theme toggle for MISTER demo.
 *
 * Contract:
 *   • Theme is set in <head> BEFORE CSS parses (inline bootstrap) to avoid FOUC.
 *     That inline script reads localStorage.mister-theme first, then falls back
 *     to prefers-color-scheme, defaulting to 'dark'.
 *   • This file wires the toggle buttons (#theme-toggle in sidebar,
 *     #theme-toggle-mobile in mobile topbar) and Shift+D keyboard shortcut.
 *   • Persists to localStorage. Broadcasts a 'themechange' CustomEvent so
 *     any chart / canvas layer can re-render if it needs to.
 *   • Updates the <meta name="theme-color"> so mobile browsers' chrome
 *     matches the active theme.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mister-theme';
  var DARK = 'dark', LIGHT = 'light';

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || DARK;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_e) {}

    // Update meta theme-color for mobile browser chrome
    var color = theme === LIGHT ? '#ffffff' : '#0d1117';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach(function (m) {
      // The media-scoped ones stay; only touch the generic one if present
      if (!m.getAttribute('media')) m.setAttribute('content', color);
    });

    // Fire a bus event so charts / canvases can redraw if needed
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    } catch (_e) {}

    // Announce to screen readers (once wired via UI)
    if (window.UI && typeof window.UI.toast === 'function') {
      window.UI.toast({ title: theme === LIGHT ? 'Light theme' : 'Dark theme', variant: 'info', duration: 1500 });
    }
  }

  function toggle() {
    applyTheme(getTheme() === DARK ? LIGHT : DARK);
  }

  function wireButton(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
  }

  function init() {
    wireButton('theme-toggle');
    wireButton('theme-toggle-mobile');

    // Keyboard shortcut: Shift+D
    document.addEventListener('keydown', function (e) {
      // Ignore when typing in inputs, textareas, contenteditables
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.shiftKey && (e.key === 'D' || e.key === 'd') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    });

    // Expose for other scripts / dev-console
    window.Theme = { get: getTheme, set: applyTheme, toggle: toggle };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

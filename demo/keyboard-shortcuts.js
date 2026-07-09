/**
 * keyboard-shortcuts.js — global keyboard-shortcuts for MISTER demo.
 *
 * All shortcuts are single-key (or Shift+key). Modifiers Ctrl/Cmd/Alt are
 * left to the browser. Shortcuts are ignored when the user is typing in an
 * input, textarea, or contenteditable element.
 *
 * Registered shortcuts:
 *   ?          Open help modal (this cheat-sheet)
 *   /          Focus the chat input
 *   g c        Go to Chat
 *   g a        Go to Analytics
 *   g s        Go to Suggestions
 *   g r        Go to Reports
 *   g d        Go to Distribute
 *   g p        Go to Proof
 *   Shift+D    Toggle dark/light theme  (wired in theme-toggle.js — listed here for completeness)
 *   Esc        Close open modal / help
 *
 * The g-prefix is a two-key sequence with a 1.2s window (Gmail-style).
 */
(function () {
  'use strict';

  var G_WINDOW_MS = 1200;
  var gArmedAt = 0;

  function inFormElement(t) {
    if (!t) return false;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
  }

  function go(tab) {
    if (typeof window.switchTab === 'function') {
      window.switchTab(tab);
      if (window.UI && window.UI.toast) window.UI.toast({ title: '\u2192 ' + capitalise(tab), variant: 'info', duration: 900 });
    }
  }
  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function focusChat() {
    var input = document.getElementById('chat-input') ||
                document.querySelector('.chat-input input') ||
                document.querySelector('.chat-input textarea') ||
                document.querySelector('.chat-input');
    if (!input) return false;
    // Switch to chat tab first, then focus
    if (typeof window.switchTab === 'function') window.switchTab('chat');
    setTimeout(function () { try { input.focus(); } catch (_e) {} }, 50);
    return true;
  }

  var HELP_HTML = ''
    + '<div class="kbd-help-inner">'
    + '  <button class="kbd-help-close" type="button" aria-label="Close" onclick="window.KbdShortcuts && window.KbdShortcuts.hideHelp()">&times;</button>'
    + '  <h3 class="kbd-help-title">Keyboard shortcuts</h3>'
    + '  <table class="kbd-help-table">'
    + '    <tr><td><kbd>?</kbd></td><td>Open this help</td></tr>'
    + '    <tr><td><kbd>/</kbd></td><td>Focus chat input</td></tr>'
    + '    <tr><td><kbd>g</kbd> <kbd>c</kbd></td><td>Go to Chat</td></tr>'
    + '    <tr><td><kbd>g</kbd> <kbd>a</kbd></td><td>Go to Analytics</td></tr>'
    + '    <tr><td><kbd>g</kbd> <kbd>s</kbd></td><td>Go to Suggestions</td></tr>'
    + '    <tr><td><kbd>g</kbd> <kbd>r</kbd></td><td>Go to Reports</td></tr>'
    + '    <tr><td><kbd>g</kbd> <kbd>d</kbd></td><td>Go to Distribute</td></tr>'
    + '    <tr><td><kbd>g</kbd> <kbd>p</kbd></td><td>Go to Proof</td></tr>'
    + '    <tr><td><kbd>Shift</kbd> + <kbd>D</kbd></td><td>Toggle dark / light theme</td></tr>'
    + '    <tr><td><kbd>Esc</kbd></td><td>Close modal / help</td></tr>'
    + '  </table>'
    + '  <p class="kbd-help-footnote">Shortcuts pause while typing in an input.</p>'
    + '</div>';

  function showHelp() {
    var existing = document.getElementById('kbd-help');
    if (existing) { existing.classList.add('open'); return; }
    var backdrop = document.createElement('div');
    backdrop.id = 'kbd-help';
    backdrop.className = 'kbd-help-backdrop open';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'kbd-help-title');
    backdrop.innerHTML = HELP_HTML;
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) hideHelp();
    });
    document.body.appendChild(backdrop);
  }

  function hideHelp() {
    var el = document.getElementById('kbd-help');
    if (el) el.classList.remove('open');
    // Remove after transition so a subsequent open animates in cleanly
    setTimeout(function () { if (el && !el.classList.contains('open')) el.remove(); }, 200);
  }

  function anyOpenModal() {
    return document.querySelector('.ui-dialog-backdrop.open, #kbd-help.open');
  }

  document.addEventListener('keydown', function (e) {
    // Esc always closes topmost modal
    if (e.key === 'Escape') {
      var open = document.querySelector('#kbd-help.open');
      if (open) { hideHelp(); e.preventDefault(); return; }
    }
    if (inFormElement(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    var now = Date.now();
    // g-prefix chord — first key
    if (!e.shiftKey && (e.key === 'g' || e.key === 'G')) {
      gArmedAt = now;
      return;
    }
    // g-prefix chord — second key within window
    if (gArmedAt && (now - gArmedAt) < G_WINDOW_MS) {
      gArmedAt = 0;
      var k = e.key.toLowerCase();
      if (k === 'c') { go('chat');        e.preventDefault(); return; }
      if (k === 'a') { go('analytics');   e.preventDefault(); return; }
      if (k === 's') { go('suggestions'); e.preventDefault(); return; }
      if (k === 'r') { go('reports');     e.preventDefault(); return; }
      if (k === 'd') { go('distribute');  e.preventDefault(); return; }
      if (k === 'p') { go('proof');       e.preventDefault(); return; }
    }

    // Single-key shortcuts
    if (e.key === '?') {
      showHelp();
      e.preventDefault();
      return;
    }
    if (e.key === '/') {
      if (focusChat()) e.preventDefault();
      return;
    }
  });

  // Expose
  window.KbdShortcuts = { showHelp: showHelp, hideHelp: hideHelp };
})();

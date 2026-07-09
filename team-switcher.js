/**
 * team-switcher.js — Multi-team context picker for MISTER
 *
 * Purpose:
 *  - Replaces the static "FC Metall Nord" card in the sidebar with an
 *    interactive dropdown that lists all teams the current user is a member
 *    of, plus a "Create team" / "Join team" onboarding flow.
 *
 *  - Team memberships are persisted locally in localStorage under the key
 *    `mister:teams`. Each entry is { id, name, league, formation, role, coach }.
 *    The currently active team is stored under `mister:active-team`.
 *
 *  - Wires up a fixed mobile-topbar chip too, so the active team stays
 *    visible on small screens where the sidebar is collapsed.
 *
 * Ties to the identity trilogy:
 *  - The design mirrors the on-disk model produced by src/identity/*.js:
 *      * team_id, role, human-readable name/league/formation
 *  - This UI is intentionally standalone: it does NOT sign or verify
 *    manifests in the browser (that lives in the Pear runtime). It just
 *    lets a demo visitor experience the multi-team switching flow.
 */

(function () {
  'use strict';

  var STORAGE_TEAMS = 'mister:teams';
  var STORAGE_ACTIVE = 'mister:active-team';

  // Default seed — the same team the sidebar always showed. Kept so a
  // first-time visitor sees exactly the same content as before.
  var DEFAULT_TEAMS = [
    {
      id: 'fc-metall-nord',
      name: 'FC Metall Nord',
      league: 'Regional Liga Nord',
      formation: '4-3-3',
      role: 'head_coach',
      coach: 'Coach Thomas Voss'
    }
  ];

  function loadTeams() {
    try {
      var raw = localStorage.getItem(STORAGE_TEAMS);
      if (!raw) return DEFAULT_TEAMS.slice();
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TEAMS.slice();
      return parsed;
    } catch (e) {
      return DEFAULT_TEAMS.slice();
    }
  }

  function saveTeams(teams) {
    try {
      localStorage.setItem(STORAGE_TEAMS, JSON.stringify(teams));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  function loadActiveId() {
    try {
      return localStorage.getItem(STORAGE_ACTIVE) || null;
    } catch (e) { return null; }
  }

  function saveActiveId(id) {
    try { localStorage.setItem(STORAGE_ACTIVE, id); } catch (e) {}
  }

  function findActive(teams, activeId) {
    if (activeId) {
      for (var i = 0; i < teams.length; i++) {
        if (teams[i].id === activeId) return teams[i];
      }
    }
    return teams[0];
  }

  function roleLabel(role) {
    switch (role) {
      case 'head_coach': return 'Head coach';
      case 'assistant_coach': return 'Assistant coach';
      case 'analyst': return 'Analyst';
      case 'player': return 'Player';
      default: return role || 'Member';
    }
  }

  function slugify(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || ('team-' + Date.now().toString(36));
  }

  var state = {
    teams: loadTeams(),
    activeId: null,
    dropdownOpen: false
  };

  function init() {
    state.activeId = loadActiveId() || state.teams[0].id;
    // If saved active id no longer exists, fall back to first team.
    if (!findActive(state.teams, state.activeId)) {
      state.activeId = state.teams[0].id;
    }

    renderSidebarSwitcher();
    renderMobileChip();
    attachGlobalHandlers();

    // Expose a tiny API so app.js / chat.js can react to team changes.
    window.MisterTeams = {
      getActive: function () { return findActive(state.teams, state.activeId); },
      list: function () { return state.teams.slice(); },
      onChange: function (fn) {
        window.addEventListener('mister:team-changed', function (e) { fn(e.detail); });
      }
    };
  }

  function attachGlobalHandlers() {
    // Close dropdown on outside click.
    document.addEventListener('click', function (e) {
      if (!state.dropdownOpen) return;
      var root = document.getElementById('team-switcher-root');
      if (root && !root.contains(e.target)) closeDropdown();
    });

    // Close on Escape.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.dropdownOpen) closeDropdown();
    });
  }

  // -------- Sidebar switcher (replaces .club-card) --------

  function renderSidebarSwitcher() {
    var footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    // First render replaces .club-card; subsequent renders replace the
    // existing #team-switcher-root in place.
    var slot = footer.querySelector('#team-switcher-root') || footer.querySelector('.club-card');
    if (!slot) return;

    var wrap = document.createElement('div');
    wrap.id = 'team-switcher-root';
    wrap.className = 'team-switcher-root';
    wrap.innerHTML = buildSidebarHTML();
    slot.replaceWith(wrap);

    var trigger = wrap.querySelector('.team-switcher-trigger');
    trigger.addEventListener('click', toggleDropdown);
  }

  function buildSidebarHTML() {
    var active = findActive(state.teams, state.activeId);
    return (
      '<button class="team-switcher-trigger" ' +
        'data-tooltip="Active team context. Click to switch teams or create/join a new one." ' +
        'aria-haspopup="listbox" aria-expanded="false">' +
        '<div class="team-switcher-info">' +
          '<div class="team-switcher-name">' + escapeHtml(active.name) + '</div>' +
          '<div class="team-switcher-meta">' + escapeHtml(active.league) + ' · ' + escapeHtml(active.formation) + '</div>' +
          '<div class="team-switcher-role">' + escapeHtml(roleLabel(active.role)) + (active.coach ? ' · ' + escapeHtml(active.coach) : '') + '</div>' +
        '</div>' +
        '<svg class="team-switcher-caret" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
          '<path fill="currentColor" d="M7 10l5 5 5-5z"/>' +
        '</svg>' +
      '</button>' +
      '<div class="team-switcher-menu" role="listbox" hidden>' +
        buildTeamList() +
        '<div class="team-switcher-divider"></div>' +
        '<button class="team-switcher-action" data-action="create">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>' +
          '<span>Create team</span>' +
        '</button>' +
        '<button class="team-switcher-action" data-action="join">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L20 8l-9 9z"/></svg>' +
          '<span>Join team</span>' +
        '</button>' +
      '</div>'
    );
  }

  function buildTeamList() {
    return state.teams.map(function (t) {
      var isActive = t.id === state.activeId;
      return (
        '<button class="team-switcher-item' + (isActive ? ' is-active' : '') + '" role="option" ' +
          'aria-selected="' + isActive + '" data-team-id="' + escapeAttr(t.id) + '">' +
          '<div class="team-switcher-item-name">' + escapeHtml(t.name) + '</div>' +
          '<div class="team-switcher-item-meta">' + escapeHtml(roleLabel(t.role)) + '</div>' +
          (isActive ? '<svg class="team-switcher-check" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : '') +
        '</button>'
      );
    }).join('');
  }

  function toggleDropdown() {
    if (state.dropdownOpen) closeDropdown();
    else openDropdown();
  }

  function openDropdown() {
    var root = document.getElementById('team-switcher-root');
    if (!root) return;
    var menu = root.querySelector('.team-switcher-menu');
    var trigger = root.querySelector('.team-switcher-trigger');
    if (!menu || !trigger) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    state.dropdownOpen = true;
    root.classList.add('is-open');

    // Delegate handlers within menu.
    menu.querySelectorAll('.team-switcher-item').forEach(function (btn) {
      btn.addEventListener('click', function () { selectTeam(btn.dataset.teamId); });
    });
    menu.querySelectorAll('.team-switcher-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.action;
        closeDropdown();
        if (action === 'create') openCreateModal();
        if (action === 'join') openJoinModal();
      });
    });
  }

  function closeDropdown() {
    var root = document.getElementById('team-switcher-root');
    if (!root) return;
    var menu = root.querySelector('.team-switcher-menu');
    var trigger = root.querySelector('.team-switcher-trigger');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    state.dropdownOpen = false;
    root.classList.remove('is-open');
  }

  function selectTeam(id) {
    if (!id || id === state.activeId) { closeDropdown(); return; }
    state.activeId = id;
    saveActiveId(id);
    closeDropdown();
    renderSidebarSwitcher();
    renderMobileChip();
    var active = findActive(state.teams, state.activeId);
    window.dispatchEvent(new CustomEvent('mister:team-changed', { detail: active }));
    if (window.UI && typeof window.UI.info === 'function') {
      window.UI.info('Team switched', active.name);
    }
  }

  // -------- Mobile topbar chip --------

  function renderMobileChip() {
    var topbar = document.querySelector('.mobile-topbar') || document.getElementById('mobile-topbar');
    if (!topbar) return;
    var existing = topbar.querySelector('.team-chip');
    if (existing) existing.remove();

    var active = findActive(state.teams, state.activeId);
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'team-chip';
    chip.setAttribute('aria-label', 'Switch team (' + active.name + ')');
    chip.innerHTML =
      '<span class="team-chip-name">' + escapeHtml(active.name) + '</span>' +
      '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>';

    // On mobile, opening the sidebar via the burger already reveals the
    // full switcher. Clicking the chip should open the sidebar and then
    // pop the dropdown so the user immediately sees their options.
    chip.addEventListener('click', function () {
      if (typeof window.openSidebar === 'function') window.openSidebar();
      setTimeout(openDropdown, 260);
    });

    // Insert AFTER the logo but before actions (keeps burger untouched).
    var logo = topbar.querySelector('.mobile-logo');
    if (logo && logo.nextSibling) {
      topbar.insertBefore(chip, logo.nextSibling);
    } else {
      topbar.appendChild(chip);
    }
  }

  // -------- Create / Join modals --------

  function openCreateModal() {
    openModal({
      title: 'Create a new team',
      body:
        '<label class="ts-field">' +
          '<span>Team name</span>' +
          '<input type="text" id="ts-create-name" placeholder="e.g. FC Alexandria U-15" maxlength="60" />' +
        '</label>' +
        '<label class="ts-field">' +
          '<span>League / division</span>' +
          '<input type="text" id="ts-create-league" placeholder="e.g. Regional Liga Nord" maxlength="60" />' +
        '</label>' +
        '<label class="ts-field">' +
          '<span>Preferred formation</span>' +
          '<input type="text" id="ts-create-formation" placeholder="e.g. 4-3-3" maxlength="20" />' +
        '</label>' +
        '<p class="ts-hint">You will become the <strong>head coach</strong> of this team. The team keypair is generated on your device; teammates join later via an invite link.</p>',
      confirmLabel: 'Create team',
      onConfirm: function (root) {
        var name = (root.querySelector('#ts-create-name').value || '').trim();
        var league = (root.querySelector('#ts-create-league').value || '').trim() || 'Local league';
        var formation = (root.querySelector('#ts-create-formation').value || '').trim() || '4-3-3';
        if (!name) {
          flashError(root, 'Team name is required.');
          return false;
        }
        var id = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
        var team = {
          id: id,
          name: name,
          league: league,
          formation: formation,
          role: 'head_coach',
          coach: 'You (head coach)'
        };
        state.teams.push(team);
        state.activeId = id;
        saveTeams(state.teams);
        saveActiveId(id);
        renderSidebarSwitcher();
        renderMobileChip();
        window.dispatchEvent(new CustomEvent('mister:team-changed', { detail: team }));
        if (window.UI && typeof window.UI.success === 'function') {
          window.UI.success('Team created', name + ' · you are the head coach');
        }
        return true;
      }
    });
  }

  function openJoinModal() {
    openModal({
      title: 'Join an existing team',
      body:
        '<label class="ts-field">' +
          '<span>Invite code or link</span>' +
          '<input type="text" id="ts-join-code" placeholder="paste invite link…" maxlength="200" />' +
        '</label>' +
        '<label class="ts-field">' +
          '<span>Your role on this team</span>' +
          '<select id="ts-join-role">' +
            '<option value="assistant_coach">Assistant coach</option>' +
            '<option value="analyst">Analyst</option>' +
            '<option value="player">Player</option>' +
          '</select>' +
        '</label>' +
        '<p class="ts-hint">The invite link encodes the team topic. Your device will connect over Pears, exchange public keys, and receive the signed team manifest. In this demo build we simulate the handshake locally.</p>',
      confirmLabel: 'Join team',
      onConfirm: function (root) {
        var code = (root.querySelector('#ts-join-code').value || '').trim();
        var role = root.querySelector('#ts-join-role').value || 'assistant_coach';
        if (!code) {
          flashError(root, 'Paste an invite link or code.');
          return false;
        }
        // Extract a friendly name if the code looks like a URL; otherwise use the last path segment.
        var name = 'Invited team';
        try {
          var url = new URL(code);
          var seg = url.hash.replace(/^#/, '') || url.pathname.split('/').filter(Boolean).pop() || '';
          if (seg) name = seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).slice(0, 40);
        } catch (e) {
          name = code.replace(/[-_]+/g, ' ').slice(0, 40) || 'Invited team';
        }
        var id = 'inv-' + slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
        var team = {
          id: id,
          name: name,
          league: 'Joined via invite',
          formation: '—',
          role: role,
          coach: 'Head coach (remote)'
        };
        state.teams.push(team);
        state.activeId = id;
        saveTeams(state.teams);
        saveActiveId(id);
        renderSidebarSwitcher();
        renderMobileChip();
        window.dispatchEvent(new CustomEvent('mister:team-changed', { detail: team }));
        if (window.UI && typeof window.UI.success === 'function') {
          window.UI.success('Joined team', name + ' · ' + roleLabel(role));
        }
        return true;
      }
    });
  }

  function openModal(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'ts-modal-overlay';
    overlay.innerHTML =
      '<div class="ts-modal" role="dialog" aria-modal="true" aria-labelledby="ts-modal-title">' +
        '<div class="ts-modal-header">' +
          '<h3 id="ts-modal-title">' + escapeHtml(opts.title) + '</h3>' +
          '<button class="ts-modal-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ts-modal-body">' + opts.body + '</div>' +
        '<div class="ts-modal-footer">' +
          '<button class="ts-btn ts-btn-secondary" data-role="cancel">Cancel</button>' +
          '<button class="ts-btn ts-btn-primary" data-role="confirm">' + escapeHtml(opts.confirmLabel) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function close() {
      overlay.classList.add('is-closing');
      setTimeout(function () { overlay.remove(); }, 160);
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.ts-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-role="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-role="confirm"]').addEventListener('click', function () {
      if (opts.onConfirm(overlay) !== false) close();
    });

    // Focus the first input.
    setTimeout(function () {
      var input = overlay.querySelector('input, select');
      if (input) input.focus();
    }, 50);

    // Submit on Enter inside inputs.
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        if (opts.onConfirm(overlay) !== false) close();
      }
      if (e.key === 'Escape') close();
    });
  }

  function flashError(root, msg) {
    var existing = root.querySelector('.ts-modal-error');
    if (existing) existing.remove();
    var err = document.createElement('div');
    err.className = 'ts-modal-error';
    err.textContent = msg;
    root.querySelector('.ts-modal-body').appendChild(err);
    setTimeout(function () { err.remove(); }, 3000);
  }

  // -------- Utilities --------

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // -------- Bootstrap --------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

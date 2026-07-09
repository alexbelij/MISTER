/*
 * ui-notify.js — toast + modal system.
 * Zero deps. Public API:
 *   window.UI.toast({ title, body, variant, duration, actions })
 *   window.UI.dialog({ title, body, actions, dismissable }) -> Promise<actionValue|null>
 *   window.UI.confirm(title, body) -> Promise<boolean>
 *   window.UI.alert(title, body)   -> Promise<void>
 *   window.UI.info/success/warn/error(title, body, opts)  // toast shortcuts
 * Accessible: role=alert on toasts, dialog is focus-trapped, Esc/backdrop close.
 * All errors are swallowed — a broken toast never breaks the app.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.UI) return;

  var TOAST_CONTAINER_ID = 'ui-toast-container';
  var DIALOG_HOST_ID = 'ui-dialog-host';
  var DEFAULT_DURATION = 5000;
  var MAX_TOASTS = 4;

  function safe(fn) { try { return fn(); } catch (_) { return null; } }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function ensureContainer() {
    var c = document.getElementById(TOAST_CONTAINER_ID);
    if (c) return c;
    c = el('div', { id: TOAST_CONTAINER_ID, class: 'ui-toast-container', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.appendChild(c);
    return c;
  }

  function iconFor(variant) {
    var paths = {
      info:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15a1 1 0 110-2 1 1 0 010 2zm1-5h-2V7h2v5z',
      success: 'M9 16.2l-3.5-3.6L4 14l5 5 11-11-1.4-1.4L9 16.2z',
      warn:    'M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z',
      error:   'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6 10.6 12 7 8.4 8.4 7 12 10.6 15.6 7 17 8.4 13.4 12 17 15.6z'
    };
    var d = paths[variant] || paths.info;
    var svg = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(svg, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '20');
    s.setAttribute('height', '20');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(svg, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'currentColor');
    s.appendChild(p);
    return s;
  }

  function trimContainer(container) {
    while (container.children.length > MAX_TOASTS) {
      var oldest = container.firstElementChild;
      if (!oldest) break;
      dismissToast(oldest);
    }
  }

  function dismissToast(node) {
    if (!node || !node.parentNode) return;
    node.classList.add('ui-toast--leaving');
    var t = setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 260);
    node._timer && clearTimeout(node._timer);
    node._timer = t;
  }

  function toast(opts) {
    opts = opts || {};
    return safe(function () {
      var container = ensureContainer();
      var variant = ['info', 'success', 'warn', 'error'].indexOf(opts.variant) >= 0 ? opts.variant : 'info';
      var duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION;

      var iconWrap = el('div', { class: 'ui-toast__icon' }, [iconFor(variant)]);
      var body = el('div', { class: 'ui-toast__body' });
      if (opts.title) body.appendChild(el('div', { class: 'ui-toast__title', text: String(opts.title) }));
      if (opts.body) body.appendChild(el('div', { class: 'ui-toast__msg', text: String(opts.body) }));

      var actions = null;
      if (Array.isArray(opts.actions) && opts.actions.length) {
        actions = el('div', { class: 'ui-toast__actions' });
        opts.actions.slice(0, 2).forEach(function (a) {
          var btn = el('button', { class: 'ui-toast__action' + (a.primary ? ' ui-toast__action--primary' : ''), type: 'button', text: a.label || 'OK' });
          btn.addEventListener('click', function () {
            safe(function () { a.onClick && a.onClick(); });
            dismissToast(node);
          });
          actions.appendChild(btn);
        });
      }

      var closeBtn = el('button', { class: 'ui-toast__close', type: 'button', 'aria-label': 'Dismiss' });
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', function () { dismissToast(node); });

      var node = el('div', { class: 'ui-toast ui-toast--' + variant, role: 'status', 'aria-live': 'polite' }, [iconWrap, body, actions, closeBtn]);
      container.appendChild(node);
      trimContainer(container);

      // Auto-dismiss (0 = sticky)
      if (duration > 0) {
        node._timer = setTimeout(function () { dismissToast(node); }, duration);
        // Pause on hover
        node.addEventListener('mouseenter', function () { node._timer && clearTimeout(node._timer); });
        node.addEventListener('mouseleave', function () {
          node._timer && clearTimeout(node._timer);
          node._timer = setTimeout(function () { dismissToast(node); }, Math.max(1500, duration / 2));
        });
      }

      return { dismiss: function () { dismissToast(node); }, node: node };
    });
  }

  // ---------- Dialog ----------
  var openDialog = null;

  function trapFocus(container, e) {
    var focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  function closeDialog(value) {
    if (!openDialog) return;
    var d = openDialog;
    openDialog = null;
    d.host.classList.add('ui-dialog-host--leaving');
    setTimeout(function () {
      if (d.host.parentNode) d.host.parentNode.removeChild(d.host);
      if (d.prevFocus && d.prevFocus.focus) safe(function () { d.prevFocus.focus(); });
    }, 200);
    d.resolve(value === undefined ? null : value);
  }

  function dialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      safe(function () {
        // Close any prior dialog first
        if (openDialog) closeDialog(null);

        var titleId = 'ui-dialog-title-' + Date.now();
        var bodyId = 'ui-dialog-body-' + Date.now();
        var host = el('div', { id: DIALOG_HOST_ID, class: 'ui-dialog-host', role: 'presentation' });
        var backdrop = el('div', { class: 'ui-dialog-backdrop' });
        var panel = el('div', { class: 'ui-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': bodyId, tabindex: '-1' });

        var head = el('div', { class: 'ui-dialog__head' });
        head.appendChild(el('div', { id: titleId, class: 'ui-dialog__title', text: opts.title || 'Notice' }));
        if (opts.dismissable !== false) {
          var x = el('button', { class: 'ui-dialog__close', type: 'button', 'aria-label': 'Close' });
          x.innerHTML = '&times;';
          x.addEventListener('click', function () { closeDialog(null); });
          head.appendChild(x);
        }

        var body = el('div', { id: bodyId, class: 'ui-dialog__body' });
        if (opts.body) {
          if (opts.body instanceof Node) body.appendChild(opts.body);
          else body.appendChild(el('p', { text: String(opts.body) }));
        }

        var footer = el('div', { class: 'ui-dialog__footer' });
        var actions = Array.isArray(opts.actions) && opts.actions.length ? opts.actions : [{ label: 'OK', value: true, primary: true }];
        actions.forEach(function (a) {
          var btn = el('button', {
            class: 'ui-dialog__btn' + (a.primary ? ' ui-dialog__btn--primary' : '') + (a.danger ? ' ui-dialog__btn--danger' : ''),
            type: 'button',
            text: a.label || 'OK'
          });
          btn.addEventListener('click', function () {
            safe(function () { a.onClick && a.onClick(); });
            closeDialog(a.value === undefined ? true : a.value);
          });
          footer.appendChild(btn);
        });

        panel.appendChild(head);
        panel.appendChild(body);
        panel.appendChild(footer);
        host.appendChild(backdrop);
        host.appendChild(panel);
        document.body.appendChild(host);

        // Prevent scroll on body while open
        var prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        openDialog = {
          host: host,
          resolve: function (v) {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', keyHandler, true);
            resolve(v);
          },
          prevFocus: document.activeElement
        };

        function keyHandler(e) {
          if (e.key === 'Escape' && opts.dismissable !== false) { closeDialog(null); e.stopPropagation(); }
          else if (e.key === 'Tab') { trapFocus(panel, e); }
        }
        document.addEventListener('keydown', keyHandler, true);

        if (opts.dismissable !== false) {
          backdrop.addEventListener('click', function () { closeDialog(null); });
        }

        // Focus primary or first button
        setTimeout(function () {
          var primary = panel.querySelector('.ui-dialog__btn--primary') || panel.querySelector('.ui-dialog__btn');
          if (primary) primary.focus();
        }, 30);
      });
    });
  }

  function confirmFn(title, body, opts) {
    opts = opts || {};
    return dialog({
      title: title || 'Confirm',
      body: body || 'Are you sure?',
      actions: [
        { label: opts.cancelLabel || 'Cancel', value: false },
        { label: opts.okLabel || 'OK', value: true, primary: true, danger: !!opts.danger }
      ]
    }).then(function (v) { return v === true; });
  }

  function alertFn(title, body) {
    return dialog({
      title: title || 'Notice',
      body: body || '',
      actions: [{ label: 'OK', value: true, primary: true }]
    }).then(function () { });
  }

  // Shortcuts
  function make(variant) {
    return function (title, body, opts) {
      var o = Object.assign({}, opts || {}, { title: title, body: body, variant: variant });
      return toast(o);
    };
  }

  window.UI = {
    toast: toast,
    dialog: dialog,
    confirm: confirmFn,
    alert: alertFn,
    info: make('info'),
    success: make('success'),
    warn: make('warn'),
    error: make('error')
  };

  // Global error safety net — never let an unhandled error kill the app silently
  window.addEventListener('error', function (e) {
    safe(function () {
      // Only notify on genuinely user-affecting errors (skip resource load noise)
      if (e && e.error && e.message && !/ResizeObserver|Script error/i.test(e.message)) {
        // Suppress by default — devs see it in console; user only sees UI break if any
        if (window.UI_DEBUG) UI.error('Something broke', e.message);
      }
    });
  });
  window.addEventListener('unhandledrejection', function (e) {
    safe(function () {
      if (window.UI_DEBUG) UI.error('Async error', String((e && e.reason && e.reason.message) || e.reason || 'unknown'));
    });
  });
})();

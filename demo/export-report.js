/**
 * export-report.js — Export current match report to PDF, or send via mailto.
 *
 * Both actions are 100% client-side and privacy-safe:
 *   • PDF is generated on-device via jsPDF (lazy-loaded).
 *   • Email uses `mailto:` — opens the user's default mail client so nothing
 *     leaves the device without their consent.
 *
 * Report content is read from the visible #report-content DOM (rendered by
 * app.js:initReports). We flatten headings, paragraphs, chips, and tables
 * into a printable structure; images/SVGs are skipped in v1 to keep the
 * output crisp and portable.
 */
(function () {
  'use strict';

  var JSPDF_URL = 'vendor-jspdf.js?v=30';
  var jspdfLoaded = false;
  var jspdfLoading = null;

  function loadJsPDF() {
    if (jspdfLoaded && window.jspdf) return Promise.resolve(window.jspdf);
    if (jspdfLoading) return jspdfLoading;
    jspdfLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = JSPDF_URL;
      s.async = true;
      s.onload = function () {
        jspdfLoaded = true;
        resolve(window.jspdf);
      };
      s.onerror = function () {
        jspdfLoading = null;
        reject(new Error('Failed to load jsPDF from ' + JSPDF_URL));
      };
      document.head.appendChild(s);
    });
    return jspdfLoading;
  }

  // Collect readable structure from the current report DOM
  function readReport() {
    var root = document.getElementById('report-content');
    if (!root) return null;
    var title = (document.querySelector('#tab-reports .tab-title')?.textContent || 'Match report').replace(/\s+/g, ' ').trim();
    var selected = document.getElementById('report-match-select');
    var selectedText = selected && selected.options[selected.selectedIndex] ? selected.options[selected.selectedIndex].textContent.trim() : '';

    var lines = [];
    // Walk direct children of report-content in order
    root.querySelectorAll('h1, h2, h3, h4, p, li, td, th, .chip, .stat-chip, .metric-value, .metric-label').forEach(function (el) {
      var txt = el.textContent.replace(/\s+/g, ' ').trim();
      if (!txt) return;
      var tag = el.tagName.toLowerCase();
      var kind = 'p';
      if (tag === 'h1') kind = 'h1';
      else if (tag === 'h2') kind = 'h2';
      else if (tag === 'h3' || tag === 'h4') kind = 'h3';
      else if (tag === 'li') kind = 'li';
      else if (el.classList.contains('metric-label')) kind = 'label';
      else if (el.classList.contains('metric-value')) kind = 'value';
      else if (el.classList.contains('chip') || el.classList.contains('stat-chip')) kind = 'chip';
      lines.push({ kind: kind, text: txt });
    });
    return { title: title, subtitle: selectedText, lines: lines };
  }

  function slug(s) {
    return (s || 'match-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }

  async function exportPdf() {
    var report = readReport();
    if (!report || !report.lines.length) {
      toast('No report loaded. Select a match first.', 'warning');
      return;
    }
    toast('Preparing PDF\u2026', 'info', 1200);
    try {
      var jspdf = await loadJsPDF();
      var { jsPDF } = jspdf;
      var doc = new jsPDF({ unit: 'pt', format: 'a4' });
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();
      var margin = 48;
      var y = margin;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(20, 20, 24);
      doc.text('MISTER \u2014 ' + report.title, margin, y);
      y += 24;

      if (report.subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 110);
        doc.text(report.subtitle, margin, y);
        y += 20;
      }

      // Timestamp
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 150);
      doc.text('Generated on-device \u00b7 ' + new Date().toLocaleString(), margin, y);
      y += 22;

      // Separator
      doc.setDrawColor(220, 220, 224);
      doc.line(margin, y, pageW - margin, y);
      y += 18;

      // Body
      for (var i = 0; i < report.lines.length; i++) {
        var l = report.lines[i];
        var text = l.text;

        // Style per kind
        var size = 11, weight = 'normal', color = [40, 40, 46], leading = 15, bulletPrefix = '';
        if (l.kind === 'h1')      { size = 16; weight = 'bold'; leading = 22; y += 6; }
        else if (l.kind === 'h2') { size = 14; weight = 'bold'; leading = 20; y += 4; }
        else if (l.kind === 'h3') { size = 12; weight = 'bold'; leading = 18; y += 2; }
        else if (l.kind === 'li') { bulletPrefix = '\u2022  '; }
        else if (l.kind === 'label') { size = 10; color = [110, 110, 120]; }
        else if (l.kind === 'value') { size = 13; weight = 'bold'; }
        else if (l.kind === 'chip')  { size = 10; color = [88, 100, 130]; }

        doc.setFont('helvetica', weight);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);

        var wrapped = doc.splitTextToSize(bulletPrefix + text, pageW - margin * 2);
        for (var j = 0; j < wrapped.length; j++) {
          if (y + leading > pageH - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(wrapped[j], margin, y);
          y += leading;
        }
        y += 2;
      }

      // Footer on last page
      var footerY = pageH - 28;
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 170);
      doc.text('MISTER \u00b7 on-device football coaching AI \u00b7 alexbelij.github.io/MISTER',
        pageW / 2, footerY, { align: 'center' });

      var filename = 'MISTER-' + slug(report.subtitle || report.title) + '.pdf';
      doc.save(filename);
      toast('PDF saved: ' + filename, 'success', 2200);
    } catch (err) {
      console.error('[export-pdf]', err);
      toast('PDF export failed: ' + (err.message || err), 'error');
    }
  }

  // Build the message body from a report + optional team + coach context.
  // Returns { subject, body, truncatedCount } so the caller can react to a
  // long report (we cap the mailto body at ~40 lines and offer the full
  // report via clipboard).
  function buildEmailContent(report) {
    var team = (window.MisterTeams && window.MisterTeams.getActive()) || null;
    var signingPub = (window.MisterSigning && window.MisterSigning.getPubkey && window.MisterSigning.getPubkey()) || null;
    var fingerprint = signingPub ? (signingPub.slice(0, 4) + ' ' + signingPub.slice(4, 8) + ' ' + signingPub.slice(8, 12) + ' ' + signingPub.slice(12, 16)).toUpperCase() : null;

    var subject = 'MISTER report \u2014 ' + (report.subtitle || report.title);
    if (team && team.name) subject += ' (' + team.name + ')';

    var header = [
      report.title,
      report.subtitle || '',
      ''
    ];
    if (team) {
      header.push('From: ' + team.name + (team.formation && team.formation !== '\u2014' ? ' \u00b7 ' + team.formation : '') + (team.coach ? ' \u00b7 ' + team.coach : ''));
    }
    header.push('Generated on-device by MISTER \u2014 ' + new Date().toLocaleString());
    header.push('View live: https://alexbelij.github.io/MISTER/#reports');
    header.push('');
    header.push('\u2014 Summary \u2014');
    header.push('');

    var body = header.slice();
    var count = 0;
    var LIMIT = 40;
    for (var i = 0; i < report.lines.length && count < LIMIT; i++) {
      var l = report.lines[i];
      var prefix = l.kind === 'h1' ? '\n# '
                : l.kind === 'h2' ? '\n## '
                : l.kind === 'h3' ? '\n### '
                : l.kind === 'li' ? '  \u2022 '
                : '';
      body.push(prefix + l.text);
      count++;
    }
    var truncatedCount = 0;
    if (report.lines.length > LIMIT) {
      truncatedCount = report.lines.length - LIMIT;
      body.push('');
      body.push('\u2026 (' + truncatedCount + ' more lines \u2014 open the live report or attach the PDF)');
    }

    if (fingerprint) {
      body.push('');
      body.push('---');
      body.push('Signed on device \u00b7 ed25519 \u00b7 ' + fingerprint);
      body.push('Any recipient can verify the signature in the MISTER app.');
    }

    return { subject: subject, body: body.join('\n'), truncatedCount: truncatedCount };
  }

  // Build a full plain-text version of the report for the clipboard fallback
  // — no line cap, includes signature.
  function buildFullText(report) {
    var out = buildEmailContent(report);
    var lines = [out.subject, ''];
    for (var i = 0; i < report.lines.length; i++) {
      var l = report.lines[i];
      var prefix = l.kind === 'h1' ? '\n# '
                : l.kind === 'h2' ? '\n## '
                : l.kind === 'h3' ? '\n### '
                : l.kind === 'li' ? '  \u2022 '
                : '';
      lines.push(prefix + l.text);
    }
    return lines.join('\n');
  }

  function openEmailComposer(report) {
    // Modal lets the user paste a To: / Cc: address before we assemble the
    // mailto: link. That saves a step in Gmail/Outlook (which otherwise
    // demand a recipient before enabling Send) and gives us a natural place
    // to surface the \u201cAlso download PDF\u201d shortcut and a clipboard
    // fallback for reports whose body exceeds the URL limit.
    var content = buildEmailContent(report);
    var mailtoLen = ('mailto:?subject=' + encodeURIComponent(content.subject) + '&body=' + encodeURIComponent(content.body)).length;
    var TOO_LONG = mailtoLen > 7500;

    var overlay = document.createElement('div');
    overlay.className = 'ts-modal-overlay';
    overlay.innerHTML =
      '<div class="ts-modal em-modal" role="dialog" aria-modal="true" aria-labelledby="em-title">' +
        '<div class="ts-modal-header">' +
          '<h3 id="em-title">Email this report</h3>' +
          '<button class="ts-modal-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ts-modal-body">' +
          '<label class="ts-field">' +
            '<span>To</span>' +
            '<input type="email" id="em-to" placeholder="coach@fc-alexandria.example" multiple />' +
          '</label>' +
          '<label class="ts-field">' +
            '<span>Cc <em class="em-optional">(optional)</em></span>' +
            '<input type="email" id="em-cc" placeholder="analyst@fc-alexandria.example" multiple />' +
          '</label>' +
          '<label class="ts-field">' +
            '<span>Subject</span>' +
            '<input type="text" id="em-subject" value="' + escapeAttr(content.subject) + '" />' +
          '</label>' +
          '<label class="ts-field">' +
            '<span>Message</span>' +
            '<textarea id="em-body" rows="9">' + escapeHtml(content.body) + '</textarea>' +
          '</label>' +
          '<div class="em-meta">' +
            '<span class="em-meta-item"><strong>' + report.lines.length + '</strong> lines in report</span>' +
            (content.truncatedCount ? '<span class="em-meta-item em-warn">' + content.truncatedCount + ' trimmed \u2014 attach the PDF for the full text</span>' : '') +
            (TOO_LONG ? '<span class="em-meta-item em-warn">Body is long \u2014 some clients cap the URL. Use \u201cCopy report\u201d as a backup.</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="ts-modal-footer em-footer">' +
          '<button class="ts-btn ts-btn-secondary" data-role="copy">Copy report</button>' +
          '<button class="ts-btn ts-btn-secondary" data-role="pdf">Download PDF too</button>' +
          '<button class="ts-btn ts-btn-primary" data-role="send">Open mail client</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var toEl = overlay.querySelector('#em-to');
    var ccEl = overlay.querySelector('#em-cc');
    var subjEl = overlay.querySelector('#em-subject');
    var bodyEl = overlay.querySelector('#em-body');

    // Remember last-used recipients across sessions.
    try {
      toEl.value = localStorage.getItem('mister:email:last-to') || '';
      ccEl.value = localStorage.getItem('mister:email:last-cc') || '';
    } catch (_) {}

    setTimeout(function () { toEl.focus(); }, 60);

    function close() {
      overlay.classList.add('is-closing');
      setTimeout(function () { overlay.remove(); }, 160);
    }

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.ts-modal-close').addEventListener('click', close);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    overlay.querySelector('[data-role="copy"]').addEventListener('click', function () {
      var text = buildFullText(report);
      copyToClipboard(text).then(function () {
        toast('Full report copied \u2014 paste it into your mail client.', 'success', 2600);
      }).catch(function () {
        toast('Clipboard blocked \u2014 select the message text and copy manually.', 'warning');
      });
    });

    overlay.querySelector('[data-role="pdf"]').addEventListener('click', function () {
      exportPdf();
    });

    overlay.querySelector('[data-role="send"]').addEventListener('click', function () {
      var to = (toEl.value || '').trim();
      var cc = (ccEl.value || '').trim();
      var subject = (subjEl.value || '').trim() || content.subject;
      var bodyStr = bodyEl.value || content.body;

      try {
        localStorage.setItem('mister:email:last-to', to);
        localStorage.setItem('mister:email:last-cc', cc);
      } catch (_) {}

      var qs = [];
      if (cc) qs.push('cc=' + encodeURIComponent(cc));
      qs.push('subject=' + encodeURIComponent(subject));
      qs.push('body=' + encodeURIComponent(bodyStr));
      var mailto = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@').replace(/%2C/g, ',') + '?' + qs.join('&');

      // Some clients (macOS Mail, Outlook web) start dropping the URL past
      // ~7\u2013\u00a08k. Preflight: if we\u2019re over the limit, warn instead of
      // silently truncating.
      if (mailto.length > 12000) {
        toast('Body is too long for a direct mailto: link \u2014 copy the report and paste instead.', 'warning', 4000);
        return;
      }

      try {
        // Attempt to open. Use a hidden anchor so Safari behaves like Chrome.
        var a = document.createElement('a');
        a.href = mailto;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); }, 200);
        toast('Opening mail client\u2026 tip: attach the PDF via \u201cDownload PDF too\u201d.', 'info', 3500);
        close();
      } catch (err) {
        toast('Could not open mail client. Use \u201cCopy report\u201d instead.', 'error');
      }
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        if (ok) resolve(); else reject();
      } catch (e) { reject(e); }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function exportEmail() {
    var report = readReport();
    if (!report || !report.lines.length) {
      toast('No report loaded. Select a match first.', 'warning');
      return;
    }
    openEmailComposer(report);
  }

  function toast(msg, level, dur) {
    if (window.UI && typeof window.UI.toast === 'function') {
      window.UI.toast(msg, { level: level || 'info', duration: dur || 2200 });
    } else {
      console.log('[toast:' + (level || 'info') + ']', msg);
    }
  }

  function wire() {
    var pdfBtn = document.getElementById('export-pdf-btn');
    var mailBtn = document.getElementById('email-report-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', function (e) { e.preventDefault(); exportPdf(); });
    if (mailBtn) mailBtn.addEventListener('click', function (e) { e.preventDefault(); exportEmail(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  window.ExportReport = { pdf: exportPdf, email: exportEmail };
})();

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

  function exportEmail() {
    var report = readReport();
    if (!report || !report.lines.length) {
      toast('No report loaded. Select a match first.', 'warning');
      return;
    }
    var subject = 'MISTER report \u2014 ' + (report.subtitle || report.title);
    var body = [
      report.title,
      report.subtitle || '',
      '',
      'Generated on-device by MISTER \u2014 ' + new Date().toLocaleString(),
      'View live: https://alexbelij.github.io/MISTER/#reports',
      '',
      '\u2014 Summary \u2014',
      ''
    ];
    // Take first ~40 meaningful lines to fit into a mailto URL
    var count = 0;
    for (var i = 0; i < report.lines.length && count < 40; i++) {
      var l = report.lines[i];
      var prefix = l.kind === 'h1' ? '\n# '
                : l.kind === 'h2' ? '\n## '
                : l.kind === 'h3' ? '\n### '
                : l.kind === 'li' ? '  \u2022 '
                : '';
      body.push(prefix + l.text);
      count++;
    }
    if (report.lines.length > 40) {
      body.push('');
      body.push('\u2026 (' + (report.lines.length - 40) + ' more lines \u2014 open the live report or attach the PDF)');
    }

    var mailto = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body.join('\n'));
    // Guard: some mail clients cap URLs at ~2000 chars
    if (mailto.length > 8000) {
      mailto = mailto.slice(0, 8000);
    }
    try {
      window.location.href = mailto;
      toast('Opening mail client\u2026 tip: attach the PDF you exported.', 'info', 3500);
    } catch (err) {
      toast('Could not open mail client. Copy the report manually.', 'error');
    }
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

// Catalog behaviour: search, filters, progress summary, continue link, reset, export, and import.
(function () {
  'use strict';
  var P = window.CurriculumProgress;
  document.addEventListener('DOMContentLoaded', function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
    var ids = rows.map(function (r) { return r.dataset.id; });
    var el = function (id) { return document.getElementById(id); };
    var names = { 'not-started': '', 'in-progress': 'In progress', complete: 'Complete' };

    function fmtHours(min) { return (Math.round(min / 6) / 10) + ' h'; }

    function refresh() {
      var done = 0, remaining = 0;
      rows.forEach(function (r) {
        var s = P.status(r.dataset.id);
        r.dataset.progress = s;
        r.querySelector('.row-status').textContent = names[s];
        if (s === 'complete') done++; else remaining += Number(r.dataset.minutes);
      });
      el('stat-percent').textContent = Math.round(done / rows.length * 100) + '%';
      el('stat-done').textContent = done + ' of ' + rows.length + ' items complete';
      el('stat-remaining').textContent = fmtHours(remaining);
      document.querySelectorAll('.domain').forEach(function (d) {
        var inDomain = d.querySelectorAll('.row'), c = 0;
        inDomain.forEach(function (r) { if (r.dataset.progress === 'complete') c++; });
        d.querySelector('.domain-progress').textContent = c + ' of ' + inDomain.length + ' complete';
      });
      var link = el('continue-link');
      var ready = rows.filter(function (r) { return r.dataset.gen === 'complete'; });
      var pick = ready.filter(function (r) { return r.dataset.id === P.get().lastVisited && r.dataset.progress !== 'complete'; })[0]
        || ready.filter(function (r) { return r.dataset.progress === 'in-progress'; })[0]
        || ready.filter(function (r) { return r.dataset.progress !== 'complete'; })[0];
      if (pick) {
        link.href = pick.querySelector('a').getAttribute('href');
        link.textContent = 'Continue: ' + pick.dataset.title;
        link.hidden = false;
      } else { link.hidden = true; }
    }

    function filter() {
      var terms = el('q').value.toLowerCase().split(/\s+/).filter(Boolean);
      var f = { domain: el('f-domain').value, level: el('f-level').value, lang: el('f-lang').value, status: el('f-status').value, gen: el('f-gen').value };
      var shown = 0;
      rows.forEach(function (r) {
        var hay = r.dataset.title.toLowerCase() + ' ' + r.dataset.keywords;
        var ok = terms.every(function (t) { return hay.indexOf(t) >= 0; })
          && (!f.domain || r.dataset.domain === f.domain)
          && (!f.level || r.dataset.level === f.level)
          && (!f.lang || r.dataset.langs.split(' ').indexOf(f.lang) >= 0)
          && (!f.status || r.dataset.progress === f.status)
          && (!f.gen || r.dataset.gen === f.gen);
        r.hidden = !ok;
        if (ok) shown++;
      });
      var active = terms.length || f.domain || f.level || f.lang || f.status || f.gen;
      document.querySelectorAll('.domain').forEach(function (d) {
        var any = d.querySelector('.row:not([hidden])');
        d.hidden = !any;
        if (active && any) d.open = true;
      });
      el('result-count').textContent = shown + ' of ' + rows.length + ' shown';
    }

    ['q', 'f-domain', 'f-level', 'f-lang', 'f-status', 'f-gen'].forEach(function (id) {
      el(id).addEventListener('input', filter);
    });

    el('reset-progress').addEventListener('click', function () {
      if (window.confirm('Reset all progress? This clears completion status for every topic and cannot be undone unless you exported it.')) {
        P.resetAll(); refresh(); filter(); el('io-status').textContent = 'Progress reset.';
      }
    });
    el('export-progress').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([P.exportJson()], { type: 'application/json' }));
      a.download = 'system-design-progress.json';
      a.click();
      URL.revokeObjectURL(a.href);
      el('io-status').textContent = 'Progress exported.';
    });
    el('import-progress').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      file.text().then(function (text) {
        var r = P.importJson(text, ids);
        refresh(); filter();
        el('io-status').textContent = 'Imported ' + r.imported + ' entries; skipped ' + r.skipped + '.';
      }).catch(function (err) { el('io-status').textContent = 'Import failed: ' + err.message; });
      e.target.value = '';
    });

    refresh(); filter();
  });
})();

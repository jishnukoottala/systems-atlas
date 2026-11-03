// Progressive enhancement shared by all pages: theme switcher, copy buttons, quizzes, and
// topic progress controls. All content stays readable without this file.
(function () {
  'use strict';
  var P = window.CurriculumProgress;

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    document.dispatchEvent(new CustomEvent('curriculum:theme'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    var select = document.getElementById('theme-select');
    if (select) {
      select.value = P.get().theme || 'system';
      select.addEventListener('change', function () { P.setTheme(select.value); applyTheme(select.value); });
    }

    document.querySelectorAll('pre.code').forEach(function (pre) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'copy-button'; b.textContent = 'Copy';
      b.setAttribute('aria-label', 'Copy code to clipboard');
      b.addEventListener('click', function () {
        var done = function (msg) { b.textContent = msg; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
        navigator.clipboard.writeText(pre.innerText.replace(/^Copy\n?/, '')).then(function () { done('Copied'); }, function () { done('Copy failed'); });
      });
      b.setAttribute('aria-live', 'polite');
      pre.appendChild(b);
    });

    document.querySelectorAll('form.quiz').forEach(function (form) {
      var correct = form.dataset.correct;
      var feedback = form.querySelector('.quiz-feedback');
      form.addEventListener('submit', function (e) { e.preventDefault(); });
      form.addEventListener('change', function (e) {
        feedback.textContent = e.target.value === correct ? 'Correct.' : 'Not quite. Read the explanation below.';
        form.querySelector('details').open = true;
      });
    });

    var id = document.body.dataset.topicId;
    if (id) {
      P.visit(id);
      var label = document.getElementById('topic-status');
      var names = { 'not-started': 'Not started', 'in-progress': 'In progress', complete: 'Complete' };
      var render = function () { if (label) label.textContent = 'Status: ' + names[P.status(id)]; };
      document.querySelectorAll('[data-set-status]').forEach(function (btn) {
        btn.addEventListener('click', function () { P.setStatus(id, btn.dataset.setStatus); render(); });
      });
      render();
    }

    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('details').forEach(function (d) { d.open = true; });
    });
  });
})();

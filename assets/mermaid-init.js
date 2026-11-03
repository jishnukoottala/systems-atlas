// Renders diagrams with the locally pinned Mermaid build and re-renders when the theme changes.
// Without JavaScript, the Mermaid source and written text alternative remain visible.
(function () {
  'use strict';
  function isDark() {
    var forced = document.documentElement.dataset.theme;
    if (forced) return forced === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function render() {
    var nodes = document.querySelectorAll('pre.mermaid');
    nodes.forEach(function (n) {
      if (!n.dataset.source) n.dataset.source = n.textContent;
      n.removeAttribute('data-processed');
      n.textContent = n.dataset.source;
    });
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'neutral' });
    window.mermaid.run({ nodes: nodes, suppressErrors: true });
  }
  document.addEventListener('DOMContentLoaded', render);
  document.addEventListener('curriculum:theme', render);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
})();

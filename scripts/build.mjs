#!/usr/bin/env node
// Regenerates every page from the manifest and authored content. Reading the site needs no build;
// this runs only when content or the manifest changes.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc } from './lib/markdown.mjs';
import { page, SITE_TITLE, SITE_TAGLINE } from './lib/layout.mjs';
import { loadManifest, renderEntry, writeEntry } from './lib/render.mjs';

const m = loadManifest();
const fmtH = (min) => `${Math.round(min / 6) / 10} h`;
const titleLink = (t, base) => (t.status === 'complete' ? `<a href="${base}${t.pagePath}">${esc(t.title)}</a>` : `<span class="pending-title">${esc(t.title)}</span>`);
const LEVELS = ['Foundational', 'Intermediate', 'Advanced', 'Principal'];

function row(t, base) {
  return `<li class="row" data-id="${t.id}" data-title="${esc(t.title)}" data-domain="${t.domain}" data-level="${t.level}" data-langs="${t.requiredLanguages.join(' ')}" data-minutes="${t.studyMinutes}" data-gen="${t.status === 'complete' ? 'complete' : 'pending'}" data-keywords="${esc(t.keywords.join(' '))}">`
    + `<span>${titleLink(t, base)}</span><span class="meta">${t.status === 'complete' ? '' : 'Not yet written · '}${t.level} · ${fmtH(t.studyMinutes)}</span><span class="row-status"></span></li>`;
}

function domainGroup(code, name, items, open) {
  const written = items.filter((t) => t.status === 'complete').length;
  return `<details class="domain"${open ? ' open' : ''}><summary><span>${code === 'S' ? '' : `${code}. `}${esc(name)}</span><span class="domain-meta">${items.length} items · ${written} written<span class="js-only"> · <span class="domain-progress"></span></span></span></summary><ul class="rows">${items.map((t) => row(t, '')).join('')}</ul></details>`;
}

function buildIndex() {
  const written = m.topics.filter((t) => t.status === 'complete').length;
  const sysWritten = m.systems.filter((t) => t.status === 'complete').length;
  const patternsLink = m.patterns.status === 'complete' ? `<a href="${m.patterns.pagePath}">Cross-cutting patterns</a>` : 'Cross-cutting patterns (not yet written)';
  const opts = (pairs) => pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  const body = `<main class="wrap" id="main">
<h1>${SITE_TITLE}</h1>
<p class="tagline">${SITE_TAGLINE}.</p>
<p class="lede">From foundational mental models to principal-level architectural judgment, for senior, staff, and principal engineers. ${m.topics.length} topics and ${m.systems.length} system dissections, each with mechanisms, capacity math, failure analysis, runnable examples, and interview preparation.</p>
<p class="muted">Written and validated so far: ${written} of ${m.topics.length} topics, ${sysWritten} of ${m.systems.length} system dissections. Items without a link are planned and not yet written.</p>
<div class="summary js-only" aria-label="Your progress">
<div class="stat"><b id="stat-percent">0%</b><span id="stat-done">Overall completion</span></div>
<div class="stat"><b id="stat-remaining">0 h</b><span>Estimated study time remaining</span></div>
</div>
<div class="actions js-only">
<a class="button" id="continue-link" hidden href="index.html">Continue</a>
<button type="button" id="export-progress">Export progress</button>
<label class="button">Import progress <input type="file" id="import-progress" accept="application/json" class="visually-hidden" aria-label="Import progress JSON file"></label>
<button type="button" id="reset-progress">Reset progress</button>
<span id="io-status" class="muted" role="status" aria-live="polite"></span>
</div>
<form class="filters js-only" role="search" onsubmit="return false">
<label>Search titles and keywords<input type="search" id="q" autocomplete="off"></label>
<label>Domain<select id="f-domain"><option value="">All</option>${opts([...Object.entries(m.domains).map(([k, v]) => [k, `${k}. ${v}`]), ['S', 'Systems dissected']])}</select></label>
<label>Level<select id="f-level"><option value="">All</option>${opts(LEVELS.map((l) => [l, l]))}</select></label>
<label>Language<select id="f-lang"><option value="">All</option>${opts([['typescript', 'TypeScript'], ['python', 'Python'], ['go', 'Go'], ['rust', 'Rust']])}</select></label>
<label>Your progress<select id="f-status"><option value="">All</option>${opts([['not-started', 'Not started'], ['in-progress', 'In progress'], ['complete', 'Complete']])}</select></label>
<label>Content<select id="f-gen"><option value="">All</option>${opts([['complete', 'Written'], ['pending', 'Not yet written']])}</select></label>
</form>
<p id="result-count" class="muted js-only" role="status" aria-live="polite"></p>
${Object.entries(m.domains).map(([k, v], i) => domainGroup(k, v, m.topics.filter((t) => t.domain === k), i === 0)).join('\n')}
${domainGroup('S', 'Systems dissected', m.systems, false)}
<p>${patternsLink} · <a href="systems-dissect/index.html">All system dissections</a> · <a href="traceability.html">Traceability matrix</a></p>
</main>`;
  writeFileSync('index.html', page({ base: '', title: SITE_TITLE, description: `${SITE_TAGLINE}.`, body, scripts: ['search.js'] }));
}

function buildSystemsIndex() {
  mkdirSync('systems-dissect', { recursive: true });
  const items = m.systems.map((s) => `<li class="row"><span>${titleLink(s, '../')}</span><span class="meta">${s.status === 'complete' ? '' : 'Not yet written · '}${s.id}</span></li>`).join('');
  const patterns = m.patterns.status === 'complete'
    ? `<a href="patterns/index.html">Cross-cutting patterns</a>`
    : `Cross-cutting patterns (not yet written)`;
  const body = `<main class="wrap" id="main"><h1>System dissections</h1>
<p class="lede">Interview-style designs for ${m.systems.length} classes of system. Company names describe an educational class of system. Each page separates publicly documented facts, reasonable architectural inference, and hypothetical educational design, and none claims to reproduce a private architecture.</p>
<p>${patterns} covers ${esc(m.patterns.items.join(', ').toLowerCase())}.</p>
<ul class="rows">${items}</ul></main>`;
  writeFileSync('systems-dissect/index.html', page({ base: '../', title: `System dissections | ${SITE_TITLE}`, description: 'Interview-style system dissections.', body }));
}

function buildTraceability() {
  const status = (t) => (t.status === 'complete' ? 'Written and validated' : 'Planned, not yet written');
  const pageCell = (t) => (t.status === 'complete' ? `<a href="${t.pagePath}">${esc(t.slug)}</a>` : `<code>${esc(t.pagePath)}</code>`);
  const titleOf = (id) => m.topics.find((t) => t.id === id)?.title ?? id;
  const originals = m.topics.filter((t) => t.originalTopicNumber).sort((a, b) => a.originalTopicNumber - b.originalTopicNumber);
  const additional = m.topics.filter((t) => t.additionalTopicNumber).sort((a, b) => a.additionalTopicNumber - b.additionalTopicNumber);
  const relatedA = (t) => esc(t.relatedTopics.filter((r) => r.startsWith('A')).map(titleOf).join('; ')) || 'None';
  const body = `<main class="wrap" id="main"><h1>Traceability</h1>
<p class="lede">Every required item and where it lives. Each original topic has its own canonical page, because none of the 111 originals is an exact duplicate of an additional topic. Closely related topics are cross-linked instead of merged.</p>
<h2 id="original">Original topics (${originals.length})</h2>
<div class="table-wrap"><table><thead><tr><th scope="col">No.</th><th scope="col">Original title</th><th scope="col">Canonical ID</th><th scope="col">Canonical title</th><th scope="col">Page</th><th scope="col">Coverage</th><th scope="col">Related additional topics</th></tr></thead><tbody>
${originals.map((t) => `<tr><td>${t.originalTopicNumber}</td><td>${esc(t.title)}</td><td>${t.id}</td><td>${esc(t.title)}</td><td>${pageCell(t)}</td><td>${status(t)}</td><td>${relatedA(t)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2 id="additional">Additional topics (${additional.length})</h2>
<div class="table-wrap"><table><thead><tr><th scope="col">No.</th><th scope="col">Title</th><th scope="col">ID</th><th scope="col">Domain</th><th scope="col">Page</th><th scope="col">Coverage</th></tr></thead><tbody>
${additional.map((t) => `<tr><td>${t.additionalTopicNumber}</td><td>${esc(t.title)}</td><td>${t.id}</td><td>${t.domain}</td><td>${pageCell(t)}</td><td>${status(t)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2 id="systems">System dissections (${m.systems.length})</h2>
<div class="table-wrap"><table><thead><tr><th scope="col">ID</th><th scope="col">Title</th><th scope="col">Page</th><th scope="col">Coverage</th></tr></thead><tbody>
${m.systems.map((t) => `<tr><td>${t.id}</td><td>${esc(t.title)}</td><td>${pageCell(t)}</td><td>${status(t)}</td></tr>`).join('\n')}
</tbody></table></div></main>`;
  writeFileSync('traceability.html', page({ base: '', title: `Traceability | ${SITE_TITLE}`, description: 'Coverage of every required topic and system.', body }));
}

function build404() {
  writeFileSync('404.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | ${SITE_TITLE}</title>
<style>:root{color-scheme:light dark}body{font:16px/1.6 system-ui,sans-serif;max-width:60ch;margin:3rem auto;padding:0 16px}</style></head>
<body><main><h1>Page not found</h1><p>This page does not exist, or it has not been written yet.</p><p><a id="home" href="index.html">Return to the curriculum</a></p></main>
<script>var p=location.pathname,i=Math.max(p.indexOf('/topics/'),p.indexOf('/systems-dissect/'));if(i>=0)document.getElementById('home').href=p.slice(0,i+1)+'index.html';</script>
</body></html>
`);
}

const rendered = [];
for (const [list, base] of [[m.topics, '../../'], [m.systems, '../../']]) {
  for (const e of list) {
    if (existsSync(join(e.pagePath.replace(/index\.html$/, ''), 'content.md'))) {
      const r = renderEntry(e, m, base);
      writeEntry(r, m, base);
      rendered.push(e.id);
    }
  }
}
buildIndex();
buildSystemsIndex();
buildTraceability();
build404();
console.log(`built site shell and ${rendered.length} authored pages`);

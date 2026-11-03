// Renders authored content.md files into pages, READMEs, diagram sources, and exercises.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc, inline, newContext, renderBlocks, slugId } from './markdown.mjs';
import { page, SITE_TITLE } from './layout.mjs';
import { TOPIC_SECTIONS, SYSTEM_SECTIONS } from './contract.mjs';

export const loadManifest = () => JSON.parse(readFileSync('curriculum-manifest.json', 'utf8'));
export const loadState = () => JSON.parse(readFileSync('generation-state.json', 'utf8'));
export const saveJson = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
const stableOf = (short) => short[0].toUpperCase() + short.slice(1).padStart(3, '0');
const hours = (min) => (min >= 60 ? `${Math.round(min / 6) / 10} hours` : `${min} minutes`);

const LANG_SOURCES = {
  typescript: ['TypeScript', 'src/index.ts', 'typescript'],
  python: ['Python', 'app/main.py', 'python'],
  go: ['Go', 'main.go', 'go'],
  rust: ['Rust', 'src/main.rs', 'rust'],
};

export function renderEntry(entry, manifest, base) {
  const byId = new Map([...manifest.topics, ...manifest.systems].map((t) => [t.id, t]));
  const dir = entry.pagePath.replace(/index\.html$/, '');
  const xrefEntry = (t) => (t.status === 'complete' ? `<a href="${base}${t.pagePath}">${esc(t.title)}</a>` : `${esc(t.title)} <span class="muted">(not yet written)</span>`);
  const ctx = newContext((short) => xrefEntry(byId.get(stableOf(short))));
  const raw = readFileSync(join(dir, 'content.md'), 'utf8');
  const lines = raw.split('\n');
  const lastReviewed = (lines[0].match(/^lastReviewed: (.+)$/) || [])[1] ?? '';
  const parts = lines.slice(1).join('\n').split(/^(?=## )/m).filter((p) => p.trim());
  const sections = parts.map((p) => {
    const nl = p.indexOf('\n');
    const title = p.slice(3, nl).trim();
    const id = slugId(title);
    let html = renderBlocks(p, ctx);
    if (title === 'Orientation') html = html.replace(/(<h3 id="learning-objectives">)/, `${metaBlock(entry, byId, xrefEntry)}$1`);
    if (title === 'Implementation') html += sourceListing(entry, dir);
    if (title === 'Industry standards and trends') html += `<p class="muted">Links in this section were checked on ${esc(lastReviewed)} (access date). Items labelled as emerging or inferred are not settled facts and should be re-checked before you rely on them.</p>`;
    return { title, id, html };
  });
  return { entry, ctx, raw, sections, lastReviewed, dir };
}

function metaBlock(entry, byId, xrefEntry) {
  const list = (ids) => (ids.length ? ids.map((i) => xrefEntry(byId.get(i))).join(', ') : 'None');
  return `<h3 id="prerequisites">Prerequisites</h3><p>${list(entry.prerequisites)}</p>`
    + `<h3 id="study-time">Study time</h3><p>About ${hours(entry.studyMinutes)}, including the terminal lab and challenges. This is an estimate.</p>`
    + `<h3 id="related-topics">Related topics</h3><p>${list(entry.relatedTopics)}</p>`;
}

function sourceListing(entry, dir) {
  const items = entry.requiredLanguages.map((lang) => {
    const [label, file, cls] = LANG_SOURCES[lang];
    const path = join(dir, 'examples', lang, file);
    if (!existsSync(path)) return '';
    return `<details class="disclosure"><summary>${label} source: <code>examples/${lang}/${file}</code></summary>`
      + `<p><a href="examples/${lang}/README.md">Setup and run instructions</a></p>`
      + `<pre class="code"><code class="language-${cls}">${esc(readFileSync(path, 'utf8'))}</code></pre></details>`;
  }).join('');
  return `<h3 id="example-source">Example source</h3>${items}`;
}

export function writeEntry(r, manifest, base) {
  const { entry, sections, dir, ctx } = r;
  const ordered = entry.domain === 'S' ? manifest.systems : manifest.topics;
  const ready = ordered.filter((t) => t.status === 'complete' || t.id === entry.id);
  const pos = ready.findIndex((t) => t.id === entry.id);
  const prev = ready[pos - 1];
  const next = ready[pos + 1];
  const toc = sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('');
  const body = `<div class="topic-layout" id="top">
<nav class="toc" aria-label="On this page"><details open><summary>On this page</summary><ol>${toc}<li><a href="#progress">Progress</a></li></ol></details></nav>
<main class="topic-main" id="main">
<p class="breadcrumb"><a href="${base}index.html">Curriculum</a> / ${esc(entry.domainName)}</p>
<h1>${esc(entry.title)}</h1>
<p class="meta-line">${esc(entry.id)} · ${esc(entry.level)} · about ${hours(entry.studyMinutes)} · Last reviewed ${esc(r.lastReviewed)}</p>
${sections.map((s) => `<section aria-labelledby="${s.id}">${s.html}</section>`).join('\n')}
<section aria-labelledby="progress"><h2 id="progress">Progress</h2>
<div class="progress-controls js-only"><span id="topic-status" role="status" aria-live="polite"></span>
<button type="button" data-set-status="in-progress">Mark in progress</button>
<button type="button" data-set-status="complete">Mark complete</button>
<button type="button" data-set-status="not-started">Reset progress</button></div>
<p class="muted">Progress is stored only in this browser. Export it from the <a href="${base}index.html">curriculum page</a>.</p>
<nav class="pager" aria-label="Previous and next">
<span>${prev ? `Previous: <a href="${base}${prev.pagePath}">${esc(prev.title)}</a>` : ''}</span>
<a href="${base}index.html">Return to curriculum</a>
<span>${next ? `Next: <a href="${base}${next.pagePath}">${esc(next.title)}</a>` : ''}</span>
</nav></section>
</main></div>`;
  const definition = (r.raw.match(/### Definition\n+([^\n]+)/) || [])[1] ?? entry.title;
  const clean = definition.replace(/\[\[[^\]]+\]\]/g, 'a related topic').replace(/[`*]/g, '');
  writeFileSync(join(dir, 'index.html'), page({
    base, title: `${entry.title} | ${SITE_TITLE}`, description: clean.slice(0, 160),
    body, bodyAttrs: `data-topic-id="${entry.id}"`, mermaid: ctx.diagrams.length > 0,
  }));
  mkdirSync(join(dir, 'diagrams'), { recursive: true });
  for (const d of ctx.diagrams) writeFileSync(join(dir, 'diagrams', `${d.name}.mmd`), `---\ntitle: ${JSON.stringify(d.title)}\n---\n${d.source}\n`);
  const diagramLines = ctx.diagrams.map((d) => `- [${d.title}](diagrams/${d.name}.mmd)`).join('\n');
  const langs = entry.requiredLanguages.map((l) => `- [${LANG_SOURCES[l][0]} example](examples/${l}/README.md)`).join('\n');
  const isTopic = entry.domain !== 'S';
  writeFileSync(join(dir, 'README.md'), `# ${entry.title}\n\n${clean}\n\n- ID: ${entry.id}\n- Domain: ${entry.domainName}\n- Level: ${entry.level}\n- Last reviewed: ${r.lastReviewed}\n\nRead the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).\n\n## Diagrams\n\n${diagramLines}\n\n## Examples\n\n${langs}\n${isTopic ? '\n## Exercises\n\n- [Challenges](exercises/challenges.md)\n- [Solutions](exercises/solutions.md)\n' : ''}`);
  if (isTopic && ctx.challenges.length) {
    mkdirSync(join(dir, 'exercises'), { recursive: true });
    const stripXref = (s) => s.replace(/\[\[([oa]\d+)\]\]/g, (_, id) => {
      const t = manifest.topics.find((x) => x.id === stableOf(id));
      return t ? t.title : id;
    });
    writeFileSync(join(dir, 'exercises', 'challenges.md'), stripXref(`# Challenges: ${entry.title}\n\n${ctx.challenges.map((c) => `## ${c.type[0].toUpperCase()}${c.type.slice(1)}: ${c.title}\n\n${c.prompt}\n\n**Hint.** ${c.hint}\n`).join('\n')}`));
    writeFileSync(join(dir, 'exercises', 'solutions.md'), stripXref(`# Solutions: ${entry.title}\n\n${ctx.challenges.map((c) => `## ${c.type[0].toUpperCase()}${c.type.slice(1)}: ${c.title}\n\n${c.solution}\n\n**Common mistakes.** ${c['common mistakes']}\n`).join('\n')}`));
  }
}

export { TOPIC_SECTIONS, SYSTEM_SECTIONS, inline };

#!/usr/bin/env node
// Validates authored entries and marks them complete only if everything passes.
// Usage: finish-batch.mjs ID [ID...]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkEntry, validateManifest } from './validate-manifest.mjs';
import { checkExternal, validateLinks } from './validate-links.mjs';
import { runExamples } from './validate-examples.mjs';
import { loadManifest, loadState, saveJson } from './lib/render.mjs';

const ids = process.argv.slice(2);
const build = () => spawnSync('node', ['scripts/build.mjs'], { stdio: 'inherit' });
build();
const m = loadManifest();
const state = loadState();
const today = new Date().toISOString().slice(0, 10);
const doneBefore = [...m.topics, ...m.systems].filter((x) => x.status === 'complete').length;
const batch = Math.floor(doneBefore / state.batchSize) + 1;
let okAll = true;

for (const id of ids) {
  const e = [...m.topics, ...m.systems].find((x) => x.id === id);
  if (!e) { console.error(`ERROR unknown ID: ${id}`); okAll = false; continue; }
  const errors = checkEntry(e, m);
  const dir = e.pagePath.replace(/index\.html$/, '');
  const content = readFileSync(`${dir}content.md`, 'utf8');
  const sources = [...content.matchAll(/\]\((https?:[^)\s]+)\)/g)].map((x) => x[1]);
  if (e.domain !== 'S' && sources.length < 3) errors.push(`${id}: needs at least 3 primary-source links, has ${sources.length}`);
  const blocked = [];
  errors.push(...(await checkExternal(new Set(sources), blocked)).map((x) => `${id}: source ${x}`));
  for (const url of blocked) {
    const claim = `${id}: ${url} refused the automated link check; confirm it manually`;
    if (!state.claimsRequiringVerification.includes(claim)) state.claimsRequiringVerification.push(claim);
  }
  const examples = runExamples(e);
  for (const [lang, out] of Object.entries(examples)) if (out.startsWith('failed')) errors.push(`${id}: ${lang} ${out}`);
  state.items[id] = { status: errors.length ? 'generating' : 'complete', batch, examples, sourcesChecked: today, title: e.title };
  if (errors.length) { okAll = false; errors.forEach((x) => console.error(`ERROR ${x}`)); }
  else { e.status = 'complete'; console.log(`complete: ${id} ${e.title}`, examples); }
}
saveJson('curriculum-manifest.json', m);
build();
const links = validateLinks();
const manifest = validateManifest();
[...links.errors, ...manifest.errors].forEach((x) => { console.error(`ERROR ${x}`); okAll = false; });
const doneNow = [...m.topics, ...m.systems].filter((x) => x.status === 'complete').length;
state.batchesCompleted = Math.floor(doneNow / state.batchSize);
const pending = [...m.topics, ...m.systems].filter((x) => x.status !== 'complete');
state.phase = pending.some((x) => x.domain !== 'S') ? 2 : pending.length ? 3 : 4;
state.nextItems = pending.slice(0, state.batchSize).map((x) => x.id);
state.updatedAt = new Date().toISOString();
saveJson('generation-state.json', state);
console.log(manifest.counts, `next: ${state.nextItems.join(', ')}`);
console.log(okAll ? 'batch passed' : 'batch FAILED');
process.exit(okAll ? 0 : 1);

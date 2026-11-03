#!/usr/bin/env node
// Coverage, traceability, duplicate, required-file, and content-contract validation.
// Usage: validate-manifest.mjs [--final]   --final also fails while any item is unwritten.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkContent } from './lib/contract.mjs';
import { buildTopics, SYSTEMS, stableId } from './lib/catalog.mjs';
import { loadManifest, renderEntry } from './lib/render.mjs';

export function validateManifest({ final = false } = {}) {
  const m = loadManifest();
  const errors = [];
  const all = [...m.topics, ...m.systems];
  const dup = (key) => { const seen = new Set(); for (const e of all) { if (seen.has(e[key])) errors.push(`duplicate ${key}: ${e[key]}`); seen.add(e[key]); } };
  dup('id'); dup('pagePath');

  const nums = m.topics.map((t) => t.originalTopicNumber).filter(Boolean).sort((a, b) => a - b);
  if (nums.length !== 111 || nums.some((n, i) => n !== i + 1)) errors.push('original topic numbers are not exactly 1 through 111');
  const addl = m.topics.map((t) => t.additionalTopicNumber).filter(Boolean).sort((a, b) => a - b);
  if (addl.length !== 215 || addl.some((n, i) => n !== i + 1)) errors.push('additional topic numbers are not exactly 1 through 215');
  if (m.systems.length !== SYSTEMS.length) errors.push('system count differs from the catalog');
  if (m.patterns.items.length !== 12) errors.push('patterns page must cover 12 patterns');

  const catalog = new Map(buildTopics().map((t) => [stableId(t.short), t]));
  const ids = new Set(all.map((e) => e.id));
  const fields = ['id', 'title', 'slug', 'domain', 'level', 'prerequisites', 'studyMinutes', 'relatedTopics', 'requiredLanguages', 'status', 'pagePath'];
  for (const e of all) {
    for (const f of fields) if (e[f] === undefined) errors.push(`${e.id}: missing field ${f}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) errors.push(`${e.id}: slug is not kebab-case`);
    for (const r of [...e.prerequisites, ...e.relatedTopics]) if (!ids.has(r)) errors.push(`${e.id}: unknown reference ${r}`);
    if (e.domain !== 'S' && catalog.get(e.id)?.title !== e.title) errors.push(`${e.id}: title differs from the catalog`);
  }

  const counts = { topicsComplete: 0, topicsRemaining: 0, systemsComplete: 0, systemsRemaining: 0 };
  for (const e of all) {
    const isTopic = e.domain !== 'S';
    if (e.status !== 'complete') {
      counts[isTopic ? 'topicsRemaining' : 'systemsRemaining']++;
      if (final) errors.push(`${e.id}: not complete (${e.status})`);
      continue;
    }
    counts[isTopic ? 'topicsComplete' : 'systemsComplete']++;
    errors.push(...checkEntry(e, m));
  }
  if (final && m.patterns.status !== 'complete') errors.push('patterns page is not complete');
  return { errors, counts };
}

export function checkEntry(e, m) {
  const errors = [];
  const dir = e.pagePath.replace(/index\.html$/, '');
  const isTopic = e.domain !== 'S';
  if (!existsSync(join(dir, 'content.md'))) return [`${e.id}: no content.md`];
  const r = renderEntry(e, m, '../../');
  for (const x of checkContent(isTopic ? 'topic' : 'system', r)) errors.push(`${e.id}: ${x}`);
  const required = ['index.html', 'README.md', 'diagrams/context.mmd', 'diagrams/sequence.mmd', 'diagrams/failure-path.mmd'];
  if (isTopic) required.push('exercises/challenges.md', 'exercises/solutions.md');
  const LANG = { typescript: ['package.json', 'tsconfig.json', 'src/index.ts', 'README.md'], python: ['pyproject.toml', 'app/main.py', 'README.md'], go: ['go.mod', 'main.go', 'README.md'], rust: ['Cargo.toml', 'src/main.rs', 'README.md'] };
  for (const l of e.requiredLanguages) for (const f of LANG[l]) required.push(`examples/${l}/${f}`);
  for (const f of required) if (!existsSync(join(dir, f))) errors.push(`${e.id}: missing ${f}`);
  if (isTopic && existsSync(join(dir, 'index.html')) && !readFileSync(join(dir, 'index.html'), 'utf8').includes(`data-topic-id="${e.id}"`)) errors.push(`${e.id}: page lacks progress binding`);
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, counts } = validateManifest({ final: process.argv.includes('--final') });
  console.log(counts);
  errors.forEach((e) => console.error(`ERROR ${e}`));
  console.log(errors.length ? `manifest validation FAILED: ${errors.length} errors` : 'manifest validation passed');
  process.exit(errors.length ? 1 : 0);
}

#!/usr/bin/env node
// Internal links and anchors, root-relative paths, HTML structure, and placeholder detection.
// Usage: validate-links.mjs [--external]   --external also fetches links in authored sources.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { PLACEHOLDER_RE } from './lib/contract.mjs';

const SKIP = new Set(['node_modules', '.venv', 'target', '.git', '.claude', 'assets']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}
const TAG = /<(a|link|script|img)\b[^>]*?\b(href|src)="([^"]*)"/g;
const idsOf = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

export function validateLinks() {
  const errors = [];
  const files = walk('.');
  const cache = new Map();
  const load = (f) => { if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8')); return cache.get(f); };
  for (const file of files) {
    const html = load(file);
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
    const hit = text.match(PLACEHOLDER_RE);
    if (hit) errors.push(`${file}: placeholder text "${hit[0]}"`);
    if (!/^<!doctype html>/i.test(html)) errors.push(`${file}: missing doctype`);
    if (!/<html lang="/.test(html)) errors.push(`${file}: missing lang`);
    if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${file}: missing title`);
    if (!/<meta name="viewport"/.test(html)) errors.push(`${file}: missing viewport`);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${file}: must have exactly one h1`);
    if (!/<main\b/.test(html)) errors.push(`${file}: missing main landmark`);
    if (file !== '404.html' && !html.includes('class="skip-link"')) errors.push(`${file}: missing skip link`);
    const seen = new Set();
    for (const m of html.matchAll(/\bid="([^"]+)"/g)) { if (seen.has(m[1])) errors.push(`${file}: duplicate id "${m[1]}"`); seen.add(m[1]); }
    for (const m of html.matchAll(TAG)) {
      const url = m[3];
      if (/^(https?:|mailto:|data:)/.test(url)) continue;
      if (url.startsWith('/')) { errors.push(`${file}: root-relative link ${url}`); continue; }
      const [path, anchor] = url.split('#');
      const target = path ? normalize(join(dirname(file), path)) : file;
      if (!existsSync(target)) { errors.push(`${file}: broken link ${url}`); continue; }
      if (anchor && target.endsWith('.html') && !idsOf(load(target)).has(anchor)) errors.push(`${file}: missing anchor ${url}`);
    }
  }
  return { errors, files: files.length };
}

// Sites that refuse automated clients (401, 403, 429) are neither confirmed nor broken, so they
// go to `blocked` for manual verification rather than failing validation.
export async function checkExternal(urls, blocked = []) {
  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 curriculum-link-check' } });
      if ([401, 403, 429].includes(res.status)) blocked.push(url);
      else if (res.status >= 400) errors.push(`${url}: HTTP ${res.status}`);
    } catch (err) { errors.push(`${url}: ${err.cause?.code ?? err.message}`); }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, files } = validateLinks();
  if (process.argv.includes('--external')) {
    const urls = new Set();
    for (const f of walk('.')) for (const m of readFileSync(f, 'utf8').matchAll(/<a href="(https?:[^"]+)"/g)) urls.add(m[1]);
    errors.push(...await checkExternal(urls));
  }
  errors.forEach((e) => console.error(`ERROR ${e}`));
  console.log(errors.length ? `link validation FAILED: ${errors.length} errors in ${files} pages` : `link validation passed for ${files} pages`);
  process.exit(errors.length ? 1 : 0);
}

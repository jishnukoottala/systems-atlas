#!/usr/bin/env node
// Type-checks and runs tests for examples with whatever toolchains are installed. A missing
// toolchain is reported as not-executed, never as passed.
// Usage: validate-examples.mjs [IDs...]   Defaults to every complete topic and system.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifest, loadState, saveJson } from './lib/render.mjs';

const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;
const PLANS = {
  typescript: { tool: 'pnpm', cmds: ['pnpm install --silent --ignore-workspace', 'pnpm run --silent check', 'pnpm run --silent test'] },
  python: { tool: 'uv', cmds: ['uv run --quiet pytest -q'] },
  go: { tool: 'go', cmds: ['go vet ./...', 'go test -race ./...'] },
  rust: { tool: 'cargo', cmds: ['cargo clippy --quiet -- -D warnings', 'cargo test --quiet'] },
};

export function runExamples(entry) {
  const results = {};
  const root = entry.pagePath.replace(/index\.html$/, '');
  for (const lang of entry.requiredLanguages) {
    const cwd = join(root, 'examples', lang);
    const plan = PLANS[lang];
    if (!existsSync(cwd)) { results[lang] = 'failed: example directory missing'; continue; }
    if (!has(plan.tool)) { results[lang] = `not-executed: ${plan.tool} is not installed`; continue; }
    results[lang] = 'passed';
    for (const cmd of plan.cmds) {
      const r = spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', timeout: 300000 });
      if (r.status !== 0) {
        results[lang] = `failed: ${cmd}\n${(r.stdout + r.stderr).slice(-1800)}`;
        break;
      }
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = loadManifest();
  const state = loadState();
  const want = process.argv.slice(2);
  const entries = [...m.topics, ...m.systems].filter((e) => (want.length ? want.includes(e.id) : e.status === 'complete'));
  let failed = 0;
  for (const e of entries) {
    const res = runExamples(e);
    for (const [lang, out] of Object.entries(res)) {
      console.log(`${e.id} ${lang}: ${out}`);
      if (out.startsWith('failed')) failed++;
    }
    state.items[e.id] = { ...(state.items[e.id] ?? {}), examples: res };
  }
  saveJson('generation-state.json', state);
  console.log(failed ? `example validation FAILED: ${failed} failures` : `example validation passed for ${entries.length} entries`);
  process.exit(failed ? 1 : 0);
}

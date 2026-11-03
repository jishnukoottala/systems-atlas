#!/usr/bin/env node
// Writes standard project configuration for a topic's TypeScript and Python examples.
// Usage: scaffold-example.mjs <slug> [--express] [--fastapi]   Source files are authored by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [slug, ...flags] = process.argv.slice(2);
const root = join(slug.includes('/') ? slug : `topics/${slug}`, 'examples');
const name = slug.split('/').pop();
const ts = join(root, 'typescript');
const py = join(root, 'python');
for (const d of [join(ts, 'src'), join(py, 'app'), join(py, 'tests')]) mkdirSync(d, { recursive: true });

const express = flags.includes('--express');
writeFileSync(join(ts, 'package.json'), `${JSON.stringify({
  name, version: '1.0.0', private: true, type: 'module',
  engines: { node: '>=23.6' },
  scripts: { start: 'node src/index.ts', check: 'tsc --noEmit', test: 'node --test src/*.test.ts' },
  dependencies: express ? { express: '5.1.0' } : {},
  devDependencies: { '@types/node': '24.0.0', typescript: '5.8.3', ...(express ? { '@types/express': '5.0.3' } : {}) },
}, null, 2)}\n`);
writeFileSync(join(ts, 'tsconfig.json'), `${JSON.stringify({
  compilerOptions: {
    target: 'ES2023', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true,
    noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, erasableSyntaxOnly: true,
    allowImportingTsExtensions: true, verbatimModuleSyntax: true, skipLibCheck: true,
  },
  include: ['src'],
}, null, 2)}\n`);

const fastapi = flags.includes('--fastapi');
const deps = ['"pydantic>=2.9"', ...(fastapi ? ['"fastapi>=0.115"', '"uvicorn>=0.32"'] : [])];
const dev = ['"pytest>=8"', ...(fastapi ? ['"httpx>=0.27"'] : [])];
writeFileSync(join(py, 'pyproject.toml'), `[project]
name = "${name}"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = [${deps.join(', ')}]

[dependency-groups]
dev = [${dev.join(', ')}]

[tool.uv]
package = false

[tool.pytest.ini_options]
pythonpath = ["."]
`);
writeFileSync(join(py, 'app', '__init__.py'), '');

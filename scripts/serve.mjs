#!/usr/bin/env node
// Dependency-free static server for local preview. Usage: serve.mjs [port]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? process.argv[2] ?? 8765);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.mmd': 'text/plain; charset=utf-8' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join(root, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    createReadStream(join(root, '404.html')).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/plain; charset=utf-8' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/`));

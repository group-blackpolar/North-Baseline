// Serves ./dist like production nginx does for the SPA, with the real Content-Security-Policy from deploy/nginx.conf (RM-081, BUG-005).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const csp = readFileSync('deploy/nginx.conf', 'utf8').match(/add_header Content-Security-Policy "([^"]+)"/)?.[1];
if (!csp) throw new Error('Content-Security-Policy not found in deploy/nginx.conf');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)).replace(/^[/]+/, '');
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-security-policy': csp });
  response.end(readFileSync(file));
}).listen(4173, '127.0.0.1');

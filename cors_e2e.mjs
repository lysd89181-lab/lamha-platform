// End-to-end CORS check in a REAL browser: the actual Worker code is served on one origin, a page (like GitHub Pages) on another.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; const require = createRequire(process.env.NODE_MODULES_DIR || '/usr/lib/node_modules/');
const { chromium } = require('playwright'); const worker = (await import('../worker/index.ts')).default;
const DIAG = path.resolve(import.meta.dirname, process.env.DIAG_DIR || '../web');
const sb = http.createServer((q, r) => { r.writeHead(401, { 'content-type': 'application/json' }); r.end('{"msg":"bad jwt"}'); }).listen(0);
const wsrv = http.createServer(async (q, r) => {
  const chunks = []; for await (const c of q) chunks.push(c); const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const env = { SUPABASE_URL: 'http://localhost:' + sb.address().port, SUPABASE_PUBLISHABLE_KEY: 'p', SUPABASE_SECRET_KEY: 's', ALLOWED_ORIGINS: process.env._ALLOWED || '' };
  const res = await worker.fetch(new Request('http://localhost:' + wsrv.address().port + q.url, { method: q.method, headers: q.headers, body: ['GET', 'HEAD'].includes(q.method) ? undefined : body }), env);
  r.writeHead(res.status, Object.fromEntries(res.headers)); r.end(Buffer.from(await res.arrayBuffer()));
}).listen(0);
const page = http.createServer((q, r) => { const f = path.join(DIAG, q.url.split('?')[0] === '/' ? 'diag.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(f)); }).listen(0);
const wbase = 'http://localhost:' + wsrv.address().port; const origin = 'http://localhost:' + page.address().port; let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const br = await chromium.launch();
async function run(allowed) { process.env._ALLOWED = allowed; const pg = await br.newPage(); await pg.goto(origin + '/'); await pg.fill('#base', wbase); await pg.click('#go'); await pg.waitForFunction(() => document.querySelectorAll('.r').length >= 4, null, { timeout: 8000 }).catch(() => {}); const t = await pg.innerText('#out'); await pg.close(); return t; }
let t = await run(`[${origin}](${origin}),https://lamha.ly`); ok(/الاتصال سليم/.test(t) && /401/.test(t), 'REAL browser, cross-origin, allow-list pasted with markdown brackets: API + Authorization preflight work');
t = await run(origin + '/'); ok(/الاتصال سليم/.test(t), 'REAL browser: trailing-slash entry works');
t = await run('https://lamha.ly'); ok(/CORS/.test(t) && !/الاتصال سليم/.test(t), 'REAL browser: origin missing from the list is blocked and the page says so');
await br.close(); sb.close(); wsrv.close(); page.close(); process.exit(fails ? 1 : 0);

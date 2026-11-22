// Browser smoke test (Chromium) against a mock API, served with the production CSP from web/_headers.
// Covers: auth, shop, direct top-up form, SHEIN, wallet, orders, account, admin, language switch (ar/en, RTL/LTR),
// no leftover Arabic in English mode, session expiry, network failure (no endless loaders).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; const require = createRequire(process.env.NODE_MODULES_DIR || '/usr/lib/node_modules/');
const { chromium } = require('playwright');
const W = path.resolve(import.meta.dirname, '../web');
const csp = fs.readFileSync(W + '/_headers', 'utf8').match(/Content-Security-Policy: (.*)/)[1];
const J = (r, o, s = 200) => { r.writeHead(s, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
const now = new Date().toISOString();
const items = [{ key: '1:a', id: '1', name: 'Red Dress', attr: 'Red / L', image: '', unitUsdCents: 570, originalUsdCents: 760, savingsUsdCents: 190, discountPercent: 25, orderable: true, orderableReason: '' }, { key: '2:b', id: '2', name: 'Gone', attr: '', image: '', unitUsdCents: 100, originalUsdCents: 100, savingsUsdCents: 0, discountPercent: 0, orderable: false, orderableReason: 'sold_out' }];
const ORDER = { id: 'o1', number: 21, service: 'top_ups', status: 'processing', total_usd: 0.88, paid_usd: 0.88, created_at: now, updated_at: now, remaining_usd: 0, order_items: [{ name: '66 Bonds', qty: 1, unit_price: 0.88 }], order_status_history: [{ status: 'paid', created_at: now }, { status: 'processing', created_at: now }] };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => {
    const P = u.pathname;
    if (P === '/api/config') return J(r, { supabase_url: 'http://localhost:' + srv.address().port + '/sb', publishable_key: 'pub' });
    if (P === '/sb/auth/v1/token') return J(r, { access_token: 't', refresh_token: 'r', expires_in: 3600 });
    if (P === '/api/me') return J(r, { id: 'u', email: 'a@b.c', confirmed: true, profile: { verification_status: 'unverified', full_name: 'Ali Salem', phone: '+218911234567' }, staff: { role: 'super_admin', permissions: [] } });
    if (P === '/api/shop/categories') return u.searchParams.get('service') === 'top_ups' ? J(r, { total: 1, items: [{ id: 'arena_breakout', name: 'Arena Breakout', image: 'http://localhost:' + srv.address().port + '/missing-logo.png' }] }) : J(r, { error: 'provider_mapping_unconfirmed' }, 501);
    if (P === '/api/shop/offers') return J(r, { offers: [{ id: '66_bonds', name: '66 Bonds', price_usd: 0.88, stock: null, min: 1, max: 100, available: true }], fields: [{ key: 'player_id', label: 'Player ID', required: true }], empty: false });
    if (P === '/api/wallet') return J(r, { balance: 12.5, transactions: [{ kind: 'deposit', amount: 12.5, balance_after: 12.5, created_at: now }, { kind: 'debit', amount: 1, balance_after: 11.5, created_at: now }, { kind: 'refund', amount: 1, balance_after: 12.5, created_at: now }] });
    if (P === '/api/orders') return J(r, [{ ...ORDER, status: 'completed' }, { ...ORDER, number: 22, status: 'failed' }]);
    if (P === '/api/orders/21') return J(r, ORDER);
    if (P === '/api/notifications') return J(r, [{ id: 1, title: 'تم شحن المحفظة', body: '10 USD', read: false, created_at: now }, { id: 2, title: 'تم استرداد المبلغ إلى محفظتك', body: 'طلب #21 — 0.88 USD', read: true, created_at: now }, { id: 3, title: 'فشل الطلب', body: 'نفد المخزون', read: true, created_at: now }]);
    if (P === '/api/support') return J(r, []);
    if (P === '/api/shein/cart') return J(r, { cart: { title: 'My cart', currency: { shown: 'USD' } }, items });
    if (P === '/api/shein/quote') return J(r, { items: [{ name: 'Red Dress', qty: 2, unit_price: 6.5 }], shipping: 3, fees: 1, total: 17, deposit: 8.5, remaining: 8.5 });
    if (P === '/api/admin/stats') return J(r, { customers: 3, orders: 4, pending_payments: 0, needs_action: 1, revenue_usd: 20, expected_profit_usd: 4 });
    if (P === '/api/admin/settings') return J(r, [{ key: 'shein_deposit_pct', value: 50 }]);
    if (P === '/api/admin/list/orders') return J(r, [{ id: 'o1', number: 1, service: 'shein', status: 'paid', total_usd: 17, created_at: now }, { id: 'o2', number: 2, service: 'top_ups', status: 'processing', total_usd: 1, provider_order_ref: null, created_at: now }]);
    if (P.startsWith('/api/admin/list/')) return J(r, [{ id: 'x', status: 'open', created_at: now }]);
    const f = path.join(W, P === '/' ? 'index.html' : P); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.png') ? 'image/png' : 'text/html', 'content-security-policy': csp }); r.end(fs.readFileSync(f));
  });
}).listen(0);
const base = 'http://localhost:' + srv.address().port; const errs = []; let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const br = await chromium.launch();
const newPage = async (lang) => { const ctx = await br.newContext({ viewport: { width: 390, height: 800 } }); const pg = await ctx.newPage(); if (lang) await pg.addInitScript((l) => localStorage.setItem('lamha_lang', l), lang);
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); }); return pg; };
// leftover Arabic letters in what the user sees (ignores the language button itself)
const arabicLeft = (pg) => pg.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-notr],script,style').forEach((e) => e.remove()); return (c.innerText.match(/[^\n]*[\u0600-\u06FF][^\n]*/g) || []).slice(0, 5); });
const settle = (pg) => pg.waitForFunction(() => !/Loading…|جارٍ التحميل/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
const login = async (pg) => { await pg.fill('#em', 'a@b.c'); await pg.fill('#pw', 'password1'); await pg.click('[data-a=authgo]'); await pg.waitForSelector('.nav'); };

// ===== Arabic (default) =====
let pg = await newPage();
await pg.goto(base + '/'); ok(await pg.locator('text=تسجيل الدخول').first().isVisible(), 'AR: login screen when signed out'); ok(await pg.evaluate(() => document.documentElement.dir) === 'rtl', 'AR: page is RTL');
await login(pg); await pg.waitForSelector('text=اشحن رصيدك'); ok(true, 'AR: home banner + category tiles (as in the design)');
await pg.waitForSelector('text=الكتالوج غير مفعّل', { timeout: 5000 }).catch(() => {}); ok((await pg.textContent('#app')).includes('الكتالوج غير مفعّل'), 'AR: gift-card catalog fails closed with a clear message');
await pg.click('[data-a=svc][data-k=top_ups]'); await pg.waitForSelector('text=Arena Breakout'); await pg.waitForFunction(() => !document.querySelector('img.th'), null, { timeout: 5000 }).catch(() => {});
ok(await pg.locator('img.th').count() === 0 && await pg.locator('.th.fallback').count() === 1, 'AR: broken provider image is replaced by a neutral tile (no empty box)');
const rw = await pg.locator('[data-a=cat]').first().boundingBox(); ok(rw.width >= 330, 'AR: category rows are full width (inline styles are allowed by the CSP)');
const iw = await pg.locator('.th').first().boundingBox(); ok(iw.width <= 64, 'AR: thumbnails keep their size');
await pg.screenshot({ path: '/tmp/home.png' });
await pg.click('[data-a=cat]'); await pg.waitForSelector('text=66 Bonds'); await pg.click('[data-a=buy]'); await pg.waitForSelector('.pf');
ok(await pg.locator('text=Player ID').count() > 0, 'AR: player-ID form generated from provider fields'); await pg.click('[data-a=close]');
await pg.click('[data-k=shein]'); await pg.fill('#shl', 'https://onelink.shein.com/x'); await pg.click('[data-a=shcart]'); await pg.waitForSelector('text=Red Dress');
ok((await pg.textContent('#app')).includes('مصدر الخصم غير مؤكد'), 'AR: SHEIN discount source marked unconfirmed'); await pg.click('[data-a=qp]'); await pg.click('[data-a=qp]'); await pg.click('[data-a=shquote]'); await pg.waitForSelector('text=العربون المطلوب الآن'); ok((await pg.textContent('#app')).includes('$8.50'), 'AR: deposit/remaining come from the server quote');
await pg.click('[data-k=wallet]'); await pg.waitForSelector('text=$12.50'); ok(true, 'AR: wallet balance'); await pg.click('[data-k=orders]'); await pg.waitForSelector('text=طلب #21'); ok(true, 'AR: orders list');
// language switch keeps working and flips direction
await pg.click('[data-a=lang]'); await pg.waitForSelector('text=My orders'); ok(await pg.evaluate(() => document.documentElement.dir) === 'ltr' && await pg.evaluate(() => document.documentElement.lang) === 'en', 'switch AR->EN flips to LTR instantly (no reload)');
await pg.click('[data-a=lang]'); await pg.waitForSelector('text=طلباتي'); ok(await pg.evaluate(() => document.documentElement.dir) === 'rtl', 'switch EN->AR back to RTL');
await pg.context().close();

// ===== English: no Arabic left on any screen =====
pg = await newPage('en'); await pg.goto(base + '/'); await pg.waitForSelector('text=Sign in'); let left = await arabicLeft(pg); ok(left.length === 0, 'EN: auth screen fully translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-a=mode][data-m=signup]'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: signup screen fully translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-a=mode][data-m=login]'); await login(pg); await pg.waitForSelector('text=Catalog not enabled', { timeout: 5000 }); left = await arabicLeft(pg); ok(left.length === 0, 'EN: home + provider message translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-a=svc][data-k=top_ups]'); await pg.waitForSelector('text=Arena Breakout'); await pg.click('[data-a=cat]'); await pg.waitForSelector('text=66 Bonds'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: offers list translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-a=buy]'); await pg.waitForSelector('.pf'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: buy modal translated' + (left.length ? ' -> ' + left.join(' | ') : '')); await pg.click('[data-a=close]');
await pg.click('[data-k=shein]'); await pg.fill('#shl', 'https://onelink.shein.com/x'); await pg.click('[data-a=shcart]'); await pg.waitForSelector('text=Red Dress'); await pg.click('[data-a=qp]'); await pg.click('[data-a=shquote]'); await pg.waitForSelector('text=Deposit due now'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: SHEIN screen translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-k=wallet]'); await pg.waitForSelector('text=Your current balance'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: wallet translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-k=orders]'); await pg.waitForSelector('text=Order #21'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: orders translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-a=ord][data-n="21"]'); await pg.waitForSelector('text=Order timeline'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: order details translated' + (left.length ? ' -> ' + left.join(' | ') : '')); await pg.click('[data-a=close]');
await pg.click('[data-k=acc]'); await pg.waitForSelector('text=Sign out'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: account translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
await pg.click('[data-a=notifs]'); await pg.waitForSelector('text=Wallet topped up'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: server-generated notifications translated' + (left.length ? ' -> ' + left.join(' | ') : '')); await pg.click('[data-a=close]');
await pg.goto(base + '/admin.html'); await pg.waitForSelector('text=Statistics'); left = await arabicLeft(pg); ok(left.length === 0, 'EN: admin dashboard translated' + (left.length ? ' -> ' + left.join(' | ') : ''));
for (const [k, wait] of [['orders', 'Start purchase'], ['settings', 'SHEIN deposit %'], ['pricing', 'Add/update a rule'], ['services', 'Disable'], ['staff', 'Add staff member'], ['provider_orders', 'Provider orders']]) {
  await pg.click(`[data-a=tab][data-k=${k}]`); await pg.waitForSelector(`text=${wait}`).catch(() => {}); await settle(pg); left = await arabicLeft(pg); ok(left.length === 0, `EN: admin ${k} translated` + (left.length ? ' -> ' + left.join(' | ') : '')); }
await pg.click('[data-a=tab][data-k=orders]'); await pg.click('[data-a=o_cands]').catch(() => {});
await pg.context().close();

// ===== robustness =====
pg = await newPage(); await pg.goto(base + '/'); await login(pg); await pg.route('**/api/wallet', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' }));
await pg.click('[data-k=wallet]'); await pg.waitForSelector('[data-a=authgo]', { timeout: 5000 }); ok(true, 'expired session -> back to sign-in (no stuck screen)');
await pg.context().close();
pg = await newPage(); await pg.goto(base + '/'); await login(pg); await pg.route('**/api/orders', (r) => r.abort()); await pg.click('[data-k=orders]'); await pg.waitForSelector('[data-a=reload]', { timeout: 5000 });
ok((await pg.textContent('#app')).includes('تعذّر التحميل'), 'network failure -> error + retry button, not an endless loader'); await pg.context().close();
ok(errs.length === 0, 'no JS/CSP errors under the production CSP' + (errs.length ? ': ' + errs.join(' | ') : ''));
await br.close(); srv.close(); process.exit(fails ? 1 : 0);

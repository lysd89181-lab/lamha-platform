import { test, beforeEach } from "node:test"; import assert from "node:assert/strict";
import { clearRscCache } from "../worker/rsc.ts"; import worker, { parseUsd } from "../worker/index.ts"; import { placeProviderOrder, pollProcessing } from "../worker/features.ts";
const E: any = { SUPABASE_URL: "https://sb.test", SUPABASE_PUBLISHABLE_KEY: "pub", SUPABASE_SECRET_KEY: "sec", EZONE_PAY_WEBHOOK_SECRET: "whsec", RESELLCODES_API_KEY: "k", RESELLCODES_BASE_URL: "https://rsc.test/api/v1",
  RESELLCODES_FIELD_MAP: JSON.stringify({ gift_cards: { list: "data", id: "id", price: "price", order_number: "number" } }) };
const U: any = { id: "00000000-0000-0000-0000-000000000001", email: "a@b.c", confirmed: true };
let calls: { url: string; method: string; body: any }[] = []; let rpcRet: Record<string, any> = {}; let provider: (u: string, i: any) => Response;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
beforeEach(() => {
  clearRscCache(); calls = []; rpcRet = { place_wallet_order: "ord-1", claim_order: true, refund_order: "refunded", settle_topup: "credited" };
  provider = () => j({ number: 77, status: "created" });
  (globalThis as any).fetch = async (url: string, i: any = {}) => {
    const body = i.body && typeof i.body === "string" ? JSON.parse(i.body) : i.body; calls.push({ url, method: i.method || "GET", body });
    if (url.startsWith("https://rsc.test")) return url.includes("/cards") ? j({ data: [{ id: "c1", price: "10.0000", name: "Card" }] }) : provider(url, i);
    const rpc = url.match(/rpc\/(\w+)/); if (rpc) return j(rpcRet[rpc[1]]);
    if (url.includes("provider_orders") && i.method === "POST") return j([{ id: 5 }]);
    if (url.includes("webhook_events") && i.method === "POST") return j(null, 201);
    return j([]);
  };
});
const n = (name: string) => calls.filter(c => c.url.includes("rpc/" + name)).length;
const body = { service: "gift_cards", category_id: "cat", card_id: "c1", quantity: 1, idempotency_key: "idem-12345678" };

test("happy path: debit+order once, provider called once", async () => {
  const r = await placeProviderOrder(E, U, body); assert.equal(r.status, 200);
  assert.equal(n("place_wallet_order"), 1); assert.equal(n("claim_order"), 1); assert.equal(calls.filter(c => c.url.endsWith("/gift-cards/order")).length, 1); assert.equal(n("refund_order"), 0);
});
test("duplicate request (claim lost) never calls the provider twice", async () => {
  rpcRet.claim_order = false; await placeProviderOrder(E, U, body); assert.equal(calls.filter(c => c.url.endsWith("/gift-cards/order")).length, 0);
});
test("provider 4xx -> customer refunded exactly once", async () => {
  provider = () => j({ error: { type: "forbidden", message: "x" } }, 403); await assert.rejects(placeProviderOrder(E, U, body)); assert.equal(n("refund_order"), 1);
});
test("provider 5xx -> unknown outcome: no refund, no retry, flagged for review", async () => {
  provider = () => j({}, 502); const r = await placeProviderOrder(E, U, body); assert.equal(r.status, 202); assert.equal(n("refund_order"), 0);
  assert.equal(calls.filter(c => c.url.endsWith("/gift-cards/order")).length, 1);
});
test("provider says failed -> refund_order called (DB makes it idempotent)", async () => {
  provider = () => j({ number: 77, status: "failed", fail_code: "out_of_stock" }); await placeProviderOrder(E, U, body); assert.equal(n("refund_order"), 1);
});
test("service without a real sample (game_keys) blocks ordering before any debit", async () => {
  await assert.rejects(placeProviderOrder({ ...E, RESELLCODES_FIELD_MAP: "" }, U, { service: "game_keys", game_id: "g", key_id: "k", quantity: 1, idempotency_key: "idem-12345678" }), (e: any) => e.status === 501); assert.equal(n("place_wallet_order"), 0);
});
test("unverified email cannot buy", async () => { await assert.rejects(placeProviderOrder(E, { ...U, confirmed: false }, body), /email_not_confirmed/); assert.equal(n("place_wallet_order"), 0); });
test("cron stops quietly on 429", async () => { (globalThis as any).fetch = async (u: string) => u.includes("orders?status") ? j([{ id: "o1" }, { id: "o2" }]) : u.includes("select=id,user_id") ? j([{ id: "o", user_id: "u", status: "processing", provider_order_ref: "1" }]) : new Response("{}", { status: 429, headers: { "retry-after": "60" } }); assert.equal(await pollProcessing(E), 0); });

// ---- Ezone webhook ----
const sign = async (b: string, s = "whsec") => { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(b))))); };
const hook = async (payload: object, sig?: string) => { const raw = JSON.stringify(payload); return worker.fetch(new Request("https://l/api/webhooks/ezone", { method: "POST", body: raw, headers: { "X-Signature": sig ?? await sign(raw) } }), E); };
const P = { event: 2, transactionId: 12345, transactionType: "online", orderReference: "11111111-1111-1111-1111-111111111111", updatedUtc: "2026-01-01T00:00:00Z", Amount: 9999 };
test("webhook: bad signature rejected, nothing credited", async () => { assert.equal((await hook(P, "AAAA")).status, 401); assert.equal(n("settle_topup"), 0); });
test("webhook: base64 HMAC accepted and credits via atomic settle_topup", async () => { assert.equal((await hook(P)).status, 200); assert.equal(n("settle_topup"), 1); });
test("webhook: payload amount is ignored (only the payment id is sent to the DB)", async () => { await hook(P); const c = calls.find(x => x.url.includes("rpc/settle_topup"))!; assert.deepEqual(Object.keys(c.body), ["p_payment"]); });
test("webhook: replay of a fully processed event does nothing", async () => {
  const f = (globalThis as any).fetch; (globalThis as any).fetch = async (u: string, i: any = {}) => u.includes("webhook_events") && i.method === "POST" ? j({}, 409) : u.includes("webhook_events") ? j([{ processed_at: "2026-01-01" }]) : f(u, i);
  const r = await hook(P); assert.equal((await r.json()).duplicate, true); assert.equal(n("settle_topup"), 0);
});
test("webhook: replay of an UNPROCESSED event (earlier crash) is allowed to finish", async () => {
  const f = (globalThis as any).fetch; (globalThis as any).fetch = async (u: string, i: any = {}) => u.includes("webhook_events") && i.method === "POST" ? j({}, 409) : u.includes("webhook_events?") && !i.method ? j([{ processed_at: null }]) : f(u, i);
  await hook(P); assert.equal(n("settle_topup"), 1);
});
test("webhook: any event other than Paid(2) credits nothing", async () => { await hook({ ...P, transactionId: 2, event: 1 }); assert.equal(n("settle_topup"), 0); });
test("USD parsing is exact", () => { assert.equal(parseUsd("10.25"), 10.25); assert.equal(parseUsd(1.1), 1.1); for (const bad of ["1.005", "-1", "0", "1e3", "abc", "", "99999999"]) assert.equal(parseUsd(bad), null, bad); });
test("anonymous requests to protected routes are rejected", async () => { assert.equal((await worker.fetch(new Request("https://l/api/wallet"), E)).status, 401); assert.equal((await worker.fetch(new Request("https://l/api/admin/list/orders"), E)).status, 401); });

// ---- shop (customer-safe catalog) ----
const MAP = { gift_cards: { list: "data", id: "id", price: "price", order_number: "number", name: "title", cat: { id: "id", name: "name" } } };
const REAL_CATS = { object: "list", total: 608, data: [{ category_id: "acash_my", name: "A-Cash (MY)", image: "/api/media/game-key-covers/a17b.webp" }, { category_id: "x", name: "Evil", image: "https://evil.test/a.png" }] };
test("shop categories parse the REAL ReSellCodes sample with no extra config", async () => {
  const { shopCategories } = await import("../worker/features.ts");
  (globalThis as any).fetch = async (u: string) => u.includes("/services?") ? j([{ enabled: true }]) : j(REAL_CATS);
  const out: any = await (await shopCategories({ ...E, RESELLCODES_FIELD_MAP: "" }, new URL("https://l/api/shop/categories?service=gift_cards"))).json();
  assert.equal(out.total, 608); assert.deepEqual(out.items[0], { id: "acash_my", name: "A-Cash (MY)", image: "https://resell.codes/api/media/game-key-covers/a17b.webp" });
  assert.equal(out.items[1].image, null); // non-documented image hosts are never rendered
});
test("game_keys offers stay closed (no real sample yet)", async () => {
  const { shopOffers } = await import("../worker/features.ts");
  (globalThis as any).fetch = async (u: string) => u.includes("/services?") ? j([{ enabled: true }]) : j({});
  await assert.rejects(shopOffers({ ...E, RESELLCODES_FIELD_MAP: "" }, new URL("https://l/api/shop/offers?service=game_keys&id=x")), (e: any) => e.status === 501);
});
test("shop offers hide cost and apply sell_price", async () => {
  const { shopOffers } = await import("../worker/features.ts");
  (globalThis as any).fetch = async (u: string) => u.includes("/services?") ? j([{ enabled: true }]) : u.includes("rpc/sell_price") ? j(11.5) : j({ data: [{ id: "c1", price: "10.0000", title: "Roblox 100" }] });
  const out: any = await (await shopOffers({ ...E, RESELLCODES_FIELD_MAP: JSON.stringify(MAP) }, new URL("https://l/api/shop/offers?service=gift_cards&id=cat"))).json();
  assert.deepEqual(out, { offers: [{ id: "c1", name: "Roblox 100", price_usd: 11.5, stock: null, min: 1, max: 100, available: true }], fields: [], empty: false });
});

// ---- Ezone top-up request must follow the docs ----
const topupReq = (amount: unknown) => worker.fetch(new Request("https://l/api/wallet/topup", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify({ amount }) }), { ...E, EZONE_BASE_URL: "https://test.ezonepay.ly", EZONE_PAY_API_KEY: "epk_x" });
function topupMock(profile: object) {
  (globalThis as any).fetch = async (u: string, i: any = {}) => {
    const body = i.body && typeof i.body === "string" ? JSON.parse(i.body) : i.body; calls.push({ url: u, method: i.method || "GET", body });
    if (u.includes("/auth/v1/user")) return j({ id: U.id, email: "a@b.c", email_confirmed_at: "x" });
    if (u.includes("app_settings")) return j([{ value: u.includes("topup_max") ? 500 : 1 }]);
    if (u.includes("profiles?")) return j([profile]);
    if (u.includes("payments") && i.method === "POST") return j([{ id: "22222222-2222-2222-2222-222222222222" }]);
    if (u.includes("ezonepay")) return j({ Id: 5, Link: "https://pay.ezonepay.ly/l/abc" });
    return j([]);
  };
}
test("top-up: Currency is the numeric USD id, one-time link with customer, unique reference", async () => {
  topupMock({ full_name: "Ali Salem", phone: "+218911234567" }); const r = await topupReq(10.5); assert.equal(r.status, 200);
  const b = calls.find(c => c.url.includes("payment-link/new"))!.body;
  assert.equal(b.Currency, 2); assert.equal(b.Amount, 10.5); assert.equal(b.MaxUsageCount, 1); assert.equal(b.IsUniqueOrderReference, true);
  assert.equal(b.OrderReference, "22222222-2222-2222-2222-222222222222"); assert.deepEqual(b.Customer, { FirstName: "Ali", LastName: "Salem", PhoneNumber: "+218911234567" });
  assert.equal((await r.json()).url, "https://pay.ezonepay.ly/l/abc");
});
test("top-up: incomplete profile is rejected before any payment is created", async () => {
  topupMock({ full_name: "Ali", phone: null }); const r = await topupReq(5); assert.equal(r.status, 400); assert.equal(calls.filter(c => c.url.includes("payments") && c.method === "POST").length, 0);
});
test("top-up: sub-cent amounts rejected", async () => { topupMock({ full_name: "A B", phone: "+218911234567" }); assert.equal((await topupReq(1.005)).status, 400); });

// ---- REAL order object from GET /orders ----
const REAL_ORDER = { object: "order", number: 21533, type: "gift_card", channel: "panel", status: "completed", charged_usd: "0.9109", status_reason: null, fail_code: null, category_id: "pubg_mobile", card_id: "60_uc", card_name: "60 UC", quantity: 1, codes: ["mdHHnbw42N2231geE1"] };
test("real completed order: codes delivered and real provider charge recorded as cost", async () => {
  const { applyOutcome } = await import("../worker/features.ts");
  (globalThis as any).fetch = async (u: string, i: any = {}) => { calls.push({ url: u, method: i.method || "GET", body: i.body ? JSON.parse(i.body) : null }); return u.includes("status=eq.processing") ? j([{ id: "o" }]) : j([]); };
  assert.equal(await applyOutcome(E, "o1", "u1", REAL_ORDER), "completed");
  assert.ok(calls.some(c => c.url.includes("orders?id=eq.o1") && c.body?.cost_usd === 0.9109));
  assert.ok(calls.some(c => c.url.includes("provider_orders") && c.body?.delivered_codes === JSON.stringify(["mdHHnbw42N2231geE1"])));
});

// ---- direct top-ups (PUBG UC etc.) ----
const TENV = { ...E, RESELLCODES_FIELD_MAP: "" }; // NO config: defaults come from the real samples
const OFFERS = { object: "top_up_offers", category_id: "arena_breakout", name: "Arena Breakout", fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [{ offer_id: "66_bonds", name: "66 Bonds", price_usd: "0.8007" }] };
const tbody = { service: "top_ups", category_id: "arena_breakout", offer_id: "66_bonds", fields: { player_id: "5123456789" }, idempotency_key: "idem-topup-0001" };
const tmock = (offers: any, post: any = { number: 99, status: "created" }) => { provider = (u) => (u.endsWith("/top-ups/order") ? j(post) : j({})); const f = (globalThis as any).fetch; (globalThis as any).fetch = async (u: string, i: any = {}) => u.includes("rsc.test") && u.endsWith("/offers") ? j(offers) : f(u, i); };
test("top-up: sends documented body with player fields; cost reaches DB as exact decimal string", async () => {
  tmock(OFFERS); const r = await placeProviderOrder(TENV, U, tbody); assert.equal(r.status, 200);
  const o = calls.find(c => c.url.endsWith("/top-ups/order"))!; assert.deepEqual(o.body, { category_id: "arena_breakout", offer_id: "66_bonds", fields: { player_id: "5123456789" } });
  assert.equal(calls.find(c => c.url.includes("rpc/place_wallet_order"))!.body.p_unit_cost, "0.8007"); assert.equal(calls.find(c => c.url.includes("rpc/place_wallet_order"))!.body.p_qty, 1);
});
test("top-up: unknown or missing player field is rejected BEFORE any charge", async () => {
  tmock(OFFERS); await assert.rejects(placeProviderOrder(TENV, U, { ...tbody, fields: { player_id: "1", extra: "x" } }), (e: any) => e.status === 400); await assert.rejects(placeProviderOrder(TENV, U, { ...tbody, fields: { uid: "1" } }), (e: any) => e.status === 400);
  assert.equal(n("place_wallet_order"), 0);
});
test("top-up: offer no longer listed -> clear error, nothing charged", async () => { tmock({ offers: [], fields: [{ key: "player_id", label: "Player ID" }] }); await assert.rejects(placeProviderOrder(TENV, U, tbody), (e: any) => e.message === "offer_gone"); assert.equal(n("place_wallet_order"), 0); });
test("top-up: category not_found from provider -> 404 category_not_found, nothing charged", async () => {
  const f = (globalThis as any).fetch; (globalThis as any).fetch = async (u: string, i: any = {}) => u.includes("rsc.test") && u.endsWith("/offers") ? j({ error: { type: "not_found", message: "x" } }, 404) : f(u, i);
  await assert.rejects(placeProviderOrder(TENV, U, tbody), (e: any) => e.status === 404 && e.message === "category_not_found"); assert.equal(n("place_wallet_order"), 0);
});
test("top-up: provider says refund(price_changed) -> wallet refunded once with the reason", async () => {
  tmock(OFFERS, { number: 99, status: "refund", fail_code: "price_changed" }); await placeProviderOrder(TENV, U, tbody);
  assert.equal(n("refund_order"), 1); assert.match(calls.find(c => c.url.includes("rpc/refund_order"))!.body.p_reason, /price_changed/);
});
test("shop offers: top-up fields returned for the form; empty category is a normal answer", async () => {
  const { shopOffers } = await import("../worker/features.ts"); const base = (globalThis as any).fetch;
  (globalThis as any).fetch = async (u: string) => u.includes("/services?") ? j([{ enabled: true }]) : u.includes("rpc/sell_price") ? j("1.2000") : j(OFFERS);
  const out: any = await (await shopOffers(TENV, new URL("https://l/api/shop/offers?service=top_ups&id=arena_breakout"))).json();
  assert.deepEqual(out.fields, [{ key: "player_id", label: "Player ID", required: true }]); assert.equal(out.offers[0].price_usd, 1.2); assert.equal("cost" in out.offers[0], false);
  (globalThis as any).fetch = async (u: string) => u.includes("/services?") ? j([{ enabled: true }]) : j({ offers: [], fields: [{ key: "player_id", label: "Player ID", type: "text" }] });
  assert.equal(((await (await shopOffers(TENV, new URL("https://l/api/shop/offers?service=top_ups&id=x"))).json()) as any).empty, true);
  (globalThis as any).fetch = base;
});

test("real itunes gift-card offers render with no config; cost never exposed", async () => {
  const { shopOffers } = await import("../worker/features.ts");
  (globalThis as any).fetch = async (u: string) => u.includes("/services?") ? j([{ enabled: true }]) : u.includes("rpc/sell_price") ? j("2.2100") : j({ object: "gift_card_offers", offers: [{ card_id: "2_usd", name: "2 USD", price_usd: "2.0097", stock: 414, min_quantity: 1, max_quantity: 100 }] });
  const out: any = await (await shopOffers(TENV, new URL("https://l/api/shop/offers?service=gift_cards&id=app_store_itunes_us"))).json();
  assert.deepEqual(out.offers[0], { id: "2_usd", name: "2 USD", price_usd: 2.21, stock: 414, min: 1, max: 100, available: true }); assert.equal(JSON.stringify(out).includes("2.0097"), false);
});
test("provider status 'failed' still refunds the customer but flags the provider order for a ticket", async () => {
  const { applyOutcome } = await import("../worker/features.ts");
  (globalThis as any).fetch = async (u: string, i: any = {}) => { calls.push({ url: u, method: i.method || "GET", body: i.body ? JSON.parse(i.body) : null }); return u.includes("rpc/") ? j("refunded") : j([]); };
  await applyOutcome(E, "o1", "u1", { status: "failed", fail_code: "stock_short" }); assert.equal(n("refund_order"), 1);
  assert.equal(calls.find(c => c.url.includes("provider_orders"))!.body.status, "failed_check_refund");
  calls = []; await applyOutcome(E, "o2", "u1", { status: "refund", fail_code: "price_changed" }); assert.equal(calls.find(c => c.url.includes("provider_orders"))!.body.status, "refunded");
});

// ---- admin: assisted matching of unknown-outcome orders ----
test("candidates: only same price/type/window and not already linked are offered; admin must pick", async () => {
  const { adminExtra } = await import("../worker/features.ts"); const now = new Date().toISOString();
  (globalThis as any).fetch = async (u: string) => u.includes("user_roles") ? j([{ role: "super_admin", permissions: [] }]) : u.includes("orders?id=eq.") ? j([{ id: "11111111-1111-1111-1111-111111111111", service: "top_ups", status: "processing", cost_usd: 0.8007, provider_order_ref: null, created_at: now }])
    : u.includes("provider_orders?provider") ? j([{ external_ref: "5" }]) : u.includes("rsc.test") ? j({ data: [
      { number: 7, type: "game_topup", status: "processing", charged_usd: "0.8007", created_at: now, offer_name: "66 Bonds" }, { number: 5, type: "game_topup", status: "completed", charged_usd: "0.8007", created_at: now },
      { number: 8, type: "game_topup", status: "completed", charged_usd: "9.0000", created_at: now }, { number: 9, type: "gift_card", status: "completed", charged_usd: "0.8007", created_at: now },
      { number: 3, type: "game_topup", status: "completed", charged_usd: "0.8007", created_at: "2020-01-01T00:00:00Z" }] }) : j([]);
  const r: any = await (await adminExtra(E, U, new Request("https://l/x"), "admin/orders/11111111-1111-1111-1111-111111111111/candidates"))!.json();
  assert.deepEqual(r.candidates.map((c: any) => c.number), [7]); assert.equal(r.note, "single_match_verify_before_linking");
});

// ---- CORS / domain / perf ----
const CE: any = { ...E, ALLOWED_ORIGINS: "https://lamha.ly,https://www.lamha.ly" };
test("CORS: lamha.ly origin allowed on API calls", async () => {
  const r = await worker.fetch(new Request("https://lamha.ysymazn58.workers.dev/api/health", { headers: { origin: "https://lamha.ly" } }), CE);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://lamha.ly"); assert.equal(r.headers.get("vary"), "Origin");
});
test("CORS: unknown origin gets no CORS headers; preflight from it is refused", async () => {
  const r = await worker.fetch(new Request("https://l/api/health", { headers: { origin: "https://evil.example" } }), CE); assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal((await worker.fetch(new Request("https://l/api/wallet", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), CE)).status, 403);
});
test("CORS: preflight from lamha.ly succeeds with the needed headers", async () => {
  const r = await worker.fetch(new Request("https://l/api/wallet", { method: "OPTIONS", headers: { origin: "https://www.lamha.ly" } }), CE);
  assert.equal(r.status, 204); assert.match(r.headers.get("access-control-allow-headers")!, /authorization/); assert.match(r.headers.get("access-control-allow-methods")!, /PATCH/);
});
test("/api/config exposes only the public URL and publishable key, and is cacheable", async () => {
  const r = await worker.fetch(new Request("https://l/api/config"), CE); const d: any = await r.json();
  assert.deepEqual(Object.keys(d).sort(), ["publishable_key", "supabase_url"]); assert.equal(JSON.stringify(d).includes("sec"), false); assert.match(r.headers.get("cache-control")!, /max-age/);
});
test("admin stats is ONE SQL aggregate (no row dumps) and needs the orders permission", async () => {
  const { adminExtra } = await import("../worker/features.ts"); const seen: string[] = [];
  (globalThis as any).fetch = async (u: string) => { seen.push(u); return u.includes("user_roles") ? j([{ role: "admin", permissions: ["orders"] }]) : j({ customers: 3 }); };
  const r: any = await (await adminExtra(E, U, new Request("https://l/x"), "admin/stats"))!.json(); assert.equal(r.customers, 3);
  assert.ok(seen.some(x => x.includes("rpc/admin_stats"))); assert.equal(seen.some(x => /orders\?select|profiles\?select/.test(x)), false);
  (globalThis as any).fetch = async (u: string) => u.includes("user_roles") ? j([{ role: "admin", permissions: ["support"] }]) : j({});
  await assert.rejects(adminExtra(E, U, new Request("https://l/x"), "admin/stats"), (e: any) => e.status === 403);
});

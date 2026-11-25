import { test } from "node:test"; import assert from "node:assert/strict";
import { adminExtra } from "./features.ts"; import { clearRscCache } from "./rsc.ts";
const E: any = { SUPABASE_URL: "https://sb.test", SUPABASE_PUBLISHABLE_KEY: "p", SUPABASE_SECRET_KEY: "s", RESELLCODES_API_KEY: "k", RESELLCODES_BASE_URL: "https://rsc.test/api/v1", RESELLCODES_FIELD_MAP: "" };
const U: any = { id: "00000000-0000-0000-0000-000000000001", email: "a@b.c", confirmed: true };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
let calls: { url: string; method: string; body: any }[] = []; let role: any;
const RULES = [{ scope: "global", scope_key: "", percent: 10, fixed_usd: 0 }, { scope: "service", scope_key: "top_ups", percent: 15, fixed_usd: 0.05 }, { scope: "product", scope_key: "top_ups:66_bonds", percent: 20, fixed_usd: 0.1 }];
const OFFERS = { object: "top_up_offers", category_id: "arena_breakout", fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [{ offer_id: "66_bonds", name: "66 Bonds", price_usd: "0.8007" }, { offer_id: "132_bonds", name: "132 Bonds", price_usd: "1.6000" }] };
const install = () => { clearRscCache(); calls = []; role = [{ role: "admin", permissions: ["pricing"] }];
  (globalThis as any).fetch = async (u: string, i: any = {}) => { calls.push({ url: u, method: i.method || "GET", body: i.body ? JSON.parse(i.body) : null });
    if (u.includes("user_roles")) return j(role); if (u.includes("pricing_rules?select")) return j(RULES);
    if (u.includes("rpc/sell_price")) return j(Number((Number(JSON.parse(i.body).p_cost) * 1.2).toFixed(2)));
    if (u.includes("rsc.test") && u.includes("/top-ups/categories/arena_breakout/offers")) return j(OFFERS);
    if (/rsc\.test.*\/top-ups\/categories(\?|$)/.test(u)) return j({ total: 1, data: [{ category_id: "arena_breakout", name: "Arena Breakout", image: "/api/media/x.webp" }] });
    if (u.includes("rsc.test")) return j({ error: { type: "forbidden", message: "bad key" } }, 403);
    return j([]); }; };
const get = async (path: string) => (await adminExtra(E, U, new Request("https://l/api/" + path), path.split("?")[0]))!;

test("admin categories: real provider shape, no image field needed, needs the pricing permission", async () => {
  install(); const r: any = await (await get("admin/provider/categories?service=top_ups&q=arena")).json(); assert.deepEqual(r.items, [{ id: "arena_breakout", name: "Arena Breakout" }]);
  role = [{ role: "admin", permissions: ["support"] }]; await assert.rejects(get("admin/provider/categories?service=top_ups"), (e: any) => e.status === 403);
});
test("admin offers: cost, authoritative sell price, profit and the ACTIVE rule (product > service > global)", async () => {
  install(); const r: any = await (await get("admin/provider/offers?service=top_ups&id=arena_breakout")).json();
  const a = r.offers.find((o: any) => o.id === "66_bonds"), b = r.offers.find((o: any) => o.id === "132_bonds");
  assert.equal(a.cost_usd, "0.8007"); assert.equal(a.pid, "top_ups:66_bonds"); assert.deepEqual(a.rule, { scope: "product", percent: 20, fixed_usd: 0.1 });
  assert.deepEqual(b.rule, { scope: "service", percent: 15, fixed_usd: 0.05 }); // no product rule -> service rule, NOT summed with global
  assert.equal(a.price_usd, 0.96); assert.equal(a.profit_usd, 0.1593);
  assert.equal(calls.find(c => c.url.includes("rpc/sell_price"))!.body.p_product.startsWith("top_ups:"), true);
});
test("admin offers: provider errors are shown, not hidden behind a soft fallback", async () => {
  install(); await assert.rejects(get("admin/provider/offers?service=top_ups&id=nope"), (e: any) => e.status === 409 && e.message === "forbidden");
});
test("admin offers: bad input rejected", async () => { install(); await assert.rejects(get("admin/provider/offers?service=top_ups&id=a/../b"), (e: any) => e.status === 400); await assert.rejects(get("admin/provider/offers?service=evil&id=x"), (e: any) => e.status === 400); });
test("remove rule: only service/product scopes, validated key, audited; global can never be removed", async () => {
  install(); const post = (b: any) => adminExtra(E, U, new Request("https://l/api/admin/pricing/remove", { method: "POST", body: JSON.stringify(b) }), "admin/pricing/remove")!;
  assert.equal((await post({ scope: "product", scope_key: "top_ups:66_bonds" })).status, 200);
  assert.ok(calls.some(c => c.method === "DELETE" && c.url.includes("scope=eq.product&scope_key=eq.top_ups%3A66_bonds"))); assert.ok(calls.some(c => c.url.includes("admin_audit_logs")));
  await assert.rejects(post({ scope: "global", scope_key: "" }), (e: any) => e.status === 400); await assert.rejects(post({ scope: "product", scope_key: "x;drop" }), (e: any) => e.status === 400);
});

test("bulk rule: one atomic upsert for many products, validated and audited", async () => {
  install(); const post = (b: any) => adminExtra(E, U, new Request("https://l/api/admin/pricing/bulk", { method: "POST", body: JSON.stringify(b) }), "admin/pricing/bulk")!;
  const r: any = await (await post({ keys: ["top_ups:66_bonds", "top_ups:132_bonds", "top_ups:66_bonds"], percent: "25", fixed_usd: "0.1" })).json(); assert.equal(r.count, 2); // duplicates collapsed
  const w = calls.find(c => c.method === "POST" && c.url.includes("pricing_rules?on_conflict"))!; assert.equal(w.body.length, 2); assert.deepEqual(w.body[0], { scope: "product", scope_key: "top_ups:66_bonds", percent: 25, fixed_usd: 0.1 });
  assert.ok(calls.some(c => c.url.includes("admin_audit_logs")));
  for (const bad of [{ keys: [], percent: "1" }, { keys: ["top_ups:a"], percent: "-1" }, { keys: ["top_ups:a"], percent: "1.234" }, { keys: ["x y:a"], percent: "1" }, { keys: ["top_ups:a;drop"], percent: "1" }, { keys: Array.from({ length: 101 }, (_, i) => "top_ups:p" + i), percent: "1" }]) await assert.rejects(post(bad), (e: any) => e.status === 400, JSON.stringify(bad).slice(0, 60));
});
test("bulk rule needs the pricing permission", async () => { install(); role = [{ role: "admin", permissions: ["orders"] }]; await assert.rejects(adminExtra(E, U, new Request("https://l/api/admin/pricing/bulk", { method: "POST", body: "{}" }), "admin/pricing/bulk")!, (e: any) => e.status === 403); });

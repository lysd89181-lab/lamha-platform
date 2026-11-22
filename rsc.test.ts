import { test } from "node:test"; import assert from "node:assert/strict";
import { rscFetch, rscPaginate, orderRequest, classifyOrder, fieldMap, pickOffer, parseUsd4, fieldDefs, validateFields, RscError } from "../worker/rsc.ts";
const env = { RESELLCODES_API_KEY: "rsc_live_test", RESELLCODES_BASE_URL: "https://x/api/v1" };
const res = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: h });
test("sends Bearer auth", async () => { let auth = ""; await rscFetch(env, "/me", {}, (async (_u: any, i: any) => { auth = i.headers.authorization; return res(200, {}); }) as any); assert.equal(auth, "Bearer rsc_live_test"); });
test("429 with short Retry-After: one retry on GET", async () => { let n = 0; const d = await rscFetch(env, "/me", {}, (async () => (++n === 1 ? res(429, {}, { "retry-after": "0" }) : res(200, { ok: 1 }))) as any); assert.equal(n, 2); assert.equal(d.ok, 1); });
test("429 on POST is never retried and is a definite rejection", async () => { let n = 0; await assert.rejects(rscFetch(env, "/x", { method: "POST", body: {} }, (async () => { n++; return res(429, {}, { "retry-after": "1" }); }) as any), (e: any) => e instanceof RscError && e.definite && e.retryAfter === 1); assert.equal(n, 1); });
test("5xx and network errors are NOT definite (outcome unknown)", async () => {
  await assert.rejects(rscFetch(env, "/x", { method: "POST", body: {} }, (async () => res(500, {})) as any), (e: any) => !e.definite);
  await assert.rejects(rscFetch(env, "/x", {}, (async () => { throw new Error("net"); }) as any), (e: any) => !e.definite && e.type === "network");
});
test("provider error shape is parsed", async () => { await assert.rejects(rscFetch(env, "/me", {}, (async () => res(401, { error: { type: "unauthorized", message: "Invalid API key." } })) as any), (e: any) => e.status === 401 && e.type === "unauthorized"); });
test("pagination follows next_cursor until null", async () => {
  const seen: string[] = []; const f = (async (u: string) => { const c = new URL(u).searchParams.get("cursor"); seen.push(String(c)); return c ? res(200, { data: [3], has_more: false, next_cursor: null }) : res(200, { data: [1, 2], has_more: true, next_cursor: 7 }); }) as any;
  const r = await rscPaginate(env, "/orders", {}, 5, f); assert.deepEqual(r.data, [1, 2, 3]); assert.deepEqual(seen, ["null", "7"]);
});
test("documented order bodies", () => {
  assert.deepEqual(orderRequest("gift_cards", { category_id: "roblox_ru", card_id: "199_robux", quantity: 2 }).body, { category_id: "roblox_ru", card_id: "199_robux", quantity: 2 });
  assert.equal(orderRequest("top_ups", { category_id: "pubg", offer_id: "60_uc", fields: { player_id: "1" } }).quantity, 1);
  assert.throws(() => orderRequest("gift_cards", { category_id: "a", card_id: "b", quantity: 0 }), /bad_quantity/);
  assert.throws(() => orderRequest("telegram", {}), (e: any) => e.status === 501);
});
test("status model: created/processing wait, completed delivers, failed/refund -> refund", () => {
  assert.equal(classifyOrder({ status: "created" }).action, "wait"); assert.equal(classifyOrder({ status: "processing" }).action, "wait");
  assert.deepEqual(classifyOrder({ status: "completed", codes: ["A"] }), { action: "complete", codes: ["A"] });
  assert.deepEqual(classifyOrder({ status: "failed", fail_code: "out_of_stock" }), { action: "refund", failCode: "out_of_stock", providerStatus: "failed" });
  assert.equal(classifyOrder({ status: "refund" }).action, "refund"); assert.throws(() => classifyOrder({ status: "weird" }), /unknown_provider_status/);
});
test("services without a real sample stay closed (game_keys)", () => { assert.throws(() => fieldMap(env, "game_keys"), (e: any) => e.type === "provider_mapping_unconfirmed"); });
test("offer pick respects stock and min/max when mapped", () => {
  const m = { id: "id", price: "p", stock: "stock", min: "min_quantity", max: "max_quantity", order_number: "number" };
  const j = { data: [{ id: "a", p: "1.2500", stock: 5, min_quantity: 1, max_quantity: 3, name: "A" }] };
  assert.equal(pickOffer(j, "a", m, 2).cost, "1.2500"); // decimal string kept as-is, no float math
  assert.throws(() => pickOffer(j, "a", m, 6), /stock_short/); assert.throws(() => pickOffer(j, "a", m, 4), /above_max/); assert.throws(() => pickOffer(j, "zz", m, 1), /offer_gone/);
});

test("real order object classifies as complete with its codes", () => assert.deepEqual(classifyOrder({ status: "completed", fail_code: null, codes: ["mdHHnbw42N2231geE1"] }), { action: "complete", codes: ["mdHHnbw42N2231geE1"] }));
test("defaults come from REAL samples (gift cards + top-ups)", () => {
  const g = fieldMap(env, "gift_cards"); assert.deepEqual([g.list, g.id, g.price, g.stock, g.min, g.max, g.order_number], ["offers", "card_id", "price_usd", "stock", "min_quantity", "max_quantity", "number"]);
  const t = fieldMap(env, "top_ups"); assert.deepEqual([t.list, t.id, t.price, t.fields?.key, t.fields?.label], ["offers", "offer_id", "price_usd", "key", "label"]);
});
test("pickOffer on the REAL itunes sample: exact decimal string, stock and limits enforced", () => {
  const j = { object: "gift_card_offers", category_id: "app_store_itunes_us", offers: [{ card_id: "2_usd", name: "2 USD", price_usd: "2.0097", stock: 414, min_quantity: 1, max_quantity: 100 }] };
  const m = fieldMap(env, "gift_cards"); assert.deepEqual(pickOffer(j, "2_usd", m, 3), { cost: "2.0097", name: "2 USD" });
  assert.throws(() => pickOffer(j, "2_usd", m, 101), /above_max/); assert.throws(() => pickOffer(j, "2_usd", m, 415), /stock_short/);
});
test("REAL top-up fields objects {key,label,type} are understood with no config", () => {
  const j = { fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [] }; assert.deepEqual(fieldDefs(j, fieldMap(env, "top_ups")), [{ key: "player_id", label: "Player ID", required: true }]);
});
test("catalog cache: second read within TTL does not hit the provider (30 req/min limit)", async () => {
  const { rscCached, clearRscCache } = await import("../worker/rsc.ts"); clearRscCache(); let n = 0; const f = (async () => { n++; return res(200, { data: [] }); }) as any;
  await rscCached(env, "/top-ups/categories", { q: "a" }, 60000, f); await rscCached(env, "/top-ups/categories", { q: "a" }, 60000, f); await rscCached(env, "/top-ups/categories", { q: "b" }, 60000, f); assert.equal(n, 2);
});
test("provider money strings: exact 4-decimal parsing, junk rejected", () => {
  assert.equal(parseUsd4("0.9109"), "0.9109"); assert.equal(parseUsd4(12), "12");
  for (const bad of ["0", "-1", "1.23456", "abc", "", null, "1e2"]) assert.throws(() => parseUsd4(bad), /provider_price_invalid/, String(bad));
});
test("top-up player fields: validated, required, no markup characters", () => {
  assert.deepEqual(orderRequest("top_ups", { category_id: "pubg_mobile_auto", offer_id: "60_uc", fields: { player_id: " 5123456789 " } }).body, { category_id: "pubg_mobile_auto", offer_id: "60_uc", fields: { player_id: "5123456789" } });
  assert.throws(() => orderRequest("top_ups", { category_id: "a", offer_id: "b", fields: {} }), /player_fields_required/);
  assert.throws(() => orderRequest("top_ups", { category_id: "a", offer_id: "b", fields: { player_id: "<script>" } }), /bad_field_player_id/);
  assert.throws(() => orderRequest("top_ups", { category_id: "a", offer_id: "b", fields: { "x y": "1" } }), /bad_field/);
});
test("field definitions: string entries need no mapping; object entries need fields.key", () => {
  const m: any = { id: "offer_id", price: "p", order_number: "number" };
  const defs = fieldDefs({ fields: ["player_id"] }, m)!; assert.deepEqual(defs, [{ key: "player_id", label: "player_id", required: true }]);
  assert.throws(() => fieldDefs({ fields: [{ name: "player_id" }] }, m), (e: any) => e.type === "provider_mapping_unconfirmed");
  assert.deepEqual(fieldDefs({ fields: [{ name: "player_id", title: "Player ID", required: false }] }, { ...m, fields: { key: "name", label: "title", required: "required" } })![0], { key: "player_id", label: "Player ID", required: false });
  assert.equal(fieldDefs({}, m), null);
  assert.throws(() => validateFields(defs, { player_id: "1", evil: "x" }), /unknown_field/); assert.throws(() => validateFields(defs, {}), /missing_player_id/);
});

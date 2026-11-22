// ReSellCodes API v1 client. Only what 02_resellcodes/resellcodes_api_v1_docs.md documents.
// Response FIELD NAMES for catalog offers / order creation are NOT in that doc, so they come from RESELLCODES_FIELD_MAP
// (JSON, set by the owner after seeing real responses). Until then ordering fails closed (provider_mapping_unconfirmed).
export interface RscEnv { RESELLCODES_API_KEY: string; RESELLCODES_BASE_URL: string; RESELLCODES_FIELD_MAP?: string }
export class RscError extends Error {
  status: number; type: string; retryAfter: number | null; definite: boolean;
  constructor(status: number, type: string, message: string, retryAfter: number | null = null) {
    super(message); this.status = status; this.type = type; this.retryAfter = retryAfter;
    this.definite = status >= 400 && status < 500; // 4xx = provider rejected, nothing executed. 5xx/network = outcome unknown.
  }
}
type F = typeof fetch;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function rscFetch(env: RscEnv, path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}, f: F = fetch): Promise<any> {
  const method = init.method || "GET";
  const q = new URLSearchParams(); for (const [k, v] of Object.entries(init.query || {})) if (v !== undefined && v !== "") q.set(k, String(v));
  const url = `${env.RESELLCODES_BASE_URL}${path}${q.size ? "?" + q : ""}`;
  for (let attempt = 0; ; attempt++) {
    let r: Response;
    try {
      r = await f(url, { method, headers: { authorization: `Bearer ${env.RESELLCODES_API_KEY}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) }, body: init.body ? JSON.stringify(init.body) : undefined });
    } catch { throw new RscError(0, "network", "network_error"); }
    if (r.status === 429) {
      const ra = Number(r.headers.get("retry-after")) || 1;
      if (method === "GET" && attempt === 0 && ra <= 3) { await sleep(ra * 1000); continue; } // back off, then one retry (reads only)
      throw new RscError(429, "rate_limited", "rate_limited", ra);
    }
    const text = await r.text(); let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    if (!r.ok) throw new RscError(r.status, data?.error?.type || "http_" + r.status, data?.error?.message || "provider_error");
    return data;
  }
}

const CACHE = new Map<string, { t: number; v: unknown }>();
export const clearRscCache = () => CACHE.clear();
export async function rscCached(env: RscEnv, path: string, query: Record<string, string | number | undefined>, ttlMs: number, f: F = fetch) {
  const k = path + "?" + JSON.stringify(query); const hit = CACHE.get(k); if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const v = await rscFetch(env, path, { query }, f); if (CACHE.size > 300) CACHE.clear(); CACHE.set(k, { t: Date.now(), v }); return v;
}

// Cursor pagination: has_more / next_cursor, `data` array (documented for /transactions and /orders).
export async function rscPaginate(env: RscEnv, path: string, query: Record<string, string | number | undefined> = {}, maxPages = 5, f: F = fetch) {
  const all: any[] = []; let cursor: string | number | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await rscFetch(env, path, { query: { limit: 100, ...query, cursor } }, f);
    all.push(...(page?.data || []));
    if (!page?.has_more || page.next_cursor == null) return { data: all, truncated: false };
    cursor = page.next_cursor;
  }
  return { data: all, truncated: true };
}

// ---- documented request bodies ----
const str = (v: unknown, n: string) => { if (typeof v !== "string" || !v || v.length > 200) throw new RscError(400, "invalid_request", `bad_${n}`); return v; };
const qty = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 1000) throw new RscError(400, "invalid_request", "bad_quantity"); return n; };
export function orderRequest(service: string, i: any): { path: string; body: any; quantity: number } {
  switch (service) {
    case "gift_cards": { const quantity = qty(i.quantity ?? 1); return { path: "/gift-cards/order", quantity, body: { category_id: str(i.category_id, "category_id"), card_id: str(i.card_id, "card_id"), quantity } }; }
    case "game_keys": { const quantity = qty(i.quantity ?? 1); return { path: "/game-keys/order", quantity, body: { game_id: str(i.game_id, "game_id"), key_id: str(i.key_id, "key_id"), quantity } }; }
    case "top_ups": {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(i.fields || {})) {
        if (!/^[A-Za-z0-9_]{1,40}$/.test(k) || typeof v !== "string" || !/^[^\u0000-\u001f<>]{1,100}$/.test(v)) throw new RscError(400, "bad_fields", "bad_field_" + k.slice(0, 20));
        fields[k] = v.trim();
      }
      if (!Object.keys(fields).length) throw new RscError(400, "bad_fields", "player_fields_required");
      return { path: "/top-ups/order", quantity: 1, body: { category_id: str(i.category_id, "category_id"), offer_id: str(i.offer_id, "offer_id"), fields } };
    }
    default: throw new RscError(501, "not_implemented", "service_not_supported_yet"); // steam/telegram/manual: cost derivation undocumented
  }
}

// ---- field map (owner-supplied; never guessed) ----
export type Mapping = { list?: string; id: string; price: string; name?: string; stock?: string; min?: string; max?: string; order_number: string; cat?: { list?: string; id: string; name: string; image?: string }; fields?: { list?: string; key?: string; label?: string; required?: string } };
// Built-in defaults come ONLY from real responses the owner supplied (GET /gift-cards/categories and GET /orders samples).
// Offer price (and the offer-list shape) is still unknown for every service => ordering stays closed until it is set via RESELLCODES_FIELD_MAP.
const CAT = { list: "data", id: "category_id", name: "name", image: "image" };
const DEFAULTS: Record<string, Partial<Mapping>> = {
  // REAL samples: top_up_offers (arena_breakout) and gift_card_offers (app_store_itunes_us), plus the order objects.
  top_ups: { list: "offers", id: "offer_id", name: "name", price: "price_usd", order_number: "number", fields: { list: "fields", key: "key", label: "label" }, cat: CAT },
  gift_cards: { list: "offers", id: "card_id", name: "name", price: "price_usd", stock: "stock", min: "min_quantity", max: "max_quantity", order_number: "number", cat: CAT },
};
export function fieldMap(env: RscEnv, service: string): Mapping {
  let o: any = null; try { o = JSON.parse(env.RESELLCODES_FIELD_MAP || "{}")[service]; } catch { /* ignore */ }
  const m = { ...(DEFAULTS[service] || {}), ...(o || {}) } as Mapping;
  if (!m.id || !m.price || !m.order_number) throw new RscError(501, "provider_mapping_unconfirmed", "provider_mapping_unconfirmed");
  return m;
}
// Category browsing needs only the (real-sample) category mapping, not offer prices
export function catMap(env: RscEnv, service: string) {
  let o: any = null; try { o = JSON.parse(env.RESELLCODES_FIELD_MAP || "{}")[service]; } catch { /* ignore */ }
  const c = { ...(DEFAULTS[service]?.cat || {}), ...(o?.cat || {}) };
  if (!c.id || !c.name) throw new RscError(501, "provider_mapping_unconfirmed", "provider_mapping_unconfirmed");
  return c as NonNullable<Mapping["cat"]>;
}
// Provider money = decimal string, up to 4 decimals. Kept as a STRING end-to-end; Postgres numeric does the arithmetic (no float math anywhere).
export function parseUsd4(v: unknown): string {
  const t = String(v ?? "").trim();
  if (!/^\d{1,9}(\.\d{1,4})?$/.test(t) || Number(t) <= 0) throw new RscError(502, "bad_price", "provider_price_invalid");
  return t;
}
export type FieldDef = { key: string; label: string; required: boolean };
// Player-input definitions returned beside the offers. String entries need no mapping; object entries need fields.key from config.
export function fieldDefs(json: any, m: Mapping): FieldDef[] | null {
  const raw = json?.[m.fields?.list || "fields"]; if (!Array.isArray(raw)) return null;
  return raw.map((x: any) => {
    if (typeof x === "string") return { key: x, label: x, required: true };
    const f = m.fields; if (!f?.key || x?.[f.key] == null) throw new RscError(501, "provider_mapping_unconfirmed", "provider_mapping_unconfirmed");
    return { key: String(x[f.key]), label: String(x[f.label || f.key] ?? x[f.key]), required: f.required ? Boolean(x[f.required]) : true };
  });
}
export function validateFields(defs: FieldDef[], given: Record<string, string>) {
  const keys = new Set(defs.map(d => d.key));
  for (const k of Object.keys(given)) if (!keys.has(k)) throw new RscError(400, "bad_fields", "unknown_field");
  for (const d of defs) if (d.required && !given[d.key]) throw new RscError(400, "bad_fields", "missing_" + d.key);
}
export function pickOffer(json: any, offerId: string, m: Mapping, quantity: number) {
  const list = Array.isArray(json) ? json : (m.list ? json?.[m.list] : json?.data);
  const o = (list || []).find((x: any) => String(x?.[m.id]) === offerId);
  if (!o) throw new RscError(409, "offer_gone", "offer_gone");
  const price = parseUsd4(o[m.price]);
  if (m.stock && o[m.stock] != null && Number(o[m.stock]) < quantity) throw new RscError(409, "stock_short", "stock_short");
  if (m.min && o[m.min] != null && quantity < Number(o[m.min])) throw new RscError(400, "limit_exceeded", "below_min_quantity");
  if (m.max && o[m.max] != null && quantity > Number(o[m.max])) throw new RscError(400, "limit_exceeded", "above_max_quantity");
  return { cost: price, name: String(o[m.name || "name"] ?? o.name ?? o.title ?? offerId) };
}

// ---- documented status model ----
const FAIL_AR: Record<string, string> = {
  out_of_stock: "نفد المخزون", stock_short: "الكمية المتوفرة غير كافية", price_changed: "تغيّر السعر", offer_gone: "العرض لم يعد متاحاً",
  account_problem: "مشكلة في الحساب المُدخل", region_restricted: "المنتج غير متاح في منطقتك", limit_exceeded: "تجاوز الحد المسموح",
  timed_out: "انتهت مهلة التنفيذ", cancelled: "أُلغي الطلب", declined: "رُفض الطلب",
};
export const failMessage = (code?: string) => (code && FAIL_AR[code]) || "تعذّر تنفيذ الطلب";
export type Outcome = { action: "wait" | "complete" | "refund"; codes?: unknown; failCode?: string; providerStatus?: string };
export function classifyOrder(o: any): Outcome {
  const s = String(o?.status || "").toLowerCase();
  if (s === "created" || s === "processing") return { action: "wait" };
  if (s === "completed") return { action: "complete", codes: o.codes ?? o.keys ?? null };
  if (s === "failed" || s === "refund") return { action: "refund", failCode: o.fail_code, providerStatus: s };
  throw new RscError(502, "unknown_status", "unknown_provider_status");
}

// Customer-safe catalog (provider cost is converted to LAMHA sell price; cost never leaves the server)
export function listOf(json: any, key?: string): any[] { return Array.isArray(json) ? json : (key ? json?.[key] : json?.data) || []; }

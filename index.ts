// LAMHA Worker — all sensitive logic is server-side. Secrets come from env only.
import { rscFetch } from "./rsc.ts";
import * as F from "./features.ts";
import type { Env, User } from "./core.ts";
import { HttpError, json, sb, rpc, audit, auth, requireAdmin } from "./core.ts";
export type { Env };

// ---------- Crypto ----------
const enc = new TextEncoder();
async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const hex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
export function safeEq(a: string, b: string) { // constant-time
  if (a.length !== b.length) return false; let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
export async function verifySignature(secret: string, body: string, sig: string) {
  return safeEq(b64(await hmac(secret, body)), sig.trim()); // Ezone docs: Base64 of HMAC-SHA256(raw body), key = SecretKey string
}
async function sha256Hex(s: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))); }

// ---------- Handlers ----------
async function walletGet(e: Env, u: User) {
  const [w] = await sb<any[]>(e, `wallets?user_id=eq.${u.id}&select=balance`);
  const tx = await sb(e, `wallet_transactions?user_id=eq.${u.id}&select=id,kind,amount,balance_after,ref_type,ref_id,created_at&order=id.desc&limit=100`);
  return json({ balance: w?.balance ?? 0, currency: "USD", transactions: tx });
}

// exact 2-decimal USD parser (rejects 1.005, NaN, exponent forms)
export function parseUsd(v: unknown): number | null {
  const t = String(v ?? "").trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t); return n > 0 ? n : null;
}

async function topup(e: Env, u: User, req: Request) {
  if (!u.confirmed) throw new HttpError(403, "email_not_confirmed");
  const { amount: raw, return_url } = (await req.json()) as { amount: number | string; return_url?: string };
  const amount = parseUsd(raw);
  const [min, max] = await Promise.all(["topup_min_usd", "topup_max_usd"].map(async k => Number((await sb<any[]>(e, `app_settings?key=eq.${k}&select=value`))[0].value)));
  if (amount === null || amount < min || amount > max) throw new HttpError(400, `amount_must_be_between_${min}_and_${max}`);
  // Ezone requires Customer details when MaxUsageCount = 1 (one-time link, so a link can never be paid twice)
  const [pr] = await sb<any[]>(e, `profiles?id=eq.${u.id}&select=full_name,phone`);
  const parts = String(pr?.full_name || "").trim().split(/\s+/);
  if (parts.length < 2 || !pr?.phone) throw new HttpError(400, "profile_incomplete");
  const [p] = await sb<any[]>(e, "payments", { method: "POST", prefer: "return=representation", body: JSON.stringify({ user_id: u.id, purpose: "wallet_topup", amount_usd: amount }) });
  const self = new URL(req.url).origin; let back = `${self}/`;
  try { const ru = new URL(String(return_url || "")); if (originAllowed(e, ru.origin, self)) back = `${ru.origin}${ru.pathname}`; } catch { /* keep default */ }
  const r = await fetch(`${e.EZONE_BASE_URL}/payment-link/new`, {
    method: "POST", headers: { "X-API-Key": e.EZONE_PAY_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      Title: "LAMHA wallet top-up", OrderReference: p.id, IsUniqueOrderReference: true, InternalReference: p.id, Amount: amount, Currency: 2 /* USD */, Note: "wallet_topup",
      ExpiresAt: new Date(Date.now() + 3600_000).toISOString(), MaxUsageCount: 1, Customer: { FirstName: parts[0], LastName: parts.slice(1).join(" "), PhoneNumber: pr.phone }, RedirectUrl: `${back}?topup=return`,
    }),
  });
  const d: any = await r.json().catch(() => ({}));
  // The docs say "Created payment link" without the exact response shape: accept the documented detail field name (Link) in either casing, else fail loudly.
  const link = d?.Link ?? d?.link ?? d?.data?.Link ?? d?.data?.link ?? null;
  if (!r.ok || typeof link !== "string" || !/^https:\/\//.test(link)) { await sb(e, `payments?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) }); throw new HttpError(502, "payment_link_failed"); }
  await sb(e, `payments?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ link_url: link, provider_ref: String(d?.Id ?? d?.id ?? "") || null }) });
  return json({ payment_id: p.id, url: link });
}

async function ezoneWebhook(e: Env, req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("X-Signature") || "";
  if (!sig || !(await verifySignature(e.EZONE_PAY_WEBHOOK_SECRET, raw, sig))) throw new HttpError(401, "bad_signature");
  let p: any; try { p = JSON.parse(raw); } catch { throw new HttpError(400, "bad_json"); }
  const evt = Number(p.event ?? p.Event); const tx = p.transactionId ?? p.TransactionId;
  const eventId = tx != null ? `${tx}_${evt}` : await sha256Hex(raw);
  try { await sb(e, "webhook_events", { method: "POST", body: JSON.stringify({ provider: "ezone", event_id: eventId, payload: p }) }); }
  catch (x) {
    if (!(x instanceof HttpError && x.status === 409)) throw x;
    // seen before: only skip if it was fully processed; otherwise a retry must be allowed to finish (crash-safe)
    const [ev] = await sb<any[]>(e, `webhook_events?provider=eq.ezone&event_id=eq.${encodeURIComponent(eventId)}&select=processed_at`);
    if (ev?.processed_at) return json({ ok: true, duplicate: true });
  }
  const ref = String(p.orderReference ?? p.OrderReference ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return json({ ok: true, ignored: true });
  // Docs: the only event is Paid (value 2). The payload carries no amount, so the amount credited is always OUR payments row.
  if (evt !== 2) return json({ ok: true, ignored: true });
  const result = await rpc(e, "settle_topup", { p_payment: ref }); // atomic: mark paid + credit wallet + notify
  await sb(e, `webhook_events?provider=eq.ezone&event_id=eq.${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify({ processed_at: new Date().toISOString() }) });
  return json({ ok: true, result });
}

// ReSellCodes read-only catalog (whitelisted paths only; documented Bearer auth; 429 handled in rscFetch)
const CATALOG = [/^\/gift-cards\/(brands|categories)$/, /^\/gift-cards\/categories\/[\w-]+\/cards$/, /^\/game-keys$/, /^\/game-keys\/[\w-]+\/keys$/, /^\/game-keys\/[\w-]+\/region-restriction$/,
  /^\/top-ups\/(brands|categories)$/, /^\/top-ups\/categories\/[\w-]+\/offers$/, /^\/steam-gifts\/games$/, /^\/steam-gifts\/games\/\d+$/, /^\/steam-topup\/rates$/, /^\/telegram\/(stars|premium)$/, /^\/manual-services$/, /^\/manual-services\/[\w-]+\/offers$/];
async function catalog(e: Env, path: string, url: URL) {
  if (!CATALOG.some(r => r.test(path))) throw new HttpError(404, "not_found");
  const query: Record<string, string> = {}; for (const k of ["q", "region", "platform", "limit", "cursor"]) { const v = url.searchParams.get(k); if (v) query[k] = v.slice(0, 100); }
  return json(await rscFetch(e, path, { query })); // raw provider cost: the customer UI must not show it; use /api/catalog-priced once mapping is confirmed
}

async function myOrders(e: Env, u: User) { // never returns cost; never returns codes
  return json(await sb(e, `orders?user_id=eq.${u.id}&select=number,service,status,total_usd,paid_usd,created_at,order_items(name,qty,unit_price),order_status_history(status,created_at)&order=number.desc&limit=100`));
}

// ---------- Admin ----------
async function admin(e: Env, u: User, req: Request, path: string) {
  const body = req.method === "GET" ? null : await req.json() as any;
  if (path === "admin/settings" && req.method === "GET") { await requireAdmin(e, u, "settings"); return json(await sb(e, "app_settings?select=*")); }
  if (path === "admin/settings" && req.method === "PUT") {
    await requireAdmin(e, u, "settings");
    const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw new HttpError(400, "bad_value"); return n; };
    const rules: Record<string, [number, number]> = { shein_deposit_pct: [1, 100], shein_shipping_usd: [0, 1e4], shein_extra_fee_usd: [0, 1e4], topup_min_usd: [0.01, 1e5], topup_max_usd: [0.01, 1e6] };
    if (!rules[body.key]) throw new HttpError(400, "unknown_key");
    const v = num(body.value, ...rules[body.key]);
    await sb(e, "app_settings?on_conflict=key", { method: "POST", prefer: "resolution=merge-duplicates", body: JSON.stringify({ key: body.key, value: v }) });
    await audit(e, u.id, "setting.update", body.key, { v }); return json({ ok: true });
  }
  if (path === "admin/pricing" && req.method === "PUT") {
    await requireAdmin(e, u, "pricing");
    if (!["global", "service", "product"].includes(body.scope)) throw new HttpError(400, "bad_scope");
    const percent = Number(body.percent ?? 0), fixed = Number(body.fixed_usd ?? 0);
    if (!(percent >= 0 && percent <= 1000 && fixed >= 0 && fixed <= 1e5)) throw new HttpError(400, "bad_value");
    await sb(e, "pricing_rules?on_conflict=scope,scope_key", { method: "POST", prefer: "resolution=merge-duplicates", body: JSON.stringify({ scope: body.scope, scope_key: body.scope === "global" ? "" : String(body.scope_key || ""), percent, fixed_usd: fixed }) });
    await audit(e, u.id, "pricing.update", body.scope, body); return json({ ok: true });
  }
  if (path === "admin/services" && req.method === "PUT") {
    await requireAdmin(e, u, "services");
    const patch: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.requires_verification === "boolean") patch.requires_verification = body.requires_verification;
    if (!Object.keys(patch).length || !/^[a-z_]+$/.test(String(body.key))) throw new HttpError(400, "bad_input");
    await sb(e, `services?key=eq.${body.key}`, { method: "PATCH", body: JSON.stringify(patch) });
    await audit(e, u.id, "service.update", body.key, patch); return json({ ok: true });
  }
  if (path === "admin/staff" && req.method === "PUT") { // only super_admin
    if ((await requireAdmin(e, u, "staff")) !== "super_admin") throw new HttpError(403, "forbidden");
    const target = String(body.user_id);
    if (!/^[0-9a-f-]{36}$/i.test(target)) throw new HttpError(400, "bad_id");
    const [t] = await sb<any[]>(e, `user_roles?user_id=eq.${target}&select=role`);
    if (t?.role === "super_admin") throw new HttpError(403, "owner_protected");
    if (body.remove) await sb(e, `user_roles?user_id=eq.${target}`, { method: "DELETE" });
    else await sb(e, "user_roles?on_conflict=user_id", { method: "POST", prefer: "resolution=merge-duplicates", body: JSON.stringify({ user_id: target, role: "admin", permissions: (body.permissions || []).filter((p: string) => ["orders", "products", "verification", "support", "finance", "settings", "pricing", "services"].includes(p)) }) });
    await audit(e, u.id, "staff.update", target, body); return json({ ok: true });
  }
  throw new HttpError(404, "not_found");
}

// CORS: same-origin always works; other browser origins only if listed in ALLOWED_ORIGINS. The Ezone webhook is server-to-server (no CORS needed).
// The setting is parsed tolerantly: any http(s) URL inside it counts (commas/spaces/newlines, trailing slash, a path, upper case, and even
// markdown like "[https://x](https://x)" pasted from a chat). Each entry is reduced to scheme+host, which is what a browser sends as Origin.
export function parseOrigins(v?: string): string[] {
  const out: string[] = [];
  for (const m of (v || "").matchAll(/https?:\/\/[^\s,;\]\[()"'<>]+/gi)) { try { out.push(new URL(m[0]).origin.toLowerCase()); } catch { /* skip junk */ } }
  return out;
}
export function originAllowed(e: Env, origin: string, selfOrigin: string): boolean {
  const o = origin.toLowerCase(); return o === selfOrigin.toLowerCase() || parseOrigins(e.ALLOWED_ORIGINS).includes(o);
}
function withCors(req: Request, e: Env, res: Response): Response {
  const origin = req.headers.get("origin"); const h = new Headers(res.headers); h.set("x-content-type-options", "nosniff");
  if (origin) {
    h.set("vary", "Origin");
    if (originAllowed(e, origin, new URL(req.url).origin)) {
      h.set("access-control-allow-origin", origin); h.set("access-control-allow-headers", "authorization, content-type"); h.set("access-control-allow-methods", "GET, POST, PUT, PATCH, OPTIONS"); h.set("access-control-max-age", "86400");
    }
  }
  return new Response(res.body, { status: res.status, headers: h });
}

async function handle(req: Request, e: Env): Promise<Response> {
  const url = new URL(req.url); const path = url.pathname.replace(/^\/api\//, "");
  if (!url.pathname.startsWith("/api/")) return e.ASSETS ? e.ASSETS.fetch(req) : new Response("not found", { status: 404 });
  try {
    if (path === "health") { const q = url.searchParams.get("origin"); return json(q ? { ok: true, origin_allowed: originAllowed(e, q, url.origin) } : { ok: true }); }
    if (path === "config") return new Response(JSON.stringify({ supabase_url: e.SUPABASE_URL, publishable_key: e.SUPABASE_PUBLISHABLE_KEY }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } }); // public values only
    if (path === "webhooks/ezone" && req.method === "POST") return await ezoneWebhook(e, req);
    const u = await auth(e, req);
    if (path === "wallet" && req.method === "GET") return await walletGet(e, u);
    if (path === "wallet/topup" && req.method === "POST") return await topup(e, u, req);
    if (path === "orders" && req.method === "GET") return await myOrders(e, u);
    if (path.startsWith("catalog/") && req.method === "GET") return await catalog(e, path.slice(7), url);
    if (path === "shop/categories" && req.method === "GET") return await F.shopCategories(e, url);
    if (path === "shop/offers" && req.method === "GET") return await F.shopOffers(e, url);
    if (path === "orders" && req.method === "POST") return await F.placeProviderOrder(e, u, await req.json());
    const om = path.match(/^orders\/(\d+)(\/codes)?$/); if (om && req.method === "GET") return om[2] ? await F.orderCodes(e, u, om[1]) : await F.orderDetail(e, u, om[1]);
    if (path === "shein/cart" && req.method === "POST") return await F.sheinCart(u, await req.json());
    if (path === "shein/quote" && req.method === "POST") return await F.sheinQuote(e, u, await req.json());
    if (path === "shein/order" && req.method === "POST") return await F.sheinOrder(e, u, await req.json());
    if (path === "notifications") return req.method === "POST" ? await F.readNotifications(e, u) : await F.notifications(e, u);
    if (path === "support") return req.method === "POST" ? await F.supportCreate(e, u, await req.json()) : await F.supportList(e, u);
    if (path === "verification" && req.method === "POST") return await F.verificationUpload(e, u, req);
    if (path === "profile" && req.method === "PATCH") {
      const b: any = await req.json(); const name = String(b.full_name || "").trim().replace(/\s+/g, " "); const phone = String(b.phone || "").trim();
      if (name.split(" ").length < 2 || name.length > 80 || !/^\+?\d{8,15}$/.test(phone)) throw new HttpError(400, "bad_input");
      await sb(e, `profiles?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ full_name: name, phone }) }); return json({ ok: true });
    }
    if (path === "me") {
      let profile: any = null;
      let staff: any = null;
      let staffError: string | null = null;
      try {
        const [p] = await sb<any[]>(e, `profiles?id=eq.${u.id}&select=*`);
        profile = p ?? null;
      } catch {
        profile = null;
      }
      try {
        const [r] = await sb<any[]>(e, `user_roles?user_id=eq.${u.id}&select=role,permissions`);
        staff = r ?? null;
      } catch (err: any) {
        staff = null;
        staffError = err?.message || "roles_query_failed";
      }
      return json({ id: u.id, email: u.email, confirmed: u.confirmed, profile, staff, ...(staffError ? { staff_error: staffError } : {}) });
    }
    if (path.startsWith("admin/")) { const x = await F.adminExtra(e, u, req, path); if (x) return x; return await admin(e, u, req, path); }
    throw new HttpError(404, "not_found");
  } catch (x) {
    if (x instanceof HttpError) return json({ error: x.message.startsWith("db:") ? "server_error" : x.message }, x.status);
    console.error("unhandled", (x as Error).message); return json({ error: "server_error" }, 500);
  }
}

export default {
  async scheduled(_c: unknown, e: Env) { try { await F.pollProcessing(e); } catch (x) { console.error("cron", (x as Error).message); } },
  async fetch(req: Request, e: Env): Promise<Response> {
    if (req.method === "OPTIONS" && new URL(req.url).pathname.startsWith("/api/")) {
      const r = withCors(req, e, new Response(null, { status: 204 }));
      return r.headers.has("access-control-allow-origin") ? r : new Response(null, { status: 403 });
    }
    return withCors(req, e, await handle(req, e));
  },
};

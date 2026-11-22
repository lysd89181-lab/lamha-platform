// Orders (ReSellCodes + SHEIN), notifications, support, verification, admin lists. All sensitive logic server-side.
import type { Env, User } from "./core.ts";
import { HttpError, json, sb, rpc, audit, requireAdmin } from "./core.ts";
import { RscError, rscFetch, orderRequest, fieldMap, pickOffer, parseUsd4, classifyOrder, failMessage, listOf, catMap, fieldDefs, validateFields, rscCached } from "./rsc.ts";
import { getCart, cartView, selectItems, ShareLinkError } from "./shein.ts";

const needEmail = (u: User) => { if (!u.confirmed) throw new HttpError(403, "email_not_confirmed"); };
const notify = (e: Env, user_id: string, title: string, body?: string) => sb(e, "notifications", { method: "POST", body: JSON.stringify({ user_id, title, body }) });
const key = (v: unknown) => { const k = String(v ?? ""); if (!/^[\w-]{8,80}$/.test(k)) throw new HttpError(400, "idempotency_key_required"); return k; };
function dbErr(x: unknown): never {
  const m = String((x as Error).message || "");
  for (const c of ["insufficient_funds", "service_disabled", "verification_required", "out_of_limits", "bad_input"]) if (m.includes(c)) throw new HttpError(c === "insufficient_funds" ? 402 : c === "bad_input" ? 400 : 403, c);
  throw x;
}
const rscToHttp = (x: unknown) => x instanceof RscError ? new HttpError(x.status === 0 || x.status >= 500 ? 502 : x.status === 501 ? 501 : x.status === 429 ? 503 : x.status === 400 || x.status === 404 ? x.status : 409, x.type === "not_found" ? "category_not_found" : x.type) : x;

// ---------- ReSellCodes order lifecycle ----------
// 1) price from provider offer (server-side)  2) atomic wallet debit + order (DB computes sell price)
// 3) claim paid->processing (only one winner)  4) provider POST  5) poll/sync -> complete or refund (idempotent)
export async function placeProviderOrder(e: Env, u: User, body: any, f: typeof fetch = fetch) {
  needEmail(u); const idem = key(body.idempotency_key); const service = String(body.service);
  const req = orderRequest(service, body); // validates documented body; 501 for unsupported services
  const m = fieldMap(e, service);
  const offerPath = service === "gift_cards" ? `/gift-cards/categories/${encodeURIComponent(req.body.category_id)}/cards`
    : service === "game_keys" ? `/game-keys/${encodeURIComponent(req.body.game_id)}/keys` : `/top-ups/categories/${encodeURIComponent(req.body.category_id)}/offers`;
  const offerId = String(req.body.card_id ?? req.body.key_id ?? req.body.offer_id);
  let offer; try {
    const oj = await rscFetch(e, offerPath, {}, f); offer = pickOffer(oj, offerId, m, req.quantity);
    if (service === "top_ups") { const defs = fieldDefs(oj, m); if (defs) validateFields(defs, req.body.fields); }
  } catch (x) { throw rscToHttp(x); }
  let orderId: string;
  try { orderId = await rpc(e, "place_wallet_order", { p_user: u.id, p_service: service, p_product: `${service}:${offerId}`, p_name: offer.name, p_qty: req.quantity, p_unit_cost: offer.cost, /* decimal string */ p_key: idem }); } catch (x) { dbErr(x); }
  if (!(await rpc(e, "claim_order", { p_order: orderId! }))) return json({ order_id: orderId!, status: "already_processing" }); // duplicate request: never calls the provider twice
  const [po] = await sb<any[]>(e, "provider_orders", { method: "POST", prefer: "return=representation", body: JSON.stringify({ order_id: orderId!, provider: "resellcodes", status: "sending" }) });
  try {
    const res = await rscFetch(e, req.path, { method: "POST", body: req.body }, f);
    const number = res?.[m.order_number];
    if (number == null) throw new RscError(502, "unmapped_response", "order_number_missing");
    await sb(e, `provider_orders?id=eq.${po.id}`, { method: "PATCH", body: JSON.stringify({ external_ref: String(number), status: String(res.status ?? "created"), raw: { status: res.status } }) });
    await sb(e, `orders?id=eq.${orderId!}`, { method: "PATCH", body: JSON.stringify({ provider_order_ref: String(number) }) });
    await applyOutcome(e, orderId!, u.id, res);
    return json({ order_id: orderId!, status: "processing" });
  } catch (x) {
    if (x instanceof RscError && x.definite) { // provider rejected: nothing was executed there -> refund the customer once
      await sb(e, `provider_orders?id=eq.${po.id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected", raw: { type: x.type } }) });
      await rpc(e, "refund_order", { p_order: orderId!, p_reason: `provider_rejected:${x.type}` });
      throw new HttpError(409, x.type === "rate_limited" ? "provider_busy_retry_later" : "provider_rejected");
    }
    // unknown outcome (5xx / network / unmapped): do NOT retry and do NOT refund automatically; admin reviews
    await sb(e, `provider_orders?id=eq.${po.id}`, { method: "PATCH", body: JSON.stringify({ status: "needs_review" }) });
    await audit(e, u.id, "provider.needs_review", orderId!, { reason: (x as Error).message });
    return json({ order_id: orderId!, status: "processing", note: "under_review" }, 202);
  }
}

// Apply a provider order object to our order. Safe to call repeatedly (refund + status guarded in DB).
export async function applyOutcome(e: Env, orderId: string, userId: string, providerOrder: any) {
  const o = classifyOrder(providerOrder);
  const charged = Number(providerOrder?.charged_usd);
  if (o.action !== "refund" && Number.isFinite(charged) && charged > 0) await sb(e, `orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ cost_usd: charged }) }); // real cost for profit reports
  if (o.action === "wait") return "wait";
  if (o.action === "complete") {
    await sb(e, `provider_orders?order_id=eq.${orderId}&provider=eq.resellcodes`, { method: "PATCH", body: JSON.stringify({ status: "completed", delivered_codes: o.codes == null ? null : JSON.stringify(o.codes) }) });
    const done = await sb<any[]>(e, `orders?id=eq.${orderId}&status=eq.processing`, { method: "PATCH", prefer: "return=representation", body: JSON.stringify({ status: "completed", updated_at: new Date().toISOString() }) });
    if (done?.length) { await sb(e, "order_status_history", { method: "POST", body: JSON.stringify({ order_id: orderId, status: "completed" }) }); await notify(e, userId, "اكتمل طلبك", o.codes ? "أكوادك جاهزة في صفحة الطلب" : "تم التسليم"); }
    return "completed";
  }
  await sb(e, `provider_orders?order_id=eq.${orderId}&provider=eq.resellcodes`, { method: "PATCH", body: JSON.stringify({ status: o.providerStatus === "failed" ? "failed_check_refund" : "refunded", raw: { fail_code: o.failCode ?? null, provider_status: o.providerStatus } }) });
  await rpc(e, "refund_order", { p_order: orderId, p_reason: `provider:${o.failCode ?? "failed"}` }); // LAMHA wallet refund is independent of ReSellCodes' own refund
  await notify(e, userId, "فشل الطلب", failMessage(o.failCode));
  return "refunded";
}

export async function syncOrder(e: Env, orderId: string, f: typeof fetch = fetch) {
  const [o] = await sb<any[]>(e, `orders?id=eq.${orderId}&select=id,user_id,status,provider_order_ref`);
  if (!o || o.status !== "processing" || !o.provider_order_ref) return "skip";
  const res = await rscFetch(e, `/orders/${encodeURIComponent(o.provider_order_ref)}`, {}, f);
  return applyOutcome(e, o.id, o.user_id, res);
}

export async function orderDetail(e: Env, u: User, number: string) {
  if (!/^\d+$/.test(number)) throw new HttpError(400, "bad_number");
  const [o] = await sb<any[]>(e, `orders?number=eq.${number}&user_id=eq.${u.id}&select=id,number,service,status,total_usd,paid_usd,created_at,updated_at,order_items(name,qty,unit_price),order_status_history(status,note,created_at)`);
  if (!o) throw new HttpError(404, "not_found"); // ownership enforced: others' orders look nonexistent
  if (o.status === "processing" && Date.now() - Date.parse(o.updated_at) > 15000) { try { await syncOrder(e, o.id); } catch { /* shown next poll */ } }
  return json({ ...o, remaining_usd: o.service === "shein" ? Number((o.total_usd - o.paid_usd).toFixed(2)) : 0 });
}
export async function orderCodes(e: Env, u: User, number: string) {
  if (!/^\d+$/.test(number)) throw new HttpError(400, "bad_number");
  const [o] = await sb<any[]>(e, `orders?number=eq.${number}&user_id=eq.${u.id}&status=eq.completed&select=id`);
  if (!o) throw new HttpError(404, "not_found");
  const [p] = await sb<any[]>(e, `provider_orders?order_id=eq.${o.id}&provider=eq.resellcodes&select=delivered_codes`);
  return json({ codes: p?.delivered_codes ? JSON.parse(p.delivered_codes) : null });
}

// ---------- SHEIN ----------
async function sheinView(link: unknown) {
  try { return cartView(await getCart(String(link || ""), { currency: "USD" })); }
  catch (x) { if (x instanceof ShareLinkError) throw new HttpError(x.status === 503 ? 503 : x.status >= 500 ? 502 : x.status, `shein_${x.code}`); throw x; }
}
const hide = (t: any) => ({ items: t.items.map((i: any) => ({ ref: i.ref, name: i.name, qty: i.qty, unit_price: i.price })), items_total: t.items_total, shipping: t.shipping, fees: t.fees, total: t.total, deposit: t.deposit, remaining: t.remaining }); // never cost/margin
export async function sheinCart(u: User, body: any) { needEmail(u); return json(await sheinView(body.link)); }
export async function sheinQuote(e: Env, u: User, body: any) {
  needEmail(u); const v = await sheinView(body.link);
  let items; try { items = selectItems(v.items, body.quantities); } catch (x) { if (x instanceof ShareLinkError) throw new HttpError(x.status, x.code); throw x; }
  return json({ ...hide(await rpc(e, "shein_totals", { p_items: items })), notice: "prices_not_guaranteed" });
}
export async function sheinOrder(e: Env, u: User, body: any) {
  needEmail(u); const idem = key(body.idempotency_key); const v = await sheinView(body.link);
  let items; try { items = selectItems(v.items, body.quantities); } catch (x) { if (x instanceof ShareLinkError) throw new HttpError(x.status, x.code); throw x; }
  const t = await rpc(e, "shein_totals", { p_items: items });
  if (Number(body.expected_total) !== Number(t.total)) throw new HttpError(409, "price_changed"); // customer must re-confirm the new total
  try { return json(await rpc(e, "place_shein_order", { p_user: u.id, p_items: items, p_key: idem, p_meta: { group_id: v.cart.groupId, site: v.cart.site, currency: v.cart.currency } })); } catch (x) { dbErr(x); }
}

// ---------- notifications / support / verification ----------
export const notifications = async (e: Env, u: User) => json(await sb(e, `notifications?user_id=eq.${u.id}&select=id,title,body,read,created_at&order=id.desc&limit=50`));
export const readNotifications = async (e: Env, u: User) => { await sb(e, `notifications?user_id=eq.${u.id}&read=eq.false`, { method: "PATCH", body: JSON.stringify({ read: true }) }); return json({ ok: true }); };
export async function supportCreate(e: Env, u: User, b: any) {
  const subject = String(b.subject || "").trim().slice(0, 120), text = String(b.body || "").trim().slice(0, 2000);
  if (subject.length < 3 || text.length < 5) throw new HttpError(400, "bad_input");
  let order_id = null; if (b.order_number) { const [o] = await sb<any[]>(e, `orders?number=eq.${Number(b.order_number)}&user_id=eq.${u.id}&select=id`); if (!o) throw new HttpError(404, "order_not_found"); order_id = o.id; }
  await sb(e, "support_tickets", { method: "POST", body: JSON.stringify({ user_id: u.id, order_id, subject, body: text }) }); return json({ ok: true }, 201);
}
export const supportList = async (e: Env, u: User) => json(await sb(e, `support_tickets?user_id=eq.${u.id}&select=id,subject,status,created_at&order=id.desc&limit=50`));
export async function verificationUpload(e: Env, u: User, req: Request) {
  needEmail(u); const type = req.headers.get("content-type") || ""; const ext = ({ "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" } as Record<string, string>)[type];
  if (!ext) throw new HttpError(415, "unsupported_type");
  const buf = await req.arrayBuffer(); if (!buf.byteLength || buf.byteLength > 5_000_000) throw new HttpError(413, "file_size");
  const [pr] = await sb<any[]>(e, `profiles?id=eq.${u.id}&select=verification_status`);
  if (pr?.verification_status === "pending" || pr?.verification_status === "verified") throw new HttpError(409, "already_" + pr.verification_status);
  const path = `${u.id}/${Date.now()}.${ext}`;
  const r = await fetch(`${e.SUPABASE_URL}/storage/v1/object/verification/${path}`, { method: "POST", headers: { apikey: e.SUPABASE_SECRET_KEY, authorization: `Bearer ${e.SUPABASE_SECRET_KEY}`, "content-type": type }, body: buf });
  if (!r.ok) throw new HttpError(502, "upload_failed");
  await sb(e, "verification_requests", { method: "POST", body: JSON.stringify({ user_id: u.id, document_path: path }) });
  await sb(e, `profiles?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ verification_status: "pending" }) });
  return json({ ok: true }, 201);
}

// ---------- admin (RBAC enforced here; RLS is the second layer) ----------
const LISTS: Record<string, { perm: string; sel: string; order: string }> = {
  customers: { perm: "support", sel: "profiles?select=id,full_name,phone,verification_status,created_at", order: "created_at.desc" },
  orders: { perm: "orders", sel: "orders?select=id,number,user_id,service,status,total_usd,cost_usd,paid_usd,provider_order_ref,created_at", order: "number.desc" },
  payments: { perm: "finance", sel: "payments?select=id,user_id,purpose,amount_usd,status,created_at,paid_at", order: "created_at.desc" },
  transactions: { perm: "finance", sel: "wallet_transactions?select=id,user_id,kind,amount,balance_after,ref_type,ref_id,created_at", order: "id.desc" },
  tickets: { perm: "support", sel: "support_tickets?select=id,user_id,order_id,subject,body,status,created_at", order: "id.desc" },
  verifications: { perm: "verification", sel: "verification_requests?select=id,user_id,status,note,created_at", order: "id.desc" },
  provider_orders: { perm: "orders", sel: "provider_orders?select=id,order_id,provider,external_ref,status,created_at", order: "id.desc" }, // delivered_codes never listed
  audit: { perm: "settings", sel: "admin_audit_logs?select=*", order: "id.desc" },
  pricing: { perm: "pricing", sel: "pricing_rules?select=*", order: "id.asc" },
  services: { perm: "services", sel: "services?select=*", order: "key.asc" },
  staff: { perm: "staff", sel: "user_roles?select=*", order: "user_id.asc" },
};
export async function adminExtra(e: Env, u: User, req: Request, path: string): Promise<Response | null> {
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^admin\/list\/(\w+)$/)) && req.method === "GET") {
    const l = LISTS[m[1]]; if (!l) throw new HttpError(404, "not_found"); await requireAdmin(e, u, l.perm);
    return json(await sb(e, `${l.sel}&order=${l.order}&limit=200`));
  }
  if (path === "admin/stats" && req.method === "GET") { await requireAdmin(e, u, "orders"); return json(await rpc(e, "admin_stats", {})); } // one SQL aggregate round trip
  if ((m = path.match(/^admin\/orders\/([0-9a-f-]{36})\/(sync|fail|processing|complete)$/)) && req.method === "POST") {
    await requireAdmin(e, u, "orders"); const [id, act] = [m[1], m[2]];
    const [o] = await sb<any[]>(e, `orders?id=eq.${id}&select=id,user_id,service,status`); if (!o) throw new HttpError(404, "not_found");
    if (act === "sync") { try { return json({ result: await syncOrder(e, id) }); } catch (x) { throw rscToHttp(x); } }
    if (act === "fail") { const r = await rpc(e, "refund_order", { p_order: id, p_reason: "admin" }); await audit(e, u.id, "order.fail_refund", id, { r }); return json({ result: r }); }
    if (o.service !== "shein") throw new HttpError(409, "manual_only_for_shein"); // provider orders move only via provider status
    const [from, to] = act === "processing" ? ["paid", "processing"] : ["processing", "completed"];
    const ch = await sb<any[]>(e, `orders?id=eq.${id}&status=eq.${from}`, { method: "PATCH", prefer: "return=representation", body: JSON.stringify({ status: to, updated_at: new Date().toISOString() }) });
    if (!ch?.length) throw new HttpError(409, "bad_transition");
    await sb(e, "order_status_history", { method: "POST", body: JSON.stringify({ order_id: id, status: to, note: "admin" }) }); await notify(e, o.user_id, to === "completed" ? "تم تسليم طلب SHEIN" : "بدأ شراء طلبك"); await audit(e, u.id, `order.${to}`, id, {});
    return json({ ok: true });
  }
  if ((m = path.match(/^admin\/orders\/([0-9a-f-]{36})\/candidates$/)) && req.method === "GET") {
    await requireAdmin(e, u, "orders");
    const [o] = await sb<any[]>(e, `orders?id=eq.${m[1]}&select=id,service,status,cost_usd,provider_order_ref,created_at`);
    if (!o || o.status !== "processing" || o.provider_order_ref) throw new HttpError(409, "not_unlinked");
    const TYPE: Record<string, string> = { gift_cards: "gift_card", top_ups: "game_topup" }; const t0 = Date.parse(o.created_at);
    const list = (await rscFetch(e, "/orders", { query: { limit: 30 } })).data || [];
    const linked = new Set((await sb<any[]>(e, "provider_orders?provider=eq.resellcodes&external_ref=not.is.null&select=external_ref")).map(x => x.external_ref));
    const cents = (v: unknown) => Math.round(Number(v) * 10000);
    const c = list.filter((x: any) => !linked.has(String(x.number)) && (!TYPE[o.service] || x.type === TYPE[o.service]) && cents(x.charged_usd) === cents(o.cost_usd) && Math.abs(Date.parse(x.created_at) - t0) < 15 * 60_000)
      .map((x: any) => ({ number: x.number, type: x.type, status: x.status, charged_usd: x.charged_usd, created_at: x.created_at, name: x.offer_name ?? x.card_name ?? x.category_name ?? null }));
    return json({ candidates: c, note: c.length === 1 ? "single_match_verify_before_linking" : c.length ? "ambiguous_do_not_guess" : "none_found" });
  }
  if ((m = path.match(/^admin\/orders\/([0-9a-f-]{36})\/link$/)) && req.method === "POST") {
    await requireAdmin(e, u, "orders"); const num = String(((await req.json()) as any).number ?? ""); if (!/^\d+$/.test(num)) throw new HttpError(400, "bad_input");
    const [o] = await sb<any[]>(e, `orders?id=eq.${m[1]}&select=id,status,provider_order_ref`); if (!o || o.status !== "processing" || o.provider_order_ref) throw new HttpError(409, "not_unlinked");
    try { await sb(e, `provider_orders?order_id=eq.${m[1]}&provider=eq.resellcodes`, { method: "PATCH", body: JSON.stringify({ external_ref: num, status: "linked" }) }); } catch (x) { if (x instanceof HttpError && x.status === 409) throw new HttpError(409, "number_already_linked"); throw x; }
    await sb(e, `orders?id=eq.${m[1]}`, { method: "PATCH", body: JSON.stringify({ provider_order_ref: num }) }); await audit(e, u.id, "order.link_provider", m[1], { number: num });
    try { return json({ result: await syncOrder(e, m[1]) }); } catch (x) { throw rscToHttp(x); }
  }
  if ((m = path.match(/^admin\/verifications\/(\d+)$/)) && req.method === "POST") {
    await requireAdmin(e, u, "verification"); const b = (await req.json()) as any; const ok = b.decision === "approve";
    if (!ok && b.decision !== "reject") throw new HttpError(400, "bad_input");
    const [v] = await sb<any[]>(e, `verification_requests?id=eq.${m[1]}&status=eq.pending&select=user_id`); if (!v) throw new HttpError(409, "not_pending");
    await sb(e, `verification_requests?id=eq.${m[1]}`, { method: "PATCH", body: JSON.stringify({ status: ok ? "approved" : "rejected", reviewed_by: u.id, note: String(b.note || "").slice(0, 300) }) });
    await sb(e, `profiles?id=eq.${v.user_id}`, { method: "PATCH", body: JSON.stringify({ verification_status: ok ? "verified" : "rejected" }) });
    await notify(e, v.user_id, ok ? "تم توثيق حسابك" : "تم رفض طلب التوثيق", b.note); await audit(e, u.id, "verification." + b.decision, m[1], {}); return json({ ok: true });
  }
  if ((m = path.match(/^admin\/verifications\/(\d+)\/document$/)) && req.method === "GET") {
    await requireAdmin(e, u, "verification"); const [v] = await sb<any[]>(e, `verification_requests?id=eq.${m[1]}&select=document_path`); if (!v) throw new HttpError(404, "not_found");
    const r = await fetch(`${e.SUPABASE_URL}/storage/v1/object/sign/verification/${v.document_path}`, { method: "POST", headers: { apikey: e.SUPABASE_SECRET_KEY, authorization: `Bearer ${e.SUPABASE_SECRET_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 120 }) });
    const d: any = await r.json().catch(() => ({})); if (!r.ok || !d.signedURL) throw new HttpError(502, "sign_failed");
    await audit(e, u.id, "verification.view", m[1], {}); return json({ url: `${e.SUPABASE_URL}/storage/v1${d.signedURL}` });
  }
  if ((m = path.match(/^admin\/tickets\/(\d+)\/close$/)) && req.method === "POST") { await requireAdmin(e, u, "support"); await sb(e, `support_tickets?id=eq.${m[1]}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) }); await audit(e, u.id, "ticket.close", m[1], {}); return json({ ok: true }); }
  return null;
}

// Cron: poll processing provider orders (ReSellCodes documents no webhook, only GET /orders/{number})
export async function pollProcessing(e: Env, f: typeof fetch = fetch) {
  const rows = await sb<any[]>(e, "orders?status=eq.processing&provider_order_ref=not.is.null&select=id&order=updated_at.asc&limit=10");
  let n = 0; for (const r of rows) { try { await syncOrder(e, r.id, f); n++; } catch (x) { if (x instanceof RscError && x.status === 429) break; } }
  return n;
}

// ---------- customer shop (normalized; needs RESELLCODES_FIELD_MAP, otherwise 501) ----------
const SHOP: Record<string, { cats: string; offers: (id: string) => string }> = {
  top_ups: { cats: "/top-ups/categories", offers: id => `/top-ups/categories/${encodeURIComponent(id)}/offers` },
  gift_cards: { cats: "/gift-cards/categories", offers: id => `/gift-cards/categories/${encodeURIComponent(id)}/cards` },
  game_keys: { cats: "/game-keys", offers: id => `/game-keys/${encodeURIComponent(id)}/keys` },
};
async function enabled(e: Env, service: string) { const [s] = await sb<any[]>(e, `services?key=eq.${service}&select=enabled,requires_verification`); if (!s?.enabled) throw new HttpError(403, "service_disabled"); return s; }
export async function shopCategories(e: Env, url: URL, f: typeof fetch = fetch) {
  const service = url.searchParams.get("service") || ""; const sh = SHOP[service]; if (!sh) throw new HttpError(400, "bad_service");
  await enabled(e, service); const c = catMap(e, service);
  const q = url.searchParams.get("q")?.trim().slice(0, 60) || undefined; let j; try { j = await rscCached(e, sh.cats, { q, limit: 60 }, 60_000, f); } catch (x) { throw rscToHttp(x); }
  // images are provider-relative paths; only accept the documented media path so nothing arbitrary is rendered
  const rawCats = listOf(j, c.list).slice(0, 60); const okCats = rawCats.filter((x: any) => x && typeof x[c.id] === "string" && x[c.id]);
  if (rawCats.length && !okCats.length) throw new HttpError(502, "unexpected_provider_shape");
  return json({ total: j?.total ?? null, items: okCats.map((x: any) => ({ id: String(x[c.id]), name: String(x[c.name] ?? x[c.id]), image: c.image && typeof x[c.image] === "string" && x[c.image].startsWith("/api/media/") ? "https://resell.codes" + x[c.image] : null })) });
}
export async function shopOffers(e: Env, url: URL, f: typeof fetch = fetch) {
  const service = url.searchParams.get("service") || ""; const id = url.searchParams.get("id") || ""; const sh = SHOP[service];
  if (!sh || !/^[\w-]{1,100}$/.test(id)) throw new HttpError(400, "bad_input");
  await enabled(e, service); const m = fieldMap(e, service); let j; try { j = await rscCached(e, sh.offers(id), {}, 30_000, f); } catch (x) { throw rscToHttp(x); }
  const rows = listOf(j, m.list).slice(0, 60).filter((o: any) => o && o[m.id] != null && o[m.price] != null);
  const out = await Promise.all(rows.map(async (o: any) => {
    const oid = String(o[m.id]); let cost: string; try { cost = parseUsd4(o[m.price]); } catch { return null; }
    const price = await rpc(e, "sell_price", { p_cost: cost, p_service: service, p_product: `${service}:${oid}` });
    const stock = m.stock && o[m.stock] != null ? Number(o[m.stock]) : null;
    return { id: oid, name: String(o[m.name || "name"] ?? o.name ?? oid), price_usd: Number(price), stock, min: m.min && o[m.min] != null ? Number(o[m.min]) : 1, max: m.max && o[m.max] != null ? Number(o[m.max]) : 100, available: stock == null || stock > 0 };
  }));
  const offers = out.filter(Boolean);
  if (listOf(j, m.list).length && !offers.length) throw new HttpError(502, "unexpected_provider_shape"); // items exist but our mapped fields are absent: never show broken data
  let fields: unknown[] = []; try { fields = fieldDefs(j, m) || []; } catch (x) { throw rscToHttp(x); }
  return json({ offers, fields, empty: offers.length === 0 });
}

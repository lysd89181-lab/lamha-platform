// Shared helpers (service-role Supabase access, auth, RBAC). Extracted from index.ts unchanged except exports.
export interface Env {
  SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SECRET_KEY: string;
  EZONE_PAY_API_KEY: string; EZONE_PAY_WEBHOOK_SECRET: string; RESELLCODES_API_KEY: string; RESELLCODES_FIELD_MAP?: string; ALLOWED_ORIGINS?: string;
  EZONE_BASE_URL: string; RESELLCODES_BASE_URL: string;
  ASSETS?: { fetch(r: Request): Promise<Response> };
}
export type User = { id: string; email: string; confirmed: boolean };
export class HttpError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status; } }
export const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const sbUrl = (e: Env) => (e.SUPABASE_URL || "https://lexyiuglleloqmbsoajb.supabase.co").replace(/\/+$/, "");

// ---------- Supabase (service role, server only) ----------
const sbh = (e: Env) => ({ apikey: e.SUPABASE_SECRET_KEY, authorization: `Bearer ${e.SUPABASE_SECRET_KEY}`, "content-type": "application/json" });
export async function sb<T = any>(e: Env, path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const r = await fetch(`${sbUrl(e)}/rest/v1/${path}`, { ...init, headers: { ...sbh(e), ...(init.prefer ? { prefer: init.prefer } : {}) } });
  if (!r.ok) { const t = await r.text(); throw new HttpError(r.status === 409 ? 409 : 500, "db:" + t.slice(0, 200)); }
  const t = await r.text(); return (t ? JSON.parse(t) : null) as T;
}
export const rpc = (e: Env, fn: string, args: object) => sb(e, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
export async function audit(e: Env, actor: string, action: string, target: string, detail: unknown) {
  await sb(e, "admin_audit_logs", { method: "POST", body: JSON.stringify({ actor, action, target, detail }) });
}

// ---------- Auth ----------
export async function auth(e: Env, req: Request): Promise<User> {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  if (!tok) throw new HttpError(401, "unauthorized");
  const r = await fetch(`${sbUrl(e)}/auth/v1/user`, { headers: { apikey: e.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new HttpError(401, "unauthorized");
  const u: any = await r.json();
  return { id: u.id, email: u.email, confirmed: !!u.email_confirmed_at };
}
export async function requireAdmin(e: Env, u: User, perm: string) {
  const [row] = await sb<any[]>(e, `user_roles?user_id=eq.${u.id}&select=role,permissions`);
  if (!row || !(row.role === "super_admin" || row.permissions.includes(perm))) throw new HttpError(403, "forbidden");
  return row.role as string;
}

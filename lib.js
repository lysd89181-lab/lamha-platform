/* LAMHA shared client lib: session, API, helpers. No secrets here: only the PUBLIC Supabase URL/publishable key. */
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (n) => '$' + Number(n || 0).toFixed(2);
const API_BASE = 'https://Lamha.ysymazn58.workers.dev/api';
const FALLBACK_CFG = {
  supabase_url: 'https://lexyiuglleloqmbsoajb.supabase.co',
  publishable_key: 'sb_publishable_1bA5iviTIIwVinR1wwzCOA_7G0f6Ro0',
};
const P = { gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z', game: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17 6H7a5 5 0 0 0-5 5v3a3 3 0 0 0 5.5 1.7L9 14h6l1.5 1.7A3 3 0 0 0 22 14v-3a5 5 0 0 0-5-5z', home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0', wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4zM3 5v14a2 2 0 0 0 2 2h15V7M16 14h.01', box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4', x: 'M18 6 6 18M6 6l12 12' };
const ic = (n) => `<svg class="i" viewBox="0 0 24 24"><path d="${P[n]}"/></svg>`;
const ERR = {
  profile_incomplete: 'أكمل الاسم الكامل (اسمين على الأقل) ورقم الهاتف من صفحة حسابي ثم أعد المحاولة',
  bad_fields: 'بيانات اللاعب غير صحيحة أو ناقصة', category_not_found: 'هذه الفئة غير متاحة الآن، جرّب فئة بديلة', unexpected_provider_shape: 'بيانات المزود غير متوقعة، أبلغ الدعم',
  network: 'تعذّر الاتصال بالخادم، تحقق من الإنترنت', timeout: 'انتهت مهلة الطلب، حاول مرة أخرى', session_expired: 'انتهت الجلسة، سجّل الدخول من جديد',
  unauthorized: 'سجّل الدخول أولاً', forbidden: 'لا تملك الصلاحية', email_not_confirmed: 'يجب تأكيد البريد الإلكتروني أولاً', insufficient_funds: 'رصيد المحفظة لا يكفي',
  service_disabled: 'هذه الخدمة متوقفة حالياً', verification_required: 'هذه الخدمة تتطلب توثيق الحساب', out_of_limits: 'المبلغ خارج الحدود المسموحة',
  price_changed: 'تغيّر السعر، راجع الإجمالي الجديد ثم أكّد من جديد', provider_mapping_unconfirmed: 'الكتالوج غير مفعّل بعد (بانتظار ربط المزود)', provider_rejected: 'رفض المزود الطلب وتم إرجاع المبلغ لمحفظتك',
  provider_busy_retry_later: 'المزود مشغول، أُعيد المبلغ لمحفظتك. حاول بعد قليل', not_found: 'غير موجود', bad_input: 'تحقق من المدخلات', file_size: 'الملف كبير (الحد 5MB)', unsupported_type: 'الصيغة غير مدعومة (JPG/PNG/PDF)',
  already_pending: 'طلب التوثيق قيد المراجعة', already_verified: 'حسابك موثق', payment_link_failed: 'تعذّر إنشاء رابط الدفع', idempotency_key_required: 'خطأ داخلي، أعد المحاولة',
  shein_expired: 'رابط السلة منتهي', shein_bad_link: 'رابط SHEIN غير صالح', shein_risk: 'SHEIN رفضت الطلب مؤقتاً، حاول بعد دقائق', shein_upstream: 'تعذّر قراءة السلة من SHEIN', shein_network: 'تعذّر الوصول إلى SHEIN',
  item_not_orderable: 'منتج غير متاح للطلب', item_sold_out: 'منتج نفد', item_no_usd_price: 'لا يتوفر سعر بالدولار لهذا المنتج', bad_quantity: 'الكمية غير صالحة (1-100)', no_items: 'اختر كمية لمنتج واحد على الأقل', item_not_in_cart: 'المنتج لم يعد في السلة', server_error: 'خطأ في الخادم', offer_gone: 'العرض لم يعد متاحاً', stock_short: 'الكمية المتوفرة غير كافية',
};
const errMsg = (e) => {
  if (e?.debugDetail) return e.debugDetail;
  return ERR[e?.error] || ERR[e?.message] || (e?.error ? 'تعذّر التنفيذ: ' + e.error : e?.message || 'خطأ غير متوقع');
};
function toast(m, bad) { const t = $('#toast'); if (!t) return; t.textContent = m; t.className = bad ? 'bad' : ''; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = 'none'), 4500); }
function modal(h) { const ov = $('#ov'); if (ov) ov.innerHTML = `<div class="ov" data-a="ovclose"><div class="md">${h}</div></div>`; }
const closeM = () => { const ov = $('#ov'); if (ov) ov.innerHTML = ''; };

let CFG = null; let S = null; try { S = JSON.parse(localStorage.getItem('lamha_s') || 'null'); } catch { S = null; }
const cfg = async () => {
  if (CFG) return CFG;
  try {
    const res = await fetchT(API_BASE + '/config', {}, 6000);
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.supabase_url && data.publishable_key) {
      CFG = data;
      return CFG;
    }
  } catch {
    /* fallback when cross-origin fetch to worker config is blocked */
  }
  CFG = FALLBACK_CFG;
  return CFG;
};
// every network call has a timeout, so a loader can never hang forever
async function fetchT(url, init = {}, ms = 20000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    throw {
      status: 0,
      error: isTimeout ? 'timeout' : 'network',
      debugDetail: (isTimeout ? 'انتهت المهلة عند: ' : 'فشل الاتصال عند: ') + url + ' — ' + (e?.message || e?.name || 'FetchError'),
    };
  } finally {
    clearTimeout(t);
  }
}
function setSession(d) { S = d && d.access_token ? { at: d.access_token, rt: d.refresh_token, exp: Date.now() + ((d.expires_in || 3600) - 60) * 1000 } : null; try { S ? localStorage.setItem('lamha_s', JSON.stringify(S)) : localStorage.removeItem('lamha_s'); } catch { /* private mode */ } }
async function authCall(path, body, token) {
  const c = await cfg();
  const r = await fetchT(`${c.supabase_url}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: c.publishable_key,
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.msg || d.error_description || d.message || d.error || ('HTTP ' + r.status));
  return d;
}
const auth = {
  signup: (email, password) => authCall('signup', { email, password }),
  login: async (email, password) => setSession(await authCall('token?grant_type=password', { email, password })),
  recover: (email) => authCall('recover', { email }),
  logout: async () => { try { if (S) await authCall('logout', {}, S.at); } catch { /* ignore */ } setSession(null); },
};
async function refresh() { if (!S) return; try { setSession(await authCall('token?grant_type=refresh_token', { refresh_token: S.rt })); } catch { setSession(null); } }
async function api(path, { method = 'GET', body, raw, type } = {}) {
  if (S && Date.now() > S.exp) await refresh();
  const r = await fetchT(API_BASE + path, {
    method,
    headers: {
      ...(S ? { authorization: 'Bearer ' + S.at } : {}),
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...(type ? { 'content-type': type } : {}),
    },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && S) { setSession(null); document.dispatchEvent(new Event('lamha:expired')); throw { status: 401, error: 'session_expired' }; }
    throw { status: r.status, error: d.error || 'server_error' };
  }
  return d;
}
const STATUS = { pending_payment: ['بانتظار الدفع', 'pg'], paid: ['مدفوع', 'pg'], processing: ['قيد المعالجة', 'pg'], completed: ['مكتمل', 'ok'], failed: ['فشل', 'bad'], refunded: ['مسترد', ''], cancelled: ['ملغي', ''] };
const stTag = (s) => { const [t, c] = STATUS[s] || [s, '']; return `<span class="tag ${c}">${esc(t)}</span>`; };
const fmtDate = (d) => new Date(d).toLocaleString(typeof locale === 'function' ? locale() : 'ar', { dateStyle: 'short', timeStyle: 'short' });
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
async function guard(btn, fn) { if (btn) btn.disabled = true; try { return await fn(); } catch (e) { toast(errMsg(e), true); } finally { if (btn) btn.disabled = false; } }

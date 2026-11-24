/* LAMHA admin. Hiding tabs is cosmetic only: every call is authorized again on the server (RBAC) and by RLS. */
const A = { me: null, tab: 'stats', data: null, err: '' };
const TABS = [['stats', 'الإحصائيات', 'orders'], ['orders', 'الطلبات', 'orders'], ['provider_orders', 'طلبات المزود', 'orders'], ['customers', 'العملاء', 'support'], ['verifications', 'التوثيق', 'verification'], ['payments', 'المدفوعات', 'finance'], ['transactions', 'المعاملات المالية', 'finance'], ['tickets', 'الشكاوى', 'support'], ['settings', 'إعدادات العربون والرسوم', 'settings'], ['pricing', 'التسعير', 'pricing'], ['services', 'الخدمات', 'services'], ['staff', 'المشرفون', 'staff'], ['audit', 'سجل العمليات', 'settings']];
const SET_LABEL = { shein_deposit_pct: 'نسبة عربون SHEIN %', shein_shipping_usd: 'شحن SHEIN (USD)', shein_extra_fee_usd: 'رسوم SHEIN الإضافية (USD)', topup_min_usd: 'أدنى شحن (USD)', topup_max_usd: 'أقصى شحن (USD)' };
const PERMS = ['orders', 'products', 'verification', 'support', 'finance', 'settings', 'pricing', 'services'];
const can = (p) => A.me?.staff && (A.me.staff.role === 'super_admin' || A.me.staff.permissions.includes(p));
const isOwner = () => A.me?.staff?.role === 'super_admin';

function loginView() { return `<div class="hd">${langBtn()}<img src="logo.png" alt="LAMHA" data-notr="1"><span></span></div><div class="pg" style="max-width:420px;margin:auto"><div class="top" style="padding:0 0 12px">دخول الإدارة</div><label class="fld"><span>البريد</span><input id="em" type="email" dir="ltr"></label><label class="fld"><span>كلمة المرور</span><input id="pw" type="password" dir="ltr"></label><button class="btn w" data-a="login">دخول</button></div>`; }
function table(rows, actions) {
  if (!rows?.length) return '<div class="empty">لا توجد بيانات</div>'; const cols = Object.keys(rows[0]);
  return `<div class="tw"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}${actions ? '<th></th>' : ''}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${/_at$/.test(c) && r[c] ? fmtDate(r[c]) : esc(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])}</td>`).join('')}${actions ? `<td>${actions(r)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
const ob = (a, id, t, c = '') => `<button class="btn s ${c}" data-a="${a}" data-id="${esc(id)}">${t}</button> `;
function body() {
  const d = A.data; const t = A.tab; if (A.err) return `<div class="note">${esc(A.err)}</div><button class="btn o" data-a="retry">إعادة المحاولة</button>`; if (d == null) return '<div class="empty">جارٍ التحميل…</div>';
  if (t === 'stats') return `<div class="tabs" style="flex-wrap:wrap">${[['العملاء', d.customers], ['الطلبات', d.orders], ['مدفوعات معلقة', d.pending_payments], ['تحتاج إجراء', d.needs_action], ['الإيراد (USD)', usd(d.revenue_usd)], ['الربح المتوقع (USD)', usd(d.expected_profit_usd)]].map(([k, v]) => `<div class="box" style="min-width:150px;margin:0"><div class="mut">${k}</div><b style="font-size:20px">${esc(v)}</b></div>`).join('')}</div>`;
  if (t === 'orders') return table(d, (r) => (r.service === 'shein' ? (r.status === 'paid' ? ob('o_processing', r.id, 'بدء الشراء') : '') + (r.status === 'processing' ? ob('o_complete', r.id, 'تم التسليم') : '') : r.status === 'processing' ? (r.provider_order_ref ? ob('o_sync', r.id, 'مزامنة', 'o') : ob('o_cands', r.id, 'مطابقة طلب المزود', 'o')) : '') + (['paid', 'processing', 'failed'].includes(r.status) ? ob('o_fail', r.id, 'فشل + استرداد', 'd') : ''));
  if (t === 'provider_orders') return `<div class="note"><div><code>failed_check_refund</code> = <span>رجّعنا المبلغ للعميل لكن المزود قد لا يُرجعه تلقائياً: افتح تذكرة عند ReSellCodes.</span></div><div><code>needs_review</code> = <span>لم نعرف نتيجة الإرسال: طابقه من تبويب الطلبات.</span></div></div>` + table(d);
  if (t === 'verifications') return table(d, (r) => (r.status === 'pending' ? ob('v_view', r.id, 'عرض الوثيقة', 'o') + ob('v_ok', r.id, 'قبول') + ob('v_no', r.id, 'رفض', 'd') : ''));
  if (t === 'tickets') return table(d, (r) => (r.status === 'open' ? ob('t_close', r.id, 'إغلاق') : ''));
  if (t === 'settings') return `<div class="box">${d.map((s) => `<label class="fld"><span>${esc(SET_LABEL[s.key] || s.key)}</span><div style="display:flex;gap:8px"><input id="s_${esc(s.key)}" value="${esc(s.value)}" dir="ltr" inputmode="decimal"><button class="btn s" data-a="set_save" data-id="${esc(s.key)}">حفظ</button></div></label>`).join('')}</div>`;
  if (t === 'pricing') return `<div class="mut" style="margin-bottom:8px">الأولوية: منتج ← خدمة ← عام (لا تُجمع النسب). مفتاح المنتج مثل <span dir="ltr">gift_cards:ID</span> أو <span dir="ltr">shein:ID</span></div>${table(d)}<div class="box" style="margin-top:12px"><div class="sec" style="margin-top:0">إضافة/تعديل قاعدة</div>
    <label class="fld"><span>النطاق</span><select id="p_scope"><option value="global">عام</option><option value="service">خدمة</option><option value="product">منتج</option></select></label><label class="fld"><span>المفتاح (للخدمة/المنتج)</span><input id="p_key" dir="ltr"></label><label class="fld"><span>نسبة الربح %</span><input id="p_pct" value="0" dir="ltr"></label><label class="fld"><span>ربح ثابت USD</span><input id="p_fix" value="0" dir="ltr"></label><button class="btn w" data-a="p_save">حفظ</button></div>`;
  if (t === 'services') return table(d, (r) => ob('sv_en', r.key, r.enabled ? 'إيقاف' : 'تفعيل', r.enabled ? 'd' : '') + ob('sv_ver', r.key, r.requires_verification ? 'إلغاء شرط التوثيق' : 'اشتراط التوثيق', 'o'));
  if (t === 'staff') return table(d, (r) => (isOwner() && r.role !== 'super_admin' ? ob('st_rm', r.user_id, 'حذف', 'd') : '')) + (isOwner() ? `<div class="box" style="margin-top:12px"><div class="sec" style="margin-top:0">إضافة مشرف</div><label class="fld"><span>معرّف المستخدم (UUID)</span><input id="st_id" dir="ltr"></label><div class="tabs" style="flex-wrap:wrap">${PERMS.map((p) => `<label class="tag"><input type="checkbox" class="stp" value="${p}"> ${p}</label>`).join('')}</div><button class="btn w" data-a="st_add">حفظ الصلاحيات</button></div>` : '');
  return table(d);
}
function paint() {
  if (!S) { $('#app').innerHTML = loginView(); return; } if (!A.me) { $('#app').innerHTML = '<div class="empty">جارٍ التحميل…</div>'; return; }
  if (!A.me.staff) {
    const info = `<div dir="ltr" style="margin-top:8px;font-size:12px;opacity:.85">email: ${esc(A.me.email || '')} | id: ${esc(A.me.id || '')}${A.me.staff_error ? ' | err: ' + esc(A.me.staff_error) : ''}</div>`;
    $('#app').innerHTML = `<div class="pg"><div class="note">هذا الحساب ليس من فريق الإدارة.${info}</div><button class="btn o" data-a="out">خروج</button></div>`;
    return;
  }
  $('#app').innerHTML = `<div class="hd"><button data-a="out">خروج</button><img src="logo.png" alt="LAMHA" data-notr="1">${langBtn()}</div><div class="pg"><div class="tabs">${TABS.filter(([, , p]) => can(p)).map(([k, n]) => `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${n}</button>`).join('')}</div>${body()}</div>`;
}
async function load() {
  A.data = null; A.err = ''; paint(); const t = A.tab;
  try { A.data = await api(t === 'stats' ? '/admin/stats' : t === 'settings' ? '/admin/settings' : `/admin/list/${t === 'customers' ? 'customers' : t}`); } catch (e) { A.err = errMsg(e); } paint();
}
const act = (b, fn) => guard(b, async () => { await fn(); toast('تم'); load(); });
const post = (p, body) => api(p, { method: 'POST', body });
const H = {
  lang: () => setLang(nextLang()),
  ovclose: (b, e) => { if (e.target === b) closeM(); }, close: closeM, out: async () => { await auth.logout(); A.me = null; paint(); },
  login: (b) => guard(b, async () => {
    const em = $('#em').value.trim();
    const pw = $('#pw').value;
    if (!em || !pw) return toast('أدخل البريد الإلكتروني وكلمة المرور', true);
    await auth.login(em, pw);
    await boot(true);
  }),
  retry: () => load(),
  tab: (b) => { A.tab = b.dataset.k; load(); },
  o_sync: (b) => act(b, () => post(`/admin/orders/${b.dataset.id}/sync`)), o_fail: (b) => { if (confirm(tt('تأكيد: فشل الطلب واسترداد المبلغ لمحفظة العميل؟'))) act(b, () => post(`/admin/orders/${b.dataset.id}/fail`)); },
  o_cands: (b) => guard(b, async () => { const r = await api(`/admin/orders/${b.dataset.id}/candidates`); modal(`<h3>مطابقة طلب المزود<button data-a="close">${ic('x')}</button></h3><div class="mut" style="margin-bottom:8px">${r.note === 'ambiguous_do_not_guess' ? 'عدة طلبات متشابهة: لا تربط إلا بعد التأكد من لوحة المزود.' : r.note === 'none_found' ? 'لا يوجد طلب مطابق (السعر والنوع والوقت). تحقق من لوحة المزود قبل أي استرداد.' : 'تطابق واحد: تأكد منه قبل الربط.'}</div>${r.candidates.map((c) => `<div class="row"><div class="g"><b>#${esc(c.number)}</b> ${esc(c.name || '')}<div class="mut">${esc(c.type)} · ${esc(c.status)} · $${esc(c.charged_usd)} · ${fmtDate(c.created_at)}</div></div><button class="btn s" data-a="o_link" data-id="${esc(b.dataset.id)}" data-n="${esc(c.number)}">ربط</button></div>`).join('')}`); }),
  o_link: (b) => { closeM(); act(b, () => post(`/admin/orders/${b.dataset.id}/link`, { number: b.dataset.n })); },
  o_processing: (b) => act(b, () => post(`/admin/orders/${b.dataset.id}/processing`)), o_complete: (b) => act(b, () => post(`/admin/orders/${b.dataset.id}/complete`)),
  v_view: (b) => guard(b, async () => { const r = await api(`/admin/verifications/${b.dataset.id}/document`); window.open(r.url, '_blank', 'noopener'); }),
  v_ok: (b) => act(b, () => post(`/admin/verifications/${b.dataset.id}`, { decision: 'approve' })), v_no: (b) => { const note = prompt(tt('سبب الرفض (يظهر للعميل):')) ?? null; if (note !== null) act(b, () => post(`/admin/verifications/${b.dataset.id}`, { decision: 'reject', note })); },
  t_close: (b) => act(b, () => post(`/admin/tickets/${b.dataset.id}/close`)),
  set_save: (b) => act(b, () => api('/admin/settings', { method: 'PUT', body: { key: b.dataset.id, value: $('#s_' + b.dataset.id).value } })),
  p_save: (b) => act(b, () => api('/admin/pricing', { method: 'PUT', body: { scope: $('#p_scope').value, scope_key: $('#p_key').value.trim(), percent: $('#p_pct').value, fixed_usd: $('#p_fix').value } })),
  sv_en: (b) => { const r = A.data.find((x) => x.key === b.dataset.id); act(b, () => api('/admin/services', { method: 'PUT', body: { key: r.key, enabled: !r.enabled } })); },
  sv_ver: (b) => { const r = A.data.find((x) => x.key === b.dataset.id); act(b, () => api('/admin/services', { method: 'PUT', body: { key: r.key, requires_verification: !r.requires_verification } })); },
  st_add: (b) => act(b, () => api('/admin/staff', { method: 'PUT', body: { user_id: $('#st_id').value.trim(), permissions: [...document.querySelectorAll('.stp:checked')].map((x) => x.value) } })),
  st_rm: (b) => { if (confirm(tt('حذف هذا المشرف؟'))) act(b, () => api('/admin/staff', { method: 'PUT', body: { user_id: b.dataset.id, remove: true } })); },
};
document.addEventListener('lamha:lang', () => { closeM(); paint(); });
document.addEventListener('lamha:expired', () => { A.me = null; closeM(); paint(); toast(tt('انتهت الجلسة، سجّل الدخول من جديد'), true); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && H[b.dataset.a]) H[b.dataset.a](b, e); });
async function boot(fromLogin = false) {
  if (!S) return paint();
  try {
    A.me = await api('/me');
  } catch (e) {
    A.me = null;
    if (fromLogin) {
      toast('تم تسجيل الدخول لكن فشل التحقق من الحساب (/me): ' + (e?.error || e?.message || e?.status || 'خطأ'), true);
      paint();
      return;
    }
    setSession(null);
  }
  const first = TABS.find(([, , p]) => can(p));
  if (first) A.tab = first[0];
  paint();
  if (A.me?.staff && first) load();
}
boot();

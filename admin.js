const A = { me: null, tab: 'stats', data: null, err: '' };
const PC = { service: 'all', q: '', f: '', show: 40, catId: '', offSrv: '', cats: [], stats: [], offers: [], rules: [], loading: false, err: '' };
const TABS = [
  ['stats', 'الإحصائيات', 'orders'],
  ['orders', 'الطلبات', 'orders'],
  ['provider_orders', 'طلبات المزود', 'orders'],
  ['provider_catalog', 'المزود والتسعير', 'pricing'],
  ['customers', 'العملاء', 'support'],
  ['verifications', 'التوثيق', 'verification'],
  ['payments', 'المدفوعات', 'finance'],
  ['transactions', 'المعاملات المالية', 'finance'],
  ['tickets', 'الشكاوى', 'support'],
  ['settings', 'إعدادات العربون والرسوم', 'settings'],
  ['pricing', 'التسعير', 'pricing'],
  ['services', 'الخدمات', 'services'],
  ['staff', 'المشرفون', 'staff'],
  ['audit', 'سجل العمليات', 'settings'],
];
const SET_LABEL = { shein_deposit_pct: 'نسبة عربون SHEIN %', shein_shipping_usd: 'شحن SHEIN (USD)', shein_extra_fee_usd: 'رسوم SHEIN الإضافية (USD)', topup_min_usd: 'أدنى شحن (USD)', topup_max_usd: 'أقصى شحن (USD)', rate_default: 'سعر الصرف العام (د.ل لكل 1$) — 0 = عرض بالدولار', rate_wallet: 'صرف المحفظة (د.ل لكل 1$)', rate_gift_cards: 'صرف بطاقات الهدايا (د.ل لكل 1$)', rate_top_ups: 'صرف شحن الألعاب (د.ل لكل 1$)', rate_shein: 'صرف SHEIN (د.ل لكل 1$)' };
const PERMS = ['orders', 'products', 'verification', 'support', 'finance', 'settings', 'pricing', 'services'];
const can = (p) => Boolean(A.me?.staff && (A.me.staff.role === 'super_admin' || (A.me.staff.permissions || []).includes(p)));
const isOwner = () => A.me?.staff?.role === 'super_admin';
const fmtMoney = (v) => (typeof usd === 'function' ? usd(v) : '$' + Number(v || 0).toFixed(2));
const fmtErr = (e) => (typeof errMsg === 'function' ? errMsg(e) : (e?.error || e?.message || String(e || 'خطأ')));

function loginView() {
  return `<div class="hd">${langBtn()}<img src="logo.png" alt="LAMHA" data-notr="1"><span></span></div><div class="pg" style="max-width:420px;margin:auto"><div class="top" style="padding:0 0 12px">دخول الإدارة</div><label class="fld"><span>البريد</span><input id="em" type="email" dir="ltr"></label><label class="fld"><span>كلمة المرور</span><input id="pw" type="password" dir="ltr"></label><button class="btn w" data-a="login">دخول</button></div>`;
}

function table(rows, actions) {
  if (!rows?.length) return '<div class="empty">لا توجد بيانات</div>';
  const cols = Object.keys(rows[0]);
  return `<div class="tw"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}${actions ? '<th></th>' : ''}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td data-l="${esc(c)}">${/_at$/.test(c) && r[c] ? fmtDate(r[c]) : esc(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])}</td>`).join('')}${actions ? `<td data-l="">${actions(r)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

const ob = (a, id, t, c = '') => `<button class="btn s ${c}" data-a="${a}" data-id="${esc(id)}">${t}</button> `;

const SVC_LIST = [['top_ups', 'شحن الألعاب المباشر'], ['gift_cards', 'بطاقات الهدايا']];
const ruleOf = (scope, key) => (PC.rules || []).find((r) => r.scope === scope && (r.scope_key || '') === key);
function rulesPanel() {
  const row = (scope, key, label, i) => { const r = ruleOf(scope, key); return `<tr><td data-l="النطاق">${label}</td><td data-l="ربح %"><input id="rp_${i}" value="${esc(r ? r.percent : 0)}" style="width:70px" dir="ltr" inputmode="decimal"></td><td data-l="ربح ثابت"><input id="rf_${i}" value="${esc(r ? r.fixed_usd : 0)}" style="width:70px" dir="ltr" inputmode="decimal"></td><td data-l=""><button class="btn s" data-a="pc_rule" data-scope="${scope}" data-key="${key}" data-i="${i}">حفظ</button></td></tr>`; };
  return `<div class="box"><div class="sec" style="margin-top:0">نسب الربح لكل الخدمات</div><div class="mut" style="margin-bottom:8px">القاعدة العامة تشمل كل المزودين والخدمات. قاعدة الخدمة تتغلب عليها، وقاعدة المنتج تتغلب على الاثنتين (لا تُجمع النسب).</div>
    <div class="tw"><table><thead><tr><th>النطاق</th><th>ربح %</th><th>ربح ثابت</th><th></th></tr></thead><tbody>${row('global', '', 'عام (كل الخدمات)', 0)}${SVC_LIST.map(([k, l], n) => row('service', k, l, n + 1)).join('')}</tbody></table></div></div>`;
}
function catalogTab() {
  const opts = [['all', 'كل الخدمات (كل المزودين)'], ...SVC_LIST].map(([k, l]) => `<option value="${k}" ${PC.service === k ? 'selected' : ''}>${l}</option>`).join('');
  const tag = (s) => (s === 'product' ? 'قاعدة منتج' : s === 'service' ? 'قاعدة خدمة' : s === 'global' ? 'قاعدة عامة' : 'بدون ربح');
  return rulesPanel() + `
    <div class="box">
      <div class="sec" style="margin-top:0">جلب الخدمات والعروض من المزود</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label class="fld" style="flex:1;min-width:160px;margin:0"><span>الخدمة</span><select id="pc_srv">${opts}</select></label>
        <label class="fld" style="flex:1;min-width:160px;margin:0"><span>بحث</span><input id="pc_q" value="${esc(PC.q)}" placeholder="PUBG, Steam..." dir="ltr"></label>
        <button class="btn w" data-a="pc_cats">جلب التصنيفات</button>
      </div>
      ${PC.err ? `<div class="note" style="margin-top:10px">${esc(PC.err)}</div>` : ''}
    </div>
    <div class="box">
      <div class="sec" style="margin-top:0">التصنيفات (${PC.cats.length})</div>
      ${PC.stats.map((x) => `<div class="mut">${esc(x.service)}: ${x.shown} / ${x.total}${x.complete ? '' : ' — ' + tt('لم يُجلب الكل: استعمل البحث للباقي')}</div>`).join('')}
      ${PC.loading && !PC.cats.length ? '<div class="empty">جارٍ التحميل…</div>' : !PC.cats.length ? '<div class="empty">اضغط جلب التصنيفات</div>' : (() => {
        const q = PC.f.trim().toLowerCase(); const all = q ? PC.cats.filter((c) => (c.id + ' ' + c.name).toLowerCase().includes(q)) : PC.cats; const list = all.slice(0, PC.show);
        return `<div class="pcbar"><input id="pc_f" value="${esc(PC.f)}" placeholder="تصفية النتائج المحملة…" dir="ltr"><span class="mut">${all.length}</span></div>
        <div class="tw"><table><thead><tr><th>الخدمة</th><th>ID</th><th>الاسم</th><th></th></tr></thead><tbody>
          ${list.map((c) => `<tr><td data-l="الخدمة" dir="ltr">${esc(c.service)}</td><td data-l="ID" dir="ltr">${esc(c.id)}</td><td data-l="الاسم" dir="auto">${esc(c.name)}</td><td data-l=""><button class="btn s ${PC.catId === c.id && PC.offSrv === c.service ? '' : 'o'}" data-a="pc_offers" data-id="${esc(c.id)}" data-srv="${esc(c.service)}">جلب العروض</button></td></tr>`).join('')}
        </tbody></table></div>
        ${all.length > list.length ? `<button class="btn o w" style="margin-top:8px" data-a="pc_more">عرض المزيد (${all.length - list.length})</button>` : ''}`; })()}
    </div>
    <div class="box">
      <div class="sec" style="margin-top:0">العروض (${PC.offers.length})${PC.catId ? ` · <span dir="ltr">${esc(PC.catId)}</span>` : ''}</div>
      <div class="mut" style="margin-bottom:8px">الأولوية: منتج ← خدمة ← عام (لا تُجمع النسب). سعر البيع = التكلفة × (1 + النسبة) + الربح الثابت.</div>
      ${PC.loading && PC.cats.length && !PC.offers.length ? '<div class="empty">جارٍ التحميل…</div>' : !PC.offers.length ? '<div class="empty">اختر تصنيفاً لعرض الأسعار وتعديل الربح</div>' : `
        <div class="tw"><table><thead><tr><th>ID</th><th>العرض</th><th>التكلفة</th><th>سعر البيع</th><th>الربح</th><th>القاعدة</th><th>ربح %</th><th>ربح ثابت</th><th></th></tr></thead><tbody>
          ${PC.offers.map((o, i) => `<tr>
            <td data-l="ID" dir="ltr">${esc(o.id)}</td><td data-l="العرض" dir="auto">${esc(o.name)}</td>
            <td data-l="التكلفة" dir="ltr">$${esc(o.cost_usd)}</td><td data-l="سعر البيع" dir="ltr"><b>${esc(fmtMoney(o.price_usd))}</b></td><td data-l="الربح" dir="ltr">$${esc(Number(o.profit_usd).toFixed(4))}</td>
            <td data-l="القاعدة"><span class="tag ${o.rule.scope === 'product' ? 'ok' : ''}">${tag(o.rule.scope)}</span></td>
            <td data-l="ربح %"><input id="pct_${i}" value="${esc(o.rule.percent)}" style="width:70px" dir="ltr" inputmode="decimal"></td>
            <td data-l="ربح ثابت"><input id="fix_${i}" value="${esc(o.rule.fixed_usd)}" style="width:70px" dir="ltr" inputmode="decimal"></td>
            <td data-l="" style="white-space:nowrap"><button class="btn s" data-a="pc_price" data-pid="${esc(o.pid)}" data-idx="${i}">حفظ</button>${o.rule.scope === 'product' ? ` <button class="btn s o" data-a="pc_rm" data-pid="${esc(o.pid)}">إزالة قاعدة المنتج</button>` : ''}</td>
          </tr>`).join('')}
        </tbody></table></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px"><label class="fld" style="margin:0"><span>ربح % لكل العروض</span><input id="bulk_pct" value="0" style="width:90px" dir="ltr" inputmode="decimal"></label><label class="fld" style="margin:0"><span>ربح ثابت</span><input id="bulk_fix" value="0" style="width:90px" dir="ltr" inputmode="decimal"></label><button class="btn" data-a="pc_bulk">تطبيق على كل عروض التصنيف</button></div>`}
    </div>
  `;
}

function body() {
  if (A.tab === 'provider_catalog') return catalogTab();
  if (A.err) return `<div class="note">${esc(A.err)}</div><button class="btn o" data-a="retry">إعادة المحاولة</button>`;
  if (A.data == null) return '<div class="empty">جارٍ التحميل…</div>';
  const d = A.data;
  const t = A.tab;
  if (t === 'stats') return `<div class="tabs" style="flex-wrap:wrap">${[['العملاء', d.customers], ['الطلبات', d.orders], ['مدفوعات معلقة', d.pending_payments], ['تحتاج إجراء', d.needs_action], ['الإيراد (USD)', fmtMoney(d.revenue_usd)], ['الربح المتوقع (USD)', fmtMoney(d.expected_profit_usd)]].map(([k, v]) => `<div class="box" style="min-width:150px;margin:0"><div class="mut">${k}</div><b style="font-size:20px">${esc(v)}</b></div>`).join('')}</div>`;
  if (t === 'orders') return table(d, (r) => (r.service === 'shein' ? (r.status === 'paid' ? ob('o_processing', r.id, 'بدء الشراء') : '') + (r.status === 'processing' ? ob('o_complete', r.id, 'تم التسليم') : '') : r.status === 'processing' ? (r.provider_order_ref ? ob('o_sync', r.id, 'مزامنة', 'o') : ob('o_cands', r.id, 'مطابقة طلب المزود', 'o')) : '') + (['paid', 'processing', 'failed'].includes(r.status) ? ob('o_fail', r.id, 'فشل + استرداد', 'd') : ''));
  if (t === 'provider_orders') return `<div class="note"><div><code>failed_check_refund</code> = <span>رجّعنا المبلغ للعميل لكن المزود قد لا يُرجعه تلقائياً: افتح تذكرة عند ReSellCodes.</span></div><div><code>needs_review</code> = <span>لم نعرف نتيجة الإرسال: طابقه من تبويب الطلبات.</span></div></div>` + table(d);
  if (t === 'verifications') return table(d, (r) => (r.status === 'pending' ? ob('v_view', r.id, 'عرض الوثيقة', 'o') + ob('v_ok', r.id, 'قبول') + ob('v_no', r.id, 'رفض', 'd') : ''));
  if (t === 'tickets') return table(d, (r) => (r.status === 'open' ? ob('t_close', r.id, 'إغلاق') : ''));
  if (t === 'settings') return `<div class="box">${d.map((s) => `<label class="fld"><span>${esc(SET_LABEL[s.key] || s.key)}</span><div style="display:flex;gap:8px"><input id="s_${esc(s.key)}" value="${esc(s.value)}" dir="ltr" inputmode="decimal"><button class="btn s" data-a="set_save" data-id="${esc(s.key)}">حفظ</button></div></label>`).join('')}</div>`;
  if (t === 'pricing') return `<div class="mut" style="margin-bottom:8px">الأولوية: منتج ← خدمة ← عام (لا تُجمع النسب). مفتاح المنتج مثل <span dir="ltr">gift_cards:ID</span> أو <span dir="ltr">shein:ID</span></div>${table(d)}<div class="box" style="margin-top:12px"><div class="sec" style="margin-top:0">إضافة/تعديل قاعدة</div><label class="fld"><span>النطاق</span><select id="p_scope"><option value="global">عام</option><option value="service">خدمة</option><option value="product">منتج</option></select></label><label class="fld"><span>المفتاح (للخدمة/المنتج)</span><input id="p_key" dir="ltr"></label><label class="fld"><span>نسبة الربح %</span><input id="p_pct" value="0" dir="ltr"></label><label class="fld"><span>ربح ثابت USD</span><input id="p_fix" value="0" dir="ltr"></label><button class="btn w" data-a="p_save">حفظ</button></div>`;
  if (t === 'services') return table(d, (r) => ob('sv_en', r.key, r.enabled ? 'إيقاف' : 'تفعيل', r.enabled ? 'd' : '') + ob('sv_ver', r.key, r.requires_verification ? 'إلغاء شرط التوثيق' : 'اشتراط التوثيق', 'o'));
  if (t === 'staff') return table(d, (r) => (isOwner() && r.role !== 'super_admin' ? ob('st_rm', r.user_id, 'حذف', 'd') : '')) + (isOwner() ? `<div class="box" style="margin-top:12px"><div class="sec" style="margin-top:0">إضافة مشرف</div><label class="fld"><span>معرّف المستخدم (UUID)</span><input id="st_id" dir="ltr"></label><div class="tabs" style="flex-wrap:wrap">${PERMS.map((p) => `<label class="tag"><input type="checkbox" class="stp" value="${p}"> ${p}</label>`).join('')}</div><button class="btn w" data-a="st_add">حفظ الصلاحيات</button></div>` : '');
  return table(d);
}

function paint() {
  const el = $('#app');
  if (!el) return;
  if (!S) { el.innerHTML = loginView(); return; }
  if (!A.me) { el.innerHTML = '<div class="empty">جارٍ التحميل…</div>'; return; }
  if (!A.me.staff) {
    el.innerHTML = `<div class="pg"><div class="note">هذا الحساب ليس من فريق الإدارة.</div><button class="btn o" data-a="out">خروج</button></div>`;
    return;
  }
  el.innerHTML = `<div class="hd"><button data-a="out">خروج</button><img src="logo.png" alt="LAMHA" data-notr="1">${langBtn()}</div><div class="pg"><div class="tabs">${TABS.filter(([, , p]) => can(p)).map(([k, n]) => `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${n}</button>`).join('')}</div>${body()}</div>`;
}

async function load() {
  if (A.tab === 'provider_catalog') { paint(); pcLoadRules(); return; }
  A.data = null; A.err = ''; paint();
  const t = A.tab;
  try {
    A.data = await api(t === 'stats' ? '/admin/stats' : t === 'settings' ? '/admin/settings' : `/admin/list/${t === 'customers' ? 'customers' : t}`);
  } catch (e) {
    A.err = fmtErr(e);
  }
  paint();
}

const act = (b, fn) => guard(b, async () => { await fn(); toast('تم'); load(); });
const post = (p, body) => api(p, { method: 'POST', body });

async function pcLoadRules() { try { PC.rules = (await api('/admin/list/pricing')) || []; } catch (e) { PC.err = fmtErr(e); } paint(); }
async function pcLoadOffers() {
  PC.err = ''; PC.loading = true; paint();
  try { PC.offers = (await api(`/admin/provider/offers?${new URLSearchParams({ service: PC.offSrv || PC.service, id: PC.catId })}`))?.offers || []; if (!PC.offers.length) PC.err = tt('لا توجد عروض نشطة لهذا التصنيف الآن'); }
  catch (e) { PC.offers = []; PC.err = fmtErr(e); }
  PC.loading = false; paint();
}
const H = {
  lang: () => setLang(nextLang()),
  ovclose: (b, e) => { if (e.target === b) closeM(); },
  close: closeM,
  out: async () => { await auth.logout(); A.me = null; paint(); },
  login: (b) => guard(b, async () => {
    const em = $('#em').value.trim();
    const pw = $('#pw').value;
    if (!em || !pw) return toast('أدخل البريد الإلكتروني وكلمة المرور', true);
    await auth.login(em, pw);
    await boot(true);
  }),
  retry: () => load(),
  tab: (b) => { A.tab = b.dataset.k; load(); },
  pc_cats: async () => {
    PC.service = $('#pc_srv')?.value || PC.service; PC.q = $('#pc_q')?.value.trim() || ''; PC.f = ''; PC.show = 40;
    PC.err = ''; PC.loading = true; PC.catId = ''; PC.offers = []; PC.cats = []; PC.stats = []; paint();
    const targets = PC.service === 'all' ? SVC_LIST.map((x) => x[0]) : [PC.service];
    const res = await Promise.allSettled(targets.map(async (srv) => { const qs = new URLSearchParams({ service: srv }); if (PC.q) qs.set('q', PC.q); const r = await api(`/admin/provider/categories?${qs}`); return { srv, r }; }));
    for (const x of res) if (x.status === 'fulfilled') { const { srv, r } = x.value; PC.cats.push(...(r.items || []).map((c) => ({ ...c, service: srv }))); PC.stats.push({ service: srv, shown: (r.items || []).length, total: r.total, complete: r.complete }); }
    PC.err = res.map((x, i) => (x.status === 'rejected' ? `${targets[i]}: ${fmtErr(x.reason)}` : '')).filter(Boolean).join(' | ') || (PC.cats.length ? '' : tt('لا توجد تصنيفات مطابقة'));
    PC.loading = false; paint();
  },
  pc_more: () => { PC.show += 60; paint(); },
  pc_offers: async (b) => { PC.catId = b.dataset.id; PC.offSrv = b.dataset.srv; await pcLoadOffers(); },
  pc_rule: (b) => guard(b, async () => {
    const i = b.dataset.i; const percent = $(`#rp_${i}`)?.value.trim(), fixed_usd = $(`#rf_${i}`)?.value.trim(); const num = /^\d{1,5}(\.\d{1,2})?$/;
    if (!num.test(percent) || !num.test(fixed_usd)) return toast(tt('قيمة غير صالحة (أرقام فقط، حتى منزلتين عشريتين)'), true);
    await api('/admin/pricing', { method: 'PUT', body: { scope: b.dataset.scope, scope_key: b.dataset.key, percent, fixed_usd } }); toast(tt('تم حفظ الربح')); await pcLoadRules(); if (PC.catId) await pcLoadOffers(); else paint();
  }),
  pc_bulk: (b) => { const percent = $('#bulk_pct')?.value.trim(), fixed_usd = $('#bulk_fix')?.value.trim(); const num = /^\d{1,5}(\.\d{1,2})?$/;
    if (!num.test(percent) || !num.test(fixed_usd)) return toast(tt('قيمة غير صالحة (أرقام فقط، حتى منزلتين عشريتين)'), true);
    if (confirm(tt('تطبيق هذه النسبة على كل عروض التصنيف؟') + ' (' + PC.offers.length + ')')) guard(b, async () => { await api('/admin/pricing/bulk', { method: 'POST', body: { keys: PC.offers.map((o) => o.pid), percent, fixed_usd } }); toast(tt('تم حفظ الربح')); await pcLoadOffers(); }); },
  pc_price: (b) => guard(b, async () => {
    const i = b.dataset.idx; const percent = $(`#pct_${i}`)?.value.trim(), fixed_usd = $(`#fix_${i}`)?.value.trim(); const num = /^\d{1,5}(\.\d{1,2})?$/;
    if (!num.test(percent) || !num.test(fixed_usd)) return toast(tt('قيمة غير صالحة (أرقام فقط، حتى منزلتين عشريتين)'), true);
    await api('/admin/pricing', { method: 'PUT', body: { scope: 'product', scope_key: b.dataset.pid, percent, fixed_usd } }); toast(tt('تم حفظ الربح')); await pcLoadOffers();
  }),
  pc_rm: (b) => { if (confirm(tt('إزالة قاعدة هذا المنتج؟ سيعود لقاعدة الخدمة أو العامة.'))) guard(b, async () => { await api('/admin/pricing/remove', { method: 'POST', body: { scope: 'product', scope_key: b.dataset.pid } }); toast(tt('تمت الإزالة')); await pcLoadOffers(); }); },
  o_sync: (b) => act(b, () => post(`/admin/orders/${b.dataset.id}/sync`)),
  o_fail: (b) => { if (confirm(tt('تأكيد: فشل الطلب واسترداد المبلغ لمحفظة العميل؟'))) act(b, () => post(`/admin/orders/${b.dataset.id}/fail`)); },
  o_cands: (b) => guard(b, async () => {
    const r = await api(`/admin/orders/${b.dataset.id}/candidates`);
    modal(`<h3>مطابقة طلب المزود<button data-a="close">${ic('x')}</button></h3><div class="mut" style="margin-bottom:8px">${r.note === 'ambiguous_do_not_guess' ? 'عدة طلبات متشابهة: لا تربط إلا بعد التأكد من لوحة المزود.' : r.note === 'none_found' ? 'لا يوجد طلب مطابق (السعر والنوع والوقت). تحقق من لوحة المزود قبل أي استرداد.' : 'تطابق واحد: تأكد منه قبل الربط.'}</div>${r.candidates.map((c) => `<div class="row"><div class="g"><b>#${esc(c.number)}</b> ${esc(c.name || '')}<div class="mut">${esc(c.type)} · ${esc(c.status)} · $${esc(c.charged_usd)} · ${fmtDate(c.created_at)}</div></div><button class="btn s" data-a="o_link" data-id="${esc(b.dataset.id)}" data-n="${esc(c.number)}">ربط</button></div>`).join('')}`);
  }),
  o_link: (b) => { closeM(); act(b, () => post(`/admin/orders/${b.dataset.id}/link`, { number: b.dataset.n })); },
  o_processing: (b) => act(b, () => post(`/admin/orders/${b.dataset.id}/processing`)),
  o_complete: (b) => act(b, () => post(`/admin/orders/${b.dataset.id}/complete`)),
  v_view: (b) => guard(b, async () => { const r = await api(`/admin/verifications/${b.dataset.id}/document`); window.open(r.url, '_blank', 'noopener'); }),
  v_ok: (b) => act(b, () => post(`/admin/verifications/${b.dataset.id}`, { decision: 'approve' })),
  v_no: (b) => { const note = prompt(tt('سبب الرفض (يظهر للعميل):')) ?? null; if (note !== null) act(b, () => post(`/admin/verifications/${b.dataset.id}`, { decision: 'reject', note })); },
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
document.addEventListener('input', (e) => { if (e.target.id !== 'pc_f') return; const pos = e.target.selectionStart; PC.f = e.target.value; PC.show = 40; paint(); const el = $('#pc_f'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* ignore */ } } });
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

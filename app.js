/* LAMHA customer app. Every number shown comes from the server; prices are never computed or trusted client-side. */
const st = { tab: 'shop', authMode: 'login', me: null, shop: { service: 'gift_cards', cats: null, cat: null, offers: null, q: '', err: '' }, sh: { link: '', cart: null, items: [], q: {}, quote: null, err: '' }, wallet: null, orders: null, tickets: null };
const TABS = [['shop', 'الرئيسية', 'home'], ['shein', 'SHEIN', 'bag'], ['wallet', 'المحفظة', 'wallet'], ['orders', 'طلباتي', 'box'], ['acc', 'حسابي', 'user']];
const SVC = { gift_cards: 'بطاقات الهدايا', top_ups: 'شحن الألعاب المباشر' };
const VER = { unverified: 'غير موثق', pending: 'قيد المراجعة', verified: 'موثق', rejected: 'مرفوض' };
const head = (bell = true) => `<div class="hd">${langBtn()}<img src="logo.png" alt="لمحة LAMHA" data-notr="1">${bell ? `<button data-a="notifs" aria-label="الإشعارات">${ic('bell')}</button>` : '<span style="width:32px"></span>'}</div>`;

function authView() {
  const m = st.authMode; const title = { login: 'تسجيل الدخول', signup: 'إنشاء حساب', forgot: 'استعادة كلمة المرور' }[m];
  return `${head(false)}<div class="pg"><div class="top" style="padding:0 0 12px">${title}</div>
  <label class="fld"><span>البريد الإلكتروني</span><input id="em" type="email" autocomplete="email" dir="ltr"></label>
  ${m !== 'forgot' ? `<label class="fld"><span>كلمة المرور</span><input id="pw" type="password" autocomplete="${m === 'login' ? 'current-password' : 'new-password'}" dir="ltr"></label>` : ''}
  <button class="btn w" data-a="authgo">${title}</button><div style="margin-top:14px;display:flex;gap:14px;justify-content:center" class="mut">
  ${m !== 'login' ? '<button data-a="mode" data-m="login">لدي حساب</button>' : '<button data-a="mode" data-m="signup">إنشاء حساب</button><button data-a="mode" data-m="forgot">نسيت كلمة المرور</button>'}</div></div>`;
}
async function loadMe() { try { st.me = await api('/me'); } catch { st.me = null; } }

/* ---------- shop ---------- */
async function loadCats() { const s = st.shop; s.cats = null; s.cat = null; s.offers = null; s.err = ''; paint(); try { const r = await api('/shop/categories?service=' + s.service + (s.q.trim() ? '&q=' + encodeURIComponent(s.q.trim()) : '')); s.cats = r.items; s.total = r.total; } catch (e) { s.err = errMsg(e); s.cats = []; } paint(); }
async function loadOffers(id) { const s = st.shop; s.cat = id; s.offers = null; paint(); try { const r = await api(`/shop/offers?service=${s.service}&id=${encodeURIComponent(id)}`); s.offers = r.offers; s.fields = r.fields || []; } catch (e) { s.err = errMsg(e); s.offers = []; } paint(); }
function shopView() {
  const s = st.shop; let body = '';
  if (s.err) body = `<div class="note">${esc(s.err)}</div>`;
  else if (s.cat != null) body = `<button class="btn o s" data-a="catback">رجوع</button><div class="sec">العروض</div>` + (s.offers == null ? '<div class="empty">جارٍ التحميل…</div>' : s.offers.length ? s.offers.map((o) => `<div class="row"><div class="g"><b>${esc(o.name)}</b><div class="mut">${o.available ? (o.stock != null ? 'متوفر: ' + o.stock : 'متوفر') : 'نفد المخزون'}</div></div><div style="text-align:left"><b>${usd(o.price_usd)}</b><br><button class="btn s" data-a="buy" data-id="${esc(o.id)}" ${o.available ? '' : 'disabled'}>شراء</button></div></div>`).join('') : '<div class="empty">لا توجد باقات نشطة لهذه الفئة الآن.<br>جرّب فئة بديلة من نفس اللعبة (مثل manual أو reserve) بالرجوع للقائمة.</div>');
  else body = s.cats == null ? '<div class="empty">جارٍ التحميل…</div>' : (s.cats.length ? (s.total > s.cats.length ? `<div class="mut" style="margin-bottom:8px">يُعرض ${s.cats.length} من ${s.total}. استعمل البحث للوصول لباقي التصنيفات.</div>` : '') + s.cats.map((c) => `<button class="row" style="width:100%;text-align:right" data-a="cat" data-id="${esc(c.id)}">${c.image ? `<img class="th" src="${esc(c.image)}" alt="" data-n="${esc(c.name)}" referrerpolicy="no-referrer" style="width:44px;height:44px">` : ''}<span class="g"><b>${esc(c.name)}</b></span></button>`).join('') : '<div class="empty">لا توجد نتائج</div>');
  const TILE = { gift_cards: 'gift', top_ups: 'game' };
  return `${head()}<div class="pg"><div class="ban"><b>اشحن رصيدك واستمتع بمشترياتك الرقمية!</b><button class="btn" data-a="tab" data-k="wallet">ابدأ الآن</button></div>
  <div class="sec" style="margin-top:0">أقسام المنتجات</div><div class="cats">${Object.entries(SVC).map(([k, n]) => `<button class="cat ${s.service === k ? 'on' : ''}" data-a="svc" data-k="${k}">${ic(TILE[k])}${n}</button>`).join('')}<button class="cat" data-a="tab" data-k="shein">${ic('bag')}SHEIN</button></div>
  ${s.cat == null ? `<label class="fld"><input id="sq" placeholder="ابحث…" value="${esc(s.q)}"></label>` : ''}${body}</div>`;
}
function buyModal(o) {
  const key = uuid(); const max = Math.max(1, Math.min(o.max || 100, o.stock ?? 100)); const direct = st.shop.service === 'top_ups';
  modal(`<h3>${esc(o.name)}<button data-a="close">${ic('x')}</button></h3><div class="box"><div class="kv"><span>${direct ? 'السعر' : 'سعر الوحدة'}</span><b>${usd(o.price_usd)}</b></div>
  ${direct ? (st.shop.fields || []).map((f) => `<label class="fld"><span>${esc(f.label)}</span><input class="pf" data-k="${esc(f.key)}" maxlength="100" autocomplete="off" dir="ltr"></label>`).join('') + '<div class="mut">تأكد من صحة البيانات: لا يمكن تعديلها بعد التأكيد.</div>' : `<label class="fld"><span>الكمية</span><input id="bq" type="number" min="${o.min || 1}" max="${max}" value="${o.min || 1}"></label>`}<div class="kv t"><span>الإجمالي</span><b id="bt">${usd(o.price_usd * (direct ? 1 : (o.min || 1)))}</b></div></div>
  <div class="mut" style="margin-bottom:10px">يُخصم من رصيد محفظتك. السعر النهائي يؤكده الخادم.</div><button class="btn w" data-a="buygo" data-id="${esc(o.id)}" data-key="${key}">تأكيد الشراء</button>`);
  if (!direct) $('#bq').addEventListener('input', (e) => { $('#bt').textContent = usd(o.price_usd * (Number(e.target.value) || 0)); });
}

/* ---------- SHEIN ---------- */
function sheinView() {
  const s = st.sh; let h = `${head()}<div class="pg"><div class="note">أسعار SHEIN لقطة من السلة وقت القراءة وغير مضمونة. السعر النهائي يُؤكَّد قبل الطلب، ولا يمكن تعديل الطلب بعد دفع العربون.</div>
  <label class="fld"><span>رابط مشاركة سلة SHEIN</span><input id="shl" dir="ltr" value="${esc(s.link)}" placeholder="https://onelink.shein.com/..."></label><button class="btn w" data-a="shcart">قراءة السلة</button>`;
  if (s.err) h += `<div class="err">${esc(s.err)}</div>`;
  if (s.cart) {
    h += `<div class="sec">${esc(s.cart.title || 'السلة')}</div><div class="mut" style="margin-bottom:8px">العملة التي أعادتها SHEIN: ${esc(s.cart.currency?.shown || '؟')} · الأسعار المعتمدة بالدولار فقط · الكميات يحددها العميل</div>`;
    h += s.items.map((i) => { const q = s.q[i.key] || 0; return `<div class="row">${i.image ? `<img class="th" src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">` : '<div class="th"></div>'}<div class="g"><b>${esc(i.name)}</b><div class="mut">${esc(i.attr)}</div>
      ${i.unitUsdCents != null ? `<div><b>${usd(i.unitUsdCents / 100)}</b> ${i.savingsUsdCents ? `<s class="mut">${usd(i.originalUsdCents / 100)}</s> <span class="tag ok">وفّر ${usd(i.savingsUsdCents / 100)} (${esc(i.discountPercent)}%)</span>` : ''}</div>${i.savingsUsdCents ? '<div class="mut">مصدر الخصم غير مؤكد (قد لا يكون متاحاً للجميع)</div>' : ''}` : '<div class="mut">لا يتوفر سعر بالدولار</div>'}
      ${i.orderable ? `<div class="q" style="margin-top:6px"><button data-a="qm" data-k="${esc(i.key)}">−</button><b>${q}</b><button data-a="qp" data-k="${esc(i.key)}">+</button></div>` : `<span class="tag bad">${i.orderableReason === 'sold_out' ? 'نفد' : i.orderableReason === 'unavailable' ? 'غير متوفر' : 'غير قابل للطلب'}</span>`}</div></div>`; }).join('');
    h += `<button class="btn w" data-a="shquote">احسب الإجمالي</button>`;
  }
  if (s.quote) { const t = s.quote; h += `<div class="box" style="margin-top:12px">${t.items.map((i) => `<div class="kv"><span>${esc(i.name)} ×${i.qty}</span><span>${usd(i.unit_price * i.qty)}</span></div>`).join('')}
    <div class="kv"><span>الشحن</span><span>${usd(t.shipping)}</span></div><div class="kv"><span>الرسوم</span><span>${usd(t.fees)}</span></div><div class="kv t"><span>الإجمالي</span><span>${usd(t.total)}</span></div>
    <div class="kv"><span>العربون المطلوب الآن</span><b>${usd(t.deposit)}</b></div><div class="kv"><span>المتبقي عند الاستلام</span><span>${usd(t.remaining)}</span></div></div>
    <div class="mut" style="margin-bottom:8px">إلغاء الطلب قبل الشراء: العربون غير مسترد. عند فشل الطلب يُعاد العربون لمحفظتك تلقائياً.</div><button class="btn w" data-a="shorder" data-key="${uuid()}">تأكيد الطلب ودفع العربون من المحفظة</button>`; }
  return h + '</div>';
}
const quantities = () => Object.fromEntries(Object.entries(st.sh.q).filter(([, v]) => v > 0));

/* ---------- wallet / orders / account ---------- */
async function loadWallet() { st.walletErr = false; try { st.wallet = await api('/wallet'); } catch (e) { st.walletErr = true; if (e.error !== 'session_expired') toast(errMsg(e), true); } paint(); }
function walletView() {
  const w = st.wallet; const KIND = { deposit: 'إيداع', debit: 'خصم', refund: 'استرداد' };
  return `${head()}<div class="pg"><div class="box" style="background:var(--navy);color:#fff"><div style="opacity:.8">رصيدك الحالي</div><div style="font-size:30px;font-weight:800;margin:4px 0 12px">${w ? usd(w.balance) : '…'}</div></div>
  <label class="fld"><span>مبلغ الشحن (USD)</span><input id="ta" inputmode="decimal" dir="ltr" placeholder="10.00"></label><button class="btn w" data-a="topup">شحن المحفظة عبر Ezone Pay</button>
  <div class="mut" style="margin-top:6px">يُضاف الرصيد تلقائياً فقط بعد تأكيد الدفع من Ezone Pay، وليس بمجرد العودة للموقع.</div><div class="sec">سجل العمليات</div>
  ${st.walletErr && !w ? '<div class="retry"><button class="btn o" data-a="reload">إعادة المحاولة</button></div>' : ''}${w ? (w.transactions.length ? w.transactions.map((t) => `<div class="row"><div class="g"><b>${KIND[t.kind] || t.kind}</b><div class="mut">${fmtDate(t.created_at)} · رصيد بعد: ${usd(t.balance_after)}</div></div><b style="color:${t.kind === 'debit' ? 'var(--bad)' : 'var(--ok)'}">${t.kind === 'debit' ? '-' : '+'}${usd(t.amount)}</b></div>`).join('') : '<div class="empty">لا توجد عمليات</div>') : ''}</div>`;
}
async function loadOrders() { st.ordersErr = false; try { st.orders = await api('/orders'); } catch (e) { st.ordersErr = true; if (e.error !== 'session_expired') toast(errMsg(e), true); } paint(); }
function ordersView() {
  const o = st.orders; return `${head()}<div class="top">طلباتي</div><div class="pg">${o ? (o.length ? o.map((r) => `<button class="row" style="width:100%;text-align:right" data-a="ord" data-n="${r.number}"><span class="g"><b>طلب #${r.number}</b><div class="mut">${fmtDate(r.created_at)} · ${esc(r.order_items?.map((i) => i.name + ' ×' + i.qty).join('، ') || '')}</div></span><span style="text-align:left">${stTag(r.status)}<div><b>${usd(r.total_usd)}</b></div></span></button>`).join('') : '<div class="empty">لا توجد طلبات بعد</div>') : (st.ordersErr ? '<div class="retry"><div class="mut">تعذّر التحميل</div><button class="btn o" data-a="reload">إعادة المحاولة</button></div>' : '<div class="empty">جارٍ التحميل…</div>')}</div>`;
}
async function orderModal(n) {
  try {
    const o = await api('/orders/' + n);
    modal(`<h3>طلب #${o.number}<button data-a="close">${ic('x')}</button></h3><div class="box"><div class="kv"><span>الحالة</span>${stTag(o.status)}</div><div class="kv"><span>الإجمالي</span><b>${usd(o.total_usd)}</b></div><div class="kv"><span>المدفوع</span><b>${usd(o.paid_usd)}</b></div>${o.remaining_usd ? `<div class="kv"><span>المتبقي عند الاستلام</span><b>${usd(o.remaining_usd)}</b></div>` : ''}</div>
    <div class="sec">المنتجات</div>${o.order_items.map((i) => `<div class="kv"><span>${esc(i.name)} ×${i.qty}</span><span>${usd(i.unit_price * i.qty)}</span></div>`).join('')}
    <div class="sec">مراحل الطلب</div>${o.order_status_history.map((h) => `<div class="kv"><span>${(STATUS[h.status] || [h.status])[0]}</span><span class="mut">${fmtDate(h.created_at)}</span></div>`).join('')}
    ${o.status === 'completed' && o.service !== 'shein' ? `<button class="btn w" style="margin-top:12px" data-a="codes" data-n="${o.number}">عرض الأكواد</button><div id="codes"></div>` : ''}
    <button class="btn o w" style="margin-top:10px" data-a="ticket" data-n="${o.number}">تقديم شكوى على هذا الطلب</button>`);
  } catch (e) { toast(errMsg(e), true); }
}
async function loadAcc() { await loadMe(); try { st.tickets = await api('/support'); } catch { st.tickets = []; } paint(); }
function accView() {
  const m = st.me; const v = m?.profile?.verification_status || 'unverified';
  return `${head()}<div class="top">حسابي</div><div class="pg"><div class="box"><div class="kv"><span>البريد</span><span dir="ltr">${esc(m?.email)}</span></div><div class="kv"><span>تأكيد البريد</span><span>${m?.confirmed ? 'مؤكد' : '<b style="color:var(--bad)">غير مؤكد (تحقق من بريدك)</b>'}</span></div><div class="kv"><span>التوثيق</span><span class="tag ${v === 'verified' ? 'ok' : v === 'rejected' ? 'bad' : ''}">${VER[v]}</span></div></div>
  <label class="fld"><span>الاسم الكامل (مطلوب للدفع)</span><input id="pn" value="${esc(m?.profile?.full_name || '')}" maxlength="80"></label><label class="fld"><span>رقم الهاتف (مثال: +218911234567)</span><input id="pp" dir="ltr" inputmode="tel" value="${esc(m?.profile?.phone || '')}"></label><button class="btn o w" data-a="psave">حفظ البيانات</button>
  ${['unverified', 'rejected'].includes(v) ? `<label class="fld"><span>رفع وثيقة التوثيق (JPG/PNG/PDF حتى 5MB)</span><input id="vf" type="file" accept="image/jpeg,image/png,application/pdf"></label><button class="btn w" data-a="vup">إرسال للمراجعة</button>` : ''}
  ${m?.staff ? '<a class="btn o w" style="margin-top:10px;text-decoration:none" href="/admin.html">لوحة الإدارة</a>' : ''}
  <div class="sec">الدعم والشكاوى</div><label class="fld"><span>الموضوع</span><input id="ts" maxlength="120"></label><label class="fld"><span>التفاصيل</span><textarea id="tb" rows="3" maxlength="2000"></textarea></label><button class="btn w" data-a="tsend">إرسال</button>
  ${(st.tickets || []).map((t) => `<div class="row" style="margin-top:8px"><div class="g"><b>${esc(t.subject)}</b><div class="mut">${fmtDate(t.created_at)}</div></div><span class="tag">${t.status === 'open' ? 'مفتوحة' : 'مغلقة'}</span></div>`).join('')}
  <button class="btn o w" style="margin-top:16px" data-a="logout">تسجيل الخروج</button></div>`;
}

/* ---------- shell ---------- */
function paint() {
  if (!S) { $('#nav').innerHTML = ''; $('#app').innerHTML = authView(); return; }
  const v = { shop: shopView, shein: sheinView, wallet: walletView, orders: ordersView, acc: accView }[st.tab];
  const keep = document.activeElement?.id; const val = document.activeElement?.value; $('#app').innerHTML = v();
  $('#nav').innerHTML = TABS.map(([k, n, i]) => `<button class="${st.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${ic(i)}${n}</button>`).join('');
  if (keep && $('#' + keep) && val != null && $('#' + keep).type !== 'file') { $('#' + keep).value = val; $('#' + keep).focus(); }
}
function go(k) { st.tab = k; closeM(); paint(); if (k === 'shop' && !st.shop.cats) loadCats(); if (k === 'wallet') loadWallet(); if (k === 'orders') loadOrders(); if (k === 'acc') loadAcc(); }

const H = {
  lang: () => setLang(nextLang()), reload: () => go(st.tab),
  ovclose: (b, e) => { if (e.target === b) closeM(); }, close: closeM, tab: (b) => go(b.dataset.k), mode: (b) => { st.authMode = b.dataset.m; paint(); },
  authgo: (b) => guard(b, async () => {
    const em = $('#em').value.trim(), pw = $('#pw')?.value || ''; if (!em) return toast('أدخل البريد', true);
    if (st.authMode === 'forgot') { await auth.recover(em); return toast('إن كان البريد مسجلاً سيصلك رابط الاستعادة'); }
    if (pw.length < 8) return toast('كلمة المرور 8 أحرف على الأقل', true);
    if (st.authMode === 'signup') { const d = await auth.signup(em, pw); if (!d.access_token) { st.authMode = 'login'; paint(); return toast('تم إنشاء الحساب. أكّد بريدك ثم سجّل الدخول'); } setSession(d); } else await auth.login(em, pw);
    await loadMe(); go('shop');
  }),
  psave: (b) => guard(b, async () => { await api('/profile', { method: 'PATCH', body: { full_name: $('#pn').value, phone: $('#pp').value.trim() } }); toast('تم الحفظ'); loadAcc(); }),
  logout: async () => { await auth.logout(); st.me = null; paint(); },
  svc: (b) => { st.shop.service = b.dataset.k; st.shop.q = ''; loadCats(); }, cat: (b) => loadOffers(b.dataset.id), catback: () => { st.shop.cat = null; st.shop.offers = null; paint(); },
  buy: (b) => { const o = st.shop.offers.find((x) => x.id === b.dataset.id); if (o) buyModal(o); },
  buygo: (b) => guard(b, async () => {
    const o = st.shop.offers.find((x) => x.id === b.dataset.id); const sv = st.shop.service;
    let body;
    if (sv === 'top_ups') { const fields = {}; for (const i of document.querySelectorAll('.pf')) { if (!i.value.trim()) return toast('أكمل بيانات اللاعب', true); fields[i.dataset.k] = i.value.trim(); } body = { service: sv, category_id: st.shop.cat, offer_id: o.id, fields, idempotency_key: b.dataset.key }; }
    else body = { service: sv, quantity: Number($('#bq').value), idempotency_key: b.dataset.key, category_id: st.shop.cat, card_id: o.id };
    const r = await api('/orders', { method: 'POST', body }); closeM(); toast(r.note === 'under_review' ? 'الطلب قيد المراجعة من الإدارة' : 'تم إنشاء الطلب'); go('orders');
  }),
  shcart: (b) => guard(b, async () => { const s = st.sh; s.link = $('#shl').value.trim(); s.err = ''; s.quote = null; s.q = {}; try { const r = await api('/shein/cart', { method: 'POST', body: { link: s.link } }); s.cart = r.cart; s.items = r.items; } catch (e) { s.err = errMsg(e); s.cart = null; } paint(); }),
  qp: (b) => { const q = st.sh.q; q[b.dataset.k] = Math.min(100, (q[b.dataset.k] || 0) + 1); st.sh.quote = null; paint(); }, qm: (b) => { const q = st.sh.q; q[b.dataset.k] = Math.max(0, (q[b.dataset.k] || 0) - 1); st.sh.quote = null; paint(); },
  shquote: (b) => guard(b, async () => { st.sh.quote = await api('/shein/quote', { method: 'POST', body: { link: st.sh.link, quantities: quantities() } }); paint(); }),
  shorder: (b) => guard(b, async () => {
    try { const r = await api('/shein/order', { method: 'POST', body: { link: st.sh.link, quantities: quantities(), expected_total: st.sh.quote.total, idempotency_key: b.dataset.key } }); toast('تم استلام العربون. طلب #' + r.number); st.sh = { link: '', cart: null, items: [], q: {}, quote: null, err: '' }; go('orders'); }
    catch (e) { if (e.error === 'price_changed') { st.sh.quote = null; paint(); } throw e; }
  }),
  topup: (b) => guard(b, async () => { const r = await api('/wallet/topup', { method: 'POST', body: { amount: $('#ta').value.trim() } }); location.href = r.url; }),
  ord: (b) => orderModal(b.dataset.n),
  codes: (b) => guard(b, async () => { const r = await api(`/orders/${b.dataset.n}/codes`); const l = Array.isArray(r.codes) ? r.codes : r.codes == null ? [] : [r.codes]; $('#codes').innerHTML = l.length ? l.map((c) => `<div class="code">${esc(typeof c === 'string' ? c : JSON.stringify(c))}</div>`).join('') : '<div class="mut">لا توجد أكواد (تسليم مباشر)</div>'; }),
  ticket: (b) => { closeM(); st.pendingOrder = b.dataset.n; go('acc'); toast('اكتب الشكوى أدناه (طلب #' + b.dataset.n + ')'); },
  tsend: (b) => guard(b, async () => { await api('/support', { method: 'POST', body: { subject: $('#ts').value, body: $('#tb').value, order_number: st.pendingOrder || undefined } }); st.pendingOrder = null; toast('تم إرسال الشكوى'); loadAcc(); }),
  vup: (b) => guard(b, async () => { const f = $('#vf').files[0]; if (!f) return toast('اختر ملفاً', true); await api('/verification', { method: 'POST', raw: await f.arrayBuffer(), type: f.type }); toast('تم الإرسال للمراجعة'); loadAcc(); }),
  notifs: () => guard(null, async () => { const l = await api('/notifications'); modal(`<h3>الإشعارات<button data-a="close">${ic('x')}</button></h3>${l.length ? l.map((n) => `<div class="row"><div class="g"><b>${esc(n.title)}</b>${n.read ? '' : ' <span>•</span>'}<div class="mut"><span>${esc(n.body || '')}</span> · ${fmtDate(n.created_at)}</div></div></div>`).join('') : '<div class="empty">لا توجد إشعارات</div>'}`); api('/notifications', { method: 'POST' }).catch(() => {}); }),
};
document.addEventListener('error', (e) => { const i = e.target; if (i.tagName === 'IMG' && i.classList.contains('th')) { const d = document.createElement('div'); d.className = 'th fallback'; d.style.cssText = i.style.cssText; d.textContent = (i.dataset.n || '?').trim().charAt(0).toUpperCase(); i.replaceWith(d); } }, true);
document.addEventListener('lamha:lang', () => { closeM(); paint(); });
document.addEventListener('lamha:expired', () => { st.me = null; st.wallet = null; st.orders = null; closeM(); paint(); toast(tt('انتهت الجلسة، سجّل الدخول من جديد'), true); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && H[b.dataset.a]) H[b.dataset.a](b, e); });
let qt; document.addEventListener('input', (e) => { if (e.target.id === 'sq') { st.shop.q = e.target.value; clearTimeout(qt); qt = setTimeout(loadCats, 450); } });
(async () => { if (S) { await loadMe(); if (!st.me) setSession(null); } paint(); if (S) go(location.search.includes('topup=return') ? 'wallet' : 'shop'); })();

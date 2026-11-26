/* LAMHA customer app. Every number shown comes from the server; prices are never computed or trusted client-side. */
const st = { tab: 'home', seg: 'cards', authMode: 'login', me: null, shop: { service: 'gift_cards', cats: null, cat: null, offers: null, q: '', err: '' }, sh: { link: '', cart: null, items: [], q: {}, quote: null, err: '' }, wallet: null, orders: null, tickets: null, ofilter: 'all', accSub: null };
const VER = { unverified: 'غير موثق', pending: 'قيد المراجعة', verified: 'موثق', rejected: 'مرفوض' };
const head = () => `<div class="hl"><img src="logo.png" alt="لمحة LAMHA" data-notr="1"><span class="lg">${langBtn()}<button class="bell" data-a="notifs" aria-label="الإشعارات">${ic('bell')}</button></span></div>`;
const authHead = () => `<div class="lh"><span class="ib"></span><img src="logo.png" alt="لمحة LAMHA" data-notr="1"><span class="ib"></span></div>`;
const tbar = (title, a, k) => `<div class="tt"><div class="tl2">${a ? `<button class="bk" data-a="${a}" data-k="${k || ''}" aria-label="رجوع">${ic('back')}</button>` : ''}<b>${title}</b></div><button class="bell dkb" data-a="notifs" aria-label="الإشعارات">${ic('bell')}</button></div>`;
const mS = (n) => mny(n, st.shop.service), mSh = (n) => mny(n, 'shein'), mW = (n) => mny(n, 'wallet');
const nm = () => st.me?.profile?.full_name || (st.me?.email || '').split('@')[0] || '';
const artOf = (c) => c.image ? `<img class="th art" src="${esc(c.image)}" alt="" data-n="${esc(c.name)}" referrerpolicy="no-referrer">` : `<div class="th art fallback ini" style="--h:${(c.name.charCodeAt(0) * 47) % 360}">${esc(c.name.trim().charAt(0).toUpperCase())}</div>`;
const catCard = (c, a = 'cat') => `<button class="pcd" data-a="${a}" data-id="${esc(c.id)}">${artOf(c)}<span class="pi"><span class="pn" dir="auto">${esc(c.name)}</span><span class="pp"><b>عرض العروض</b><i>${ic('chev')}</i></span></span></button>`;
const segBar = (items, cur, a) => `<div class="seg">${items.map(([k, n]) => `<button class="${cur === k ? 'on' : ''}" data-a="${a}" data-k="${k}">${n}</button>`).join('')}</div>`;

function authView() {
  const m = st.authMode; const title = { login: 'تسجيل الدخول', signup: 'إنشاء حساب', forgot: 'استعادة كلمة المرور' }[m];
  return `${authHead()}<div class="pg"><div class="top" style="padding:0 0 12px">${title}</div>
  <label class="fld"><span>البريد الإلكتروني</span><input id="em" type="email" autocomplete="email" dir="ltr"></label>
  ${m !== 'forgot' ? `<label class="fld"><span>كلمة المرور</span><input id="pw" type="password" autocomplete="${m === 'login' ? 'current-password' : 'new-password'}" dir="ltr"></label>` : ''}
  <button class="btn w" data-a="authgo">${title}</button><div style="margin-top:14px;display:flex;gap:14px;justify-content:center" class="mut">
  ${m !== 'login' ? '<button data-a="mode" data-m="login">لدي حساب</button>' : '<button data-a="mode" data-m="signup">إنشاء حساب</button><button data-a="mode" data-m="forgot">نسيت كلمة المرور</button>'}</div></div>`;
}
async function loadMe() { try { st.me = await api('/me'); } catch { st.me = null; } }

/* ---------- shop ---------- */
async function loadCats() { const s = st.shop; s.cats = null; s.cat = null; s.offers = null; s.err = ''; paint(); try { const r = await api('/shop/categories?service=' + s.service + (s.q.trim() ? '&q=' + encodeURIComponent(s.q.trim()) : '')); s.cats = r.items; s.total = r.total; } catch (e) { s.err = errMsg(e); s.cats = []; } paint(); }
async function loadOffers(id) { const s = st.shop; s.cat = id; s.offers = null; paint(); try { const r = await api(`/shop/offers?service=${s.service}&id=${encodeURIComponent(id)}`); s.offers = r.offers; s.fields = r.fields || []; } catch (e) { s.err = errMsg(e); s.offers = []; } paint(); }
function homeView() {
  const w = st.wallet, cats = (st.shop.cats || []).slice(0, 6);
  return `<div class="hero2">${head()}<div class="hi"><span>أهلاً بك</span><b>${esc(nm())}</b></div>
  <div class="bal"><div class="bt"><div><small>رصيد المحفظة</small><h2>${w ? mW(w.balance) : '…'}</h2></div><div class="ey">${ic('wallet')}</div></div>
  <div class="bb"><button class="b1" data-a="tab" data-k="wallet">${ic('bolt')} شحن الرصيد</button><button class="b2" data-a="tab" data-k="wallet">${ic('stack')} السجل</button></div></div></div>
  <div class="bd"><div class="qa"><button data-a="qgo" data-k="cards"><span>${ic('gift')}</span>هدايا</button><button data-a="qgo" data-k="games"><span>${ic('game')}</span>ألعاب</button><button data-a="qgo" data-k="shein"><span class="s">S</span>SHEIN</button><button data-a="soon"><span>${ic('grid')}</span>المزيد</button></div>
  <button class="sr" data-a="qgo" data-k="cards">${ic('search')}<em>ابحث عن منتج أو خدمة…</em></button>
  ${cats.length ? `<div class="sh"><b>منتجات مميزة</b><button data-a="qgo" data-k="${st.shop.service === 'top_ups' ? 'games' : 'cards'}">عرض الكل</button></div><div class="rail">${cats.map((c) => catCard(c, 'catgo')).join('')}</div>` : ''}
  <div class="promo"><div><b>اشحن محفظتك بخطوة وحدة</b><small>أضف رصيد عبر Ezone Pay واشترِ بنقرة</small></div><button data-a="tab" data-k="wallet">ابدأ</button></div></div>`;
}
function storeView() {
  const s = st.shop; const g = st.seg; let body = '';
  const top = `${tbar('المتجر')}${segBar([['cards', 'بطاقات'], ['games', 'شحن ألعاب'], ['shein', 'SHEIN']], g, 'seg')}`;
  if (g === 'shein') return `${top}<div class="bd">${sheinBody()}</div>`;
  const offerRow = (o) => `<div class="row"><div class="g"><b>${esc(o.name)}</b><div class="mut">${o.available ? (o.stock != null ? 'متوفر: ' + o.stock : 'متوفر') : 'نفد المخزون'}</div></div><div style="text-align:left"><b>${mS(o.price_usd)}</b><br><button class="btn s" data-a="buy" data-id="${esc(o.id)}" ${o.available ? '' : 'disabled'}>شراء</button></div></div>`;
  if (s.err) body = `<div class="note">${esc(s.err)}</div>`;
  else if (s.cat != null) body = `<button class="btn o s" data-a="catback">رجوع</button><div class="sec">العروض</div>` + (s.offers == null ? '<div class="skg"><i></i><i></i></div>' : s.offers.length ? s.offers.map(offerRow).join('') : '<div class="empty">لا توجد باقات نشطة لهذه الفئة الآن.<br>جرّب فئة بديلة من نفس اللعبة (مثل manual أو reserve) بالرجوع للقائمة.</div>');
  else if (s.cats == null) body = '<div class="skg"><i></i><i></i><i></i><i></i></div>';
  else if (!s.cats.length) body = `<div class="empty big"><span class="ei">${ic('stack')}</span><b>لا توجد منتجات حالياً</b><span class="mut">جرّب قسماً آخر أو عد لاحقاً</span></div>`;
  else body = (s.total > s.cats.length ? `<div class="mut" style="margin-bottom:8px">يُعرض ${s.cats.length} من ${s.total}. استعمل البحث للوصول لباقي التصنيفات.</div>` : '') + `<div class="grid2">${s.cats.map((c) => catCard(c)).join('')}</div>`;
  return `${top}<div class="bd">${s.cat == null ? `<label class="sr w">${ic('search')}<input id="sq" placeholder="ابحث عن منتج أو خدمة…" value="${esc(s.q)}"></label>` : ''}${body}</div>`;
}
function buyModal(o) {
  const key = uuid(); const max = Math.max(1, Math.min(o.max || 100, o.stock ?? 100)); const direct = st.shop.service === 'top_ups';
  modal(`<h3>${esc(o.name)}<button data-a="close">${ic('x')}</button></h3><div class="box"><div class="kv"><span>${direct ? 'السعر' : 'سعر الوحدة'}</span><b>${mS(o.price_usd)}</b></div>
  ${direct ? (st.shop.fields || []).map((f) => `<label class="fld"><span>${esc(f.label)}</span><input class="pf" data-k="${esc(f.key)}" maxlength="100" autocomplete="off" dir="ltr"></label>`).join('') + '<div class="mut">تأكد من صحة البيانات: لا يمكن تعديلها بعد التأكيد.</div>' : `<label class="fld"><span>الكمية</span><input id="bq" type="number" min="${o.min || 1}" max="${max}" value="${o.min || 1}"></label>`}<div class="kv t"><span>الإجمالي</span><b id="bt">${mS(o.price_usd * (direct ? 1 : (o.min || 1)))}</b></div></div>
  <div class="mut" style="margin-bottom:10px">يُخصم من رصيد محفظتك. السعر النهائي يؤكده الخادم.</div><button class="btn w" data-a="buygo" data-id="${esc(o.id)}" data-key="${key}">تأكيد الشراء</button>`);
  if (!direct) $('#bq').addEventListener('input', (e) => { $('#bt').textContent = mS(o.price_usd * (Number(e.target.value) || 0)); });
}

/* ---------- SHEIN ---------- */
function sheinBody() {
  const s = st.sh; const step = s.quote ? 3 : s.cart ? 2 : 1; const cl = (n) => (step > n ? 'on' : step === n ? 'cur' : '');
  let h = `<div class="stps"><div class="d ${cl(1)}"><i>${ic('link', 14, 2.4)}</i><span>الرابط</span></div><u class="${step > 1 ? 'on' : ''}"></u><div class="d ${cl(2)}"><i>${ic('cart', 14, 2.4)}</i><span>السلة</span></div><u class="${step > 2 ? 'on' : ''}"></u><div class="d ${cl(3)}"><i>3</i><span>التأكيد</span></div></div>
  <div class="note">أسعار SHEIN لقطة من السلة وقت القراءة وغير مضمونة. السعر النهائي يُؤكَّد قبل الطلب، ولا يمكن تعديل الطلب بعد دفع العربون.</div>
  <label class="lnk">${ic('link')}<input id="shl" dir="ltr" value="${esc(s.link)}" placeholder="https://onelink.shein.com/..." aria-label="أدخل رابط سلة مشتريات SHEIN"><button class="pst" data-a="paste">لصق</button></label><button class="btn w rd" data-a="shcart">قراءة السلة</button>`;
  if (s.err) h += `<div class="err">${esc(s.err)}</div>`;
  if (s.cart) {
    h += `<div class="sec">${esc(s.cart.title || 'السلة')}</div>`;
    h += s.items.map((i) => { const q = s.q[i.key] || 0; return `<div class="shc">${i.image ? `<img class="th im" src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">` : '<div class="th im"></div>'}<div class="g"><b>${esc(i.name)}</b><div class="mut">${esc(i.attr)}</div>
      ${i.unitUsdCents != null ? `<div><b>${mSh(i.unitUsdCents / 100)}</b> ${i.savingsUsdCents ? `<s class="mut">${mSh(i.originalUsdCents / 100)}</s> <span class="tag ok">وفّر ${mSh(i.savingsUsdCents / 100)} (${esc(i.discountPercent)}%)</span>` : ''}</div>` : '<div class="mut">لا يتوفر سعر بالدولار</div>'}
      ${i.orderable ? `<div class="q" style="margin-top:6px"><button data-a="qm" data-k="${esc(i.key)}">−</button><b>${q}</b><button data-a="qp" data-k="${esc(i.key)}">+</button></div>` : `<span class="tag bad">${i.orderableReason === 'sold_out' ? 'نفد' : i.orderableReason === 'unavailable' ? 'غير متوفر' : 'غير قابل للطلب'}</span>`}</div></div>`; }).join('');
    h += `<button class="btn w rd" data-a="shquote">احسب الإجمالي</button>`;
  }
  if (s.quote) { const t = s.quote; const pc = t.total > 0 ? Math.min(100, Math.round((t.deposit / t.total) * 100)) : 0;
    h += `<div class="inv"><div class="qh">تفاصيل الطلب</div>${t.items.map((i) => `<div class="kv"><span>${esc(i.name)} ×${i.qty}</span><b>${mSh(i.unit_price * i.qty)}</b></div>`).join('')}
    <div class="kv"><span>الشحن</span><b>${mSh(t.shipping)}</b></div><div class="kv"><span>الرسوم</span><b>${mSh(t.fees)}</b></div><div class="kv t"><span>الإجمالي</span><b>${mSh(t.total)}</b></div></div>
    <div class="split"><div class="bar"><i style="width:${pc}%"></i></div><div class="sp"><div><small>العربون المطلوب الآن</small><b>${mSh(t.deposit)}</b></div><div><small>المتبقي عند الاستلام</small><b class="mu">${mSh(t.remaining)}</b></div></div></div>
    <div class="mut" style="margin:10px 4px">إلغاء الطلب قبل الشراء: العربون غير مسترد. عند فشل الطلب يُعاد العربون لمحفظتك تلقائياً.</div><button class="cta" data-a="shorder" data-key="${uuid()}">${ic('bolt', 20, 2.2)} تأكيد الطلب ودفع العربون من المحفظة</button>`; }
  return h;
}
const quantities = () => Object.fromEntries(Object.entries(st.sh.q).filter(([, v]) => v > 0));

/* ---------- wallet / orders / account ---------- */
async function loadWallet() { st.walletErr = false; try { st.wallet = await api('/wallet'); } catch (e) { st.walletErr = true; if (e.error !== 'session_expired') toast(errMsg(e), true); } paint(); }
function walletView() {
  const w = st.wallet; const KIND = { deposit: 'إيداع', debit: 'خصم', refund: 'استرداد' }; const L = typeof locale === 'function' ? locale() : 'ar';
  const dayLbl = (iso) => { const d = new Date(iso), n = new Date(), y = new Date(n - 864e5); const k = (x) => x.toDateString(); return k(d) === k(n) ? 'اليوم' : k(d) === k(y) ? 'أمس' : d.toLocaleDateString(L, { dateStyle: 'medium' }); };
  let last = ''; const rows = w ? w.transactions.map((t) => { const dn = t.kind === 'debit'; const dl = dayLbl(t.created_at); const hd = dl !== last ? `<div class="dy">${dl}</div>` : ''; last = dl;
    return `${hd}<div class="txr"><i class="${dn ? 'dn' : 'up'}">${ic(dn ? 'down' : 'up', 20, 2.2)}</i><div class="g"><b>${KIND[t.kind] || t.kind}</b><small>${new Date(t.created_at).toLocaleTimeString(L, { timeStyle: 'short' })}</small></div><span class="${dn ? 'neg' : 'pos'}" dir="ltr">${dn ? '−' : '+'}${mW(t.amount)}</span></div>`; }).join('') : '';
  return `<div class="hero2 s2"><div class="tt l"><div class="tl2"><button class="bk w" data-a="tab" data-k="home" aria-label="رجوع">${ic('back')}</button><b>المحفظة</b></div><button class="bell" data-a="notifs" aria-label="الإشعارات">${ic('bell')}</button></div>
  <div class="bal"><div class="bt"><div><small>رصيدك الحالي</small><h2>${w ? mW(w.balance) : '…'}</h2></div><div class="ey">${ic('wallet')}</div></div>
  <label class="amt"><span>مبلغ الشحن (USD)</span><input id="ta" inputmode="decimal" dir="ltr" placeholder="10.00"></label><div class="mut2" id="tah"></div>
  <div class="qs">${[10, 25, 50, 100].map((v) => `<button data-a="chip" data-v="${v}">${v}$</button>`).join('')}</div><button class="b1 full" data-a="topup">${ic('bolt', 18, 2.2)} شحن المحفظة عبر Ezone Pay</button></div></div>
  <div class="bd"><div class="mut" style="margin:0 4px 8px">يُضاف الرصيد تلقائياً فقط بعد تأكيد الدفع من Ezone Pay، وليس بمجرد العودة للموقع.</div>
  ${st.walletErr && !w ? '<div class="retry"><button class="btn o" data-a="reload">إعادة المحاولة</button></div>' : ''}${w ? (w.transactions.length ? rows : '<div class="empty">لا توجد عمليات</div>') : ''}</div>`;
}
async function loadOrders() { st.ordersErr = false; try { st.orders = await api('/orders'); } catch (e) { st.ordersErr = true; if (e.error !== 'session_expired') toast(errMsg(e), true); } paint(); }
function ordersView() {
  const o = st.orders; const f = st.ofilter; const list = o ? o.filter((r) => f === 'all' || (f === 'shein' ? r.service === 'shein' : r.service !== 'shein')) : [];
  const IDX = { pending_payment: 0, paid: 1, processing: 2, completed: 3 }; const STEPS = ['تم الدفع', 'قيد التنفيذ', 'مكتمل'];
  const card = (r) => { const ix = IDX[r.status]; const tl = ix != null && ix < 3 ? `<div class="otl">${STEPS.map((n, i) => `${i ? `<u class="${ix > i ? 'dn' : ''}"></u>` : ''}<div class="s ${ix > i + 1 ? 'dn' : ix === i + 1 ? 'cu' : ''}"><i></i><small>${n}</small></div>`).join('')}</div>` : '';
    return `<button class="oc" data-a="ord" data-n="${r.number}"><span class="oh"><span class="ot ${r.service === 'shein' ? 'sh' : ''}">${r.service === 'shein' ? '<b class="sl">S</b>' : ic('game', 24)}</span><span class="g"><b>طلب #${r.number}</b><small>${fmtDate(r.created_at)} · ${mny(r.total_usd, r.service)}</small><small><bdi>${esc(r.order_items?.map((i) => i.name + ' ×' + i.qty).join('، ') || '')}</bdi></small></span>${stTag(r.status)}</span>${tl}</button>`; };
  return `${tbar('طلباتي')}${segBar([['all', 'جميع الطلبات'], ['cards', 'كروت الألعاب'], ['shein', 'SHEIN']], f, 'ofilter')}<div class="bd">${o ? (list.length ? list.map(card).join('') : `<div class="empty big"><span class="ei">${ic('stack')}</span><b>لا توجد طلبات بعد</b></div>`) : (st.ordersErr ? '<div class="retry"><div class="mut">تعذّر التحميل</div><button class="btn o" data-a="reload">إعادة المحاولة</button></div>' : '<div class="skg"><i></i><i></i><i></i></div>')}</div>`;
}
async function orderModal(n) {
  try {
    const o = await api('/orders/' + n); const M = (v) => mny(v, o.service); const sh = o.service === 'shein';
    const items = o.order_items.reduce((a, i) => a + i.unit_price * i.qty, 0); const extra = Math.max(0, Math.round((o.total_usd - items) * 100) / 100);
    const inv = sh ? `<div class="qb"><div class="qh">فاتورة الطلب</div>${o.order_items.map((i) => `<div class="kv"><span>${esc(i.name)} ×${i.qty}</span><span>${M(i.unit_price * i.qty)}</span></div>`).join('')}
      <div class="kv"><span>إجمالي المنتجات</span><span>${M(items)}</span></div><div class="kv"><span>الشحن والرسوم</span><span>${M(extra)}</span></div><div class="kv t"><span>الإجمالي</span><span>${M(o.total_usd)}</span></div>
      <div class="kv"><span>المدفوع (العربون)</span><b>${M(o.paid_usd)}</b></div><div class="kv"><span>المتبقي عند الاستلام</span><b>${M(o.remaining_usd || 0)}</b></div></div>`
      : `<div class="box"><div class="kv"><span>الإجمالي</span><b>${M(o.total_usd)}</b></div><div class="kv"><span>المدفوع</span><b>${M(o.paid_usd)}</b></div></div><div class="sec">المنتجات</div>${o.order_items.map((i) => `<div class="kv"><span>${esc(i.name)} ×${i.qty}</span><span>${M(i.unit_price * i.qty)}</span></div>`).join('')}`;
    modal(`<h3>طلب #${o.number}<button data-a="close">${ic('x')}</button></h3><div class="box"><div class="kv"><span>الحالة</span>${stTag(o.status)}</div><div class="kv"><span>التاريخ</span><span>${fmtDate(o.created_at)}</span></div></div>${inv}
    <div class="sec">مراحل الطلب</div><div class="tl">${o.order_status_history.map((h, n, a) => `<div class="st ${n === a.length - 1 ? 'cur' : ''}"><i></i><span>${(STATUS[h.status] || [h.status])[0]}</span><span class="mut">${fmtDate(h.created_at)}</span></div>`).join('')}</div>
    ${o.status === 'completed' && !sh ? `<button class="btn w" style="margin-top:12px" data-a="codes" data-n="${o.number}">عرض الأكواد</button><div id="codes"></div>` : ''}
    <button class="btn o w" style="margin-top:10px" data-a="ticket" data-n="${o.number}">تقديم شكوى على هذا الطلب</button>`);
  } catch (e) { toast(errMsg(e), true); }
}
async function loadAcc() { await loadMe(); try { st.tickets = await api('/support'); } catch { st.tickets = []; } paint(); }
function accView() {
  const m = st.me; const v = m?.profile?.verification_status || 'unverified'; const sub = st.accSub;
  const nm = m?.profile?.full_name || (m?.email || '').split('@')[0];
  if (sub === 'profile') return `${tbar('البيانات الشخصية', 'accback')}<div class="pg"><div class="box"><div class="kv"><span>البريد</span><span dir="ltr">${esc(m?.email)}</span></div><div class="kv"><span>تأكيد البريد</span><span>${m?.confirmed ? 'مؤكد' : '<b style="color:var(--bad)">غير مؤكد (تحقق من بريدك)</b>'}</span></div></div>
  <label class="fld"><span>الاسم الكامل (مطلوب للدفع)</span><input id="pn" value="${esc(m?.profile?.full_name || '')}" maxlength="80"></label><label class="fld"><span>رقم الهاتف (مثال: +218911234567)</span><input id="pp" dir="ltr" inputmode="tel" value="${esc(m?.profile?.phone || '')}"></label><button class="btn w" data-a="psave">حفظ البيانات</button></div>`;
  if (sub === 'settings') return `${tbar('إعدادات الحساب', 'accback')}<div class="pg"><div class="box"><div class="kv"><span>اللغة</span>${langBtn().replace('<button', '<button class="btn o s"')}</div></div>${m?.staff ? '<a class="btn o w" style="text-decoration:none" href="admin.html">لوحة الإدارة</a>' : ''}</div>`;
  if (sub === 'security') return `${tbar('الأمان والتحقق', 'accback')}<div class="pg"><div class="box"><div class="kv"><span>التوثيق</span><span class="tag ${v === 'verified' ? 'ok' : v === 'rejected' ? 'bad' : ''}">${VER[v]}</span></div></div>
  ${['unverified', 'rejected'].includes(v) ? `<label class="fld"><span>رفع وثيقة التوثيق (JPG/PNG/PDF حتى 5MB)</span><input id="vf" type="file" accept="image/jpeg,image/png,application/pdf"></label><button class="btn w" data-a="vup">إرسال للمراجعة</button>` : ''}</div>`;
  if (sub === 'support') return `${tbar('الدعم الفني والشكاوى', 'accback')}<div class="pg"><label class="fld"><span>الموضوع</span><input id="ts" maxlength="120"></label><label class="fld"><span>التفاصيل</span><textarea id="tb" rows="3" maxlength="2000"></textarea></label><button class="btn w" data-a="tsend">إرسال</button>
  ${(st.tickets || []).map((t) => `<div class="row" style="margin-top:8px"><div class="g"><b>${esc(t.subject)}</b><div class="mut">${fmtDate(t.created_at)}</div></div><span class="tag">${t.status === 'open' ? 'مفتوحة' : 'مغلقة'}</span></div>`).join('')}</div>`;
  const items = [['profile', 'البيانات الشخصية', 'user'], ['settings', 'إعدادات الحساب', 'gear'], ['security', 'الأمان والتحقق', 'shield'], ['support', 'الدعم الفني والشكاوى', 'help']];
  return `${tbar('حسابي')}<div class="pg"><div class="pf2"><span class="av">${ic('user')}</span><div class="g"><b>${esc(nm)}</b><div class="mut" dir="ltr" style="text-align:start">${esc(m?.email)}</div><span class="tag ${v === 'verified' ? 'ok' : ''}" style="margin-top:6px;display:inline-block">${VER[v]}</span></div></div><button class="wsc" data-a="tab" data-k="wallet"><span class="mi">${ic('wallet')}</span><span class="g">رصيد المحفظة</span><b>${st.wallet ? mW(st.wallet.balance) : '—'}</b></button>
  <div class="menu">${items.map(([k, n, i]) => `<button data-a="accsub" data-k="${k}"><span class="mi">${ic(i)}</span><span class="g">${n}</span><span class="ch">${ic('chev')}</span></button>`).join('')}<button data-a="about"><span class="mi">${ic('info')}</span><span class="g">حول منصة لمحة</span><span class="ch">${ic('chev')}</span></button></div>
  <button class="lo" data-a="logout">تسجيل الخروج ${ic('logout')}</button></div>`;
}

/* ---------- shell ---------- */
function paint() {
  if (!S) { $('#nav').innerHTML = ''; $('#app').innerHTML = authView(); return; }
  const v = { home: homeView, shop: storeView, wallet: walletView, orders: ordersView, acc: accView }[st.tab];
  const keep = document.activeElement?.id; const val = document.activeElement?.value; $('#app').innerHTML = v();
  const D = ([k, n, i]) => `<button class="dk ${st.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}" aria-label="${n}">${ic(i, 22, st.tab === k ? 2.2 : 1.8)}<b>${n}</b></button>`;
  $('#nav').innerHTML = `<div class="dockw"><div class="dock">${D(['home', 'الرئيسية', 'home'])}${D(['shop', 'المتجر', 'grid'])}<button class="fab ${st.tab === 'wallet' ? 'on' : ''}" data-a="tab" data-k="wallet" aria-label="المحفظة">${ic('bolt', 26, 2.2)}</button>${D(['orders', 'طلباتي', 'box'])}${D(['acc', 'حسابي', 'user'])}</div></div>`;
  if (keep && $('#' + keep) && val != null && $('#' + keep).type !== 'file') { $('#' + keep).value = val; $('#' + keep).focus(); }
}
function go(k) { st.tab = k; closeM(); paint(); if ((k === 'home' || (k === 'shop' && st.seg !== 'shein')) && !st.shop.cats) loadCats(); if (k === 'home' || k === 'wallet' || (k === 'acc' && !st.wallet)) loadWallet(); if (k === 'orders') loadOrders(); if (k === 'acc') loadAcc(); }

const H = {
  lang: () => setLang(nextLang()), reload: () => go(st.tab),
  ovclose: (b, e) => { if (e.target === b) closeM(); }, close: closeM, tab: (b) => { st.accSub = null; go(b.dataset.k); }, mode: (b) => { st.authMode = b.dataset.m; paint(); },
  authgo: (b) => guard(b, async () => {
    const em = $('#em').value.trim(), pw = $('#pw')?.value || ''; if (!em) return toast('أدخل البريد', true);
    if (st.authMode === 'forgot') { await auth.recover(em); return toast('إن كان البريد مسجلاً سيصلك رابط الاستعادة'); }
    if (pw.length < 8) return toast('كلمة المرور 8 أحرف على الأقل', true);
    if (st.authMode === 'signup') { const d = await auth.signup(em, pw); if (!d.access_token) { st.authMode = 'login'; paint(); return toast('تم إنشاء الحساب. أكّد بريدك ثم سجّل الدخول'); } setSession(d); } else await auth.login(em, pw);
    await loadMe(); go('home');
  }),
  psave: (b) => guard(b, async () => { await api('/profile', { method: 'PATCH', body: { full_name: $('#pn').value, phone: $('#pp').value.trim() } }); toast('تم الحفظ'); loadAcc(); }),
  logout: async () => { await auth.logout(); st.me = null; st.accSub = null; closeM(); paint(); },
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
  topup: (b) => guard(b, async () => { const r = await api('/wallet/topup', { method: 'POST', body: { amount: $('#ta').value.trim(), return_url: location.origin + location.pathname } }); location.href = r.url; }),
  ord: (b) => orderModal(b.dataset.n), ofilter: (b) => { st.ofilter = b.dataset.k; paint(); },
  accsub: (b) => { st.accSub = b.dataset.k; paint(); window.scrollTo(0, 0); }, accback: () => { st.accSub = null; paint(); },
  soon: () => toast('هذا القسم قريباً'),
  seg: (b) => { st.seg = b.dataset.k; if (st.seg !== 'shein') { st.shop.service = st.seg === 'games' ? 'top_ups' : 'gift_cards'; st.shop.q = ''; loadCats(); } else paint(); },
  qgo: (b) => { st.tab = 'shop'; closeM(); H.seg(b); window.scrollTo(0, 0); },
  catgo: (b) => { st.seg = st.shop.service === 'top_ups' ? 'games' : 'cards'; st.tab = 'shop'; window.scrollTo(0, 0); loadOffers(b.dataset.id); },
  chip: (b) => { const i = $('#ta'); i.value = b.dataset.v; i.dispatchEvent(new Event('input', { bubbles: true })); },
  paste: async () => { try { const t = (await navigator.clipboard.readText() || '').trim(); if (!t) return toast('الحافظة فارغة', true); $('#shl').value = t; st.sh.link = t; } catch { toast('تعذّر اللصق، الصق الرابط يدوياً', true); } },
  about: () => modal(`<h3>حول منصة لمحة<button data-a="close">${ic('x')}</button></h3><div class="box"><b>كل ما تحتاجه في لمحة واحدة</b><div class="mut" style="margin-top:6px">منصة لشراء بطاقات الهدايا وشحن الألعاب وطلبات SHEIN، مع محفظة تشحنها عبر Ezone Pay.</div></div>`),
  menu: () => modal(`<h3>القائمة<button data-a="close">${ic('x')}</button></h3><div class="menu"><button data-a="menugo" data-k="support"><span class="mi">${ic('help')}</span><span class="g">الدعم الفني والشكاوى</span><span class="ch">${ic('chev')}</span></button><button data-a="about"><span class="mi">${ic('info')}</span><span class="g">حول منصة لمحة</span><span class="ch">${ic('chev')}</span></button></div><button class="lo" data-a="logout">تسجيل الخروج ${ic('logout')}</button>`),
  menugo: (b) => { closeM(); st.accSub = b.dataset.k; go('acc'); },
  codes: (b) => guard(b, async () => { const r = await api(`/orders/${b.dataset.n}/codes`); const l = Array.isArray(r.codes) ? r.codes : r.codes == null ? [] : [r.codes]; $('#codes').innerHTML = l.length ? l.map((c) => `<div class="code">${esc(typeof c === 'string' ? c : JSON.stringify(c))}</div>`).join('') : '<div class="mut">لا توجد أكواد (تسليم مباشر)</div>'; }),
  ticket: (b) => { closeM(); st.pendingOrder = b.dataset.n; st.accSub = 'support'; go('acc'); toast('اكتب الشكوى أدناه (طلب #' + b.dataset.n + ')'); },
  tsend: (b) => guard(b, async () => { await api('/support', { method: 'POST', body: { subject: $('#ts').value, body: $('#tb').value, order_number: st.pendingOrder || undefined } }); st.pendingOrder = null; toast('تم إرسال الشكوى'); loadAcc(); }),
  vup: (b) => guard(b, async () => { const f = $('#vf').files[0]; if (!f) return toast('اختر ملفاً', true); await api('/verification', { method: 'POST', raw: await f.arrayBuffer(), type: f.type }); toast('تم الإرسال للمراجعة'); loadAcc(); }),
  notifs: () => guard(null, async () => { const l = await api('/notifications'); modal(`<h3>الإشعارات<button data-a="close">${ic('x')}</button></h3>${l.length ? l.map((n) => `<div class="row"><div class="g"><b>${esc(n.title)}</b>${n.read ? '' : ' <span>•</span>'}<div class="mut"><span>${esc(n.body || '')}</span> · ${fmtDate(n.created_at)}</div></div></div>`).join('') : '<div class="empty">لا توجد إشعارات</div>'}`); api('/notifications', { method: 'POST' }).catch(() => {}); }),
};
document.addEventListener('error', (e) => { const i = e.target; if (i.tagName === 'IMG' && i.classList.contains('th')) { const d = document.createElement('div'); d.className = 'th fallback'; d.style.cssText = i.style.cssText; d.textContent = (i.dataset.n || '?').trim().charAt(0).toUpperCase(); i.replaceWith(d); } }, true);
document.addEventListener('lamha:lang', () => { closeM(); paint(); });
document.addEventListener('lamha:expired', () => { st.me = null; st.wallet = null; st.orders = null; closeM(); paint(); toast(tt('انتهت الجلسة، سجّل الدخول من جديد'), true); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && H[b.dataset.a]) H[b.dataset.a](b, e); });
let qt; document.addEventListener('input', (e) => { if (e.target.id === 'ta') { const h = $('#tah'), v = Number(e.target.value); if (h) h.textContent = v > 0 && (RT.wallet || RT.default) ? '≈ ' + mny(v, 'wallet') : ''; } if (e.target.id === 'sq') { st.shop.q = e.target.value; clearTimeout(qt); qt = setTimeout(loadCats, 450); } });
loadRates().then(() => { if (S) paint(); });
(async () => { if (S) { await loadMe(); if (!st.me) setSession(null); } paint(); if (S) go(location.search.includes('topup=return') ? 'wallet' : 'home'); })();

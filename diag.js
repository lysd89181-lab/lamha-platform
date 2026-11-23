// يفحص الاتصال من نفس الموقع الذي تفتح منه الصفحة (مثلاً GitHub Pages). لا يرسل أي مفتاح ولا بيانات.
const out = document.getElementById('out');
const add = (cls, t, extra) => { const d = document.createElement('div'); d.className = 'r'; d.innerHTML = `<b class="${cls}">${t}</b>` + (extra ? `<pre></pre>` : ''); if (extra) d.querySelector('pre').textContent = extra; out.appendChild(d); };
document.getElementById('go').onclick = async () => {
  out.innerHTML = ''; const base = document.getElementById('base').value.trim().replace(/\/+$/, ''); const me = location.origin;
  add('', 'الموقع الذي تفتح منه الآن (Origin): ' + me);
  let reach = false, cors = false, info = null, pre = false;
  try { await fetch(base + '/api/health', { mode: 'no-cors' }); reach = true; add('ok', '1) الـ Worker يرد على متصفحك (الشبكة سليمة)'); } catch (e) { add('bad', '1) المتصفح لا يصل للـ Worker أصلاً (شبكة/رابط خطأ/الـ Worker متوقف)', String(e)); }
  if (reach) {
    try { const r = await fetch(base + '/api/health?origin=' + encodeURIComponent(me)); info = await r.json(); cors = true; add('ok', '2) الطلب البسيط مسموح (CORS يمر)', JSON.stringify(info)); }
    catch (e) { add('bad', '2) الـ Worker يرد لكن المتصفح يمنع قراءة الرد: هذا الموقع غير مسموح في ALLOWED_ORIGINS (أو الـ Worker القديم غير محدّث)', String(e)); }
  }
  if (cors) {
    try { const r = await fetch(base + '/api/me', { headers: { authorization: 'Bearer test' } }); pre = true; add('ok', '3) طلب فيه Authorization (preflight) يمر. الرد: ' + r.status + ' (401 طبيعي لأن الرمز تجريبي)'); }
    catch (e) { add('bad', '3) طلب Authorization (preflight) محظور رغم نجاح الخطوة 2', String(e)); }
  }
  let verdict;
  if (!reach) verdict = ['bad', 'الخلاصة: مشكلة وصول للـ Worker نفسه. افتح رابط /api/health مباشرة في المتصفح وتأكد أنه يرجع ok.'];
  else if (!cors) verdict = ['bad', 'الخلاصة: CORS. أضف ' + me + ' إلى ALLOWED_ORIGINS في wrangler.toml وانشر من جديد، وتأكد أن Dashboard لا يحمل قيمة قديمة لنفس المتغير.'];
  else if (info && info.origin_allowed === undefined) verdict = ['bad', 'الخلاصة: الـ Worker المنشور قديم (لا يحتوي التشخيص الجديد). انشر index.ts الجديد.'];
  else if (info && !info.origin_allowed) verdict = ['bad', 'الخلاصة: الـ Worker يرى الأصل غير مسموح. راجع ALLOWED_ORIGINS.'];
  else if (!pre) verdict = ['bad', 'الخلاصة: الأصل مسموح لكن preflight يفشل. ابعت لي هذه الصفحة كما هي.'];
  else verdict = ['ok', 'الخلاصة: الاتصال سليم من هذا الموقع. إن بقيت الواجهة تفشل فالمشكلة في ملفات الواجهة (lib.js/app.js) أو رمز الدخول، وليست في CORS.'];
  add(verdict[0], verdict[1]);
};

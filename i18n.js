/* LAMHA i18n. Arabic is the source language (the UI is written in Arabic); other languages translate the RENDERED text.
   Add a language: add DICT.<code> (exact Arabic text -> translation) and RULES.<code> (patterns with numbers), plus LANG_NAME.<code>. */
const LANG_NAME = { ar: 'عربي', en: 'EN' };
const RTL = { ar: true };
const DICT = {
  en: {
    'فاتورة الطلب': 'Order invoice', 'إجمالي المنتجات': 'Items total', 'الشحن والرسوم': 'Shipping & fees', 'المدفوع (العربون)': 'Paid (deposit)', 'التاريخ': 'Date', 'لصق': 'Paste', 'الحافظة فارغة': 'Clipboard is empty', 'تعذّر اللصق، الصق الرابط يدوياً': 'Could not paste, paste the link manually',
    // v2 design
    'القائمة': 'Menu', 'ابحث عن منتج أو خدمة…': 'Search for a product or service…', 'اشتراكات رقمية': 'Digital subscriptions', 'شحن الألعاب': 'Game top-up', 'خدمات أخرى': 'Other services', 'بطاقات دولية': 'International cards',
    'هذا القسم قريباً': 'This section is coming soon', 'منتجات مميزة': 'Featured products', 'جميع التصنيفات': 'All categories', 'عرض العروض': 'View offers', 'تفاصيل الطلب': 'Order details', 'أدخل رابط سلة مشتريات SHEIN': 'Enter your SHEIN cart link',
    'جميع الطلبات': 'All orders', 'كروت الألعاب': 'Game cards', 'البيانات الشخصية': 'Personal details', 'إعدادات الحساب': 'Account settings', 'الأمان والتحقق': 'Security & verification', 'الدعم الفني والشكاوى': 'Support & complaints',
    'حول منصة لمحة': 'About LAMHA', 'اللغة': 'Language', 'كل ما تحتاجه في لمحة واحدة': 'Everything you need, in a glimpse', 'منصة لشراء بطاقات الهدايا وشحن الألعاب وطلبات SHEIN، مع محفظة تشحنها عبر Ezone Pay.': 'A platform for gift cards, game top-ups and SHEIN orders, with a wallet you top up via Ezone Pay.',
    // errors / toasts
    'تعذّر الاتصال بالخادم، تحقق من الإنترنت': 'Could not reach the server, check your connection', 'انتهت مهلة الطلب، حاول مرة أخرى': 'The request timed out, please try again', 'انتهت الجلسة، سجّل الدخول من جديد': 'Your session expired, please sign in again',
    'أكمل الاسم الكامل (اسمين على الأقل) ورقم الهاتف من صفحة حسابي ثم أعد المحاولة': 'Add your full name (two names at least) and phone number in My Account, then try again',
    'بيانات اللاعب غير صحيحة أو ناقصة': 'Player details are invalid or incomplete', 'هذه الفئة غير متاحة الآن، جرّب فئة بديلة': 'This category is unavailable now, try another one', 'بيانات المزود غير متوقعة، أبلغ الدعم': 'Unexpected provider data, contact support',
    'سجّل الدخول أولاً': 'Please sign in first', 'لا تملك الصلاحية': 'You do not have permission', 'يجب تأكيد البريد الإلكتروني أولاً': 'Please confirm your email first', 'رصيد المحفظة لا يكفي': 'Insufficient wallet balance',
    'هذه الخدمة متوقفة حالياً': 'This service is currently unavailable', 'هذه الخدمة تتطلب توثيق الحساب': 'This service requires account verification', 'المبلغ خارج الحدود المسموحة': 'Amount is outside the allowed limits',
    'تغيّر السعر، راجع الإجمالي الجديد ثم أكّد من جديد': 'The price changed. Review the new total and confirm again', 'الكتالوج غير مفعّل بعد (بانتظار ربط المزود)': 'Catalog not enabled yet (waiting for provider setup)',
    'رفض المزود الطلب وتم إرجاع المبلغ لمحفظتك': 'The provider rejected the order and your wallet was refunded', 'المزود مشغول، أُعيد المبلغ لمحفظتك. حاول بعد قليل': 'The provider is busy; your wallet was refunded. Try again shortly',
    'غير موجود': 'Not found', 'تحقق من المدخلات': 'Check your input', 'الملف كبير (الحد 5MB)': 'File too large (max 5MB)', 'الصيغة غير مدعومة (JPG/PNG/PDF)': 'Unsupported format (JPG/PNG/PDF)',
    'طلب التوثيق قيد المراجعة': 'Your verification request is under review', 'حسابك موثق': 'Your account is verified', 'تعذّر إنشاء رابط الدفع': 'Could not create the payment link', 'خطأ داخلي، أعد المحاولة': 'Internal error, please retry',
    'رابط السلة منتهي': 'The cart link has expired', 'رابط SHEIN غير صالح': 'Invalid SHEIN link', 'SHEIN رفضت الطلب مؤقتاً، حاول بعد دقائق': 'SHEIN temporarily rejected the request, try again in a few minutes', 'تعذّر قراءة السلة من SHEIN': 'Could not read the cart from SHEIN', 'تعذّر الوصول إلى SHEIN': 'Could not reach SHEIN',
    'منتج غير متاح للطلب': 'Item not available to order', 'منتج نفد': 'Item sold out', 'لا يتوفر سعر بالدولار لهذا المنتج': 'No USD price for this item', 'الكمية غير صالحة (1-100)': 'Invalid quantity (1-100)', 'اختر كمية لمنتج واحد على الأقل': 'Choose a quantity for at least one item',
    'المنتج لم يعد في السلة': 'The item is no longer in the cart', 'خطأ في الخادم': 'Server error', 'العرض لم يعد متاحاً': 'The offer is no longer available', 'الكمية المتوفرة غير كافية': 'Available stock is not enough', 'خطأ غير متوقع': 'Unexpected error', 'تعذّر تنفيذ العملية': 'Could not complete the operation',
    // auth
    'تسجيل الدخول': 'Sign in', 'إنشاء حساب': 'Create account', 'استعادة كلمة المرور': 'Reset password', 'البريد الإلكتروني': 'Email', 'كلمة المرور': 'Password', 'لدي حساب': 'I have an account', 'نسيت كلمة المرور': 'Forgot password', 'أدخل البريد': 'Enter your email',
    'إن كان البريد مسجلاً سيصلك رابط الاستعادة': 'If the email is registered you will receive a reset link', 'كلمة المرور 8 أحرف على الأقل': 'Password must be at least 8 characters', 'تم إنشاء الحساب. أكّد بريدك ثم سجّل الدخول': 'Account created. Confirm your email, then sign in',
    // shop
    'الإشعارات': 'Notifications', 'لا توجد إشعارات': 'No notifications', 'اشحن رصيدك واستمتع بمشترياتك الرقمية!': 'Top up your balance and enjoy your digital purchases!', 'ابدأ الآن': 'Start now', 'أقسام المنتجات': 'Product categories',
    'بطاقات الهدايا': 'Gift cards', 'شحن الألعاب المباشر': 'Direct game top-up', 'ابحث…': 'Search…', 'جارٍ التحميل…': 'Loading…', 'رجوع': 'Back', 'العروض': 'Offers', 'متوفر': 'Available', 'نفد المخزون': 'Out of stock', 'شراء': 'Buy', 'لا توجد نتائج': 'No results',
    'لا توجد باقات نشطة لهذه الفئة الآن.': 'No active packages in this category right now.', 'جرّب فئة بديلة من نفس اللعبة (مثل manual أو reserve) بالرجوع للقائمة.': 'Try another category of the same game (e.g. manual or reserve) from the list.',
    'السعر': 'Price', 'سعر الوحدة': 'Unit price', 'الكمية': 'Quantity', 'الإجمالي': 'Total', 'تأكد من صحة البيانات: لا يمكن تعديلها بعد التأكيد.': 'Double-check the details: they cannot be changed after confirming.',
    'يُخصم من رصيد محفظتك. السعر النهائي يؤكده الخادم.': 'Charged from your wallet balance. The final price is confirmed by the server.', 'تأكيد الشراء': 'Confirm purchase', 'أكمل بيانات اللاعب': 'Fill in the player details',
    'الطلب قيد المراجعة من الإدارة': 'The order is under review by the administration', 'تم إنشاء الطلب': 'Order created', 'تعذّر التحميل': 'Could not load', 'إعادة المحاولة': 'Retry',
    // SHEIN
    'أسعار SHEIN لقطة من السلة وقت القراءة وغير مضمونة. السعر النهائي يُؤكَّد قبل الطلب، ولا يمكن تعديل الطلب بعد دفع العربون.': 'SHEIN prices are a snapshot of the cart at reading time and are not guaranteed. The final price is confirmed before ordering, and the order cannot be edited after the deposit is paid.',
    'رابط مشاركة سلة SHEIN': 'SHEIN cart share link', 'قراءة السلة': 'Read cart', 'السلة': 'Cart', 'مصدر الخصم غير مؤكد (قد لا يكون متاحاً للجميع)': 'Discount source unconfirmed (may not be available to everyone)', 'لا يتوفر سعر بالدولار': 'No USD price',
    'نفد': 'Sold out', 'غير متوفر': 'Unavailable', 'غير قابل للطلب': 'Cannot be ordered', 'احسب الإجمالي': 'Calculate total', 'الشحن': 'Shipping', 'الرسوم': 'Fees', 'العربون المطلوب الآن': 'Deposit due now', 'المتبقي عند الاستلام': 'Remaining on delivery',
    'إلغاء الطلب قبل الشراء: العربون غير مسترد. عند فشل الطلب يُعاد العربون لمحفظتك تلقائياً.': 'Cancelling before purchase: the deposit is non-refundable. If the order fails, the deposit is returned to your wallet automatically.', 'تأكيد الطلب ودفع العربون من المحفظة': 'Confirm order and pay the deposit from wallet',
    // wallet / orders / account
    'الرئيسية': 'Home', 'المحفظة': 'Wallet', 'طلباتي': 'My orders', 'حسابي': 'My account', 'رصيدك الحالي': 'Your current balance', 'مبلغ الشحن (USD)': 'Top-up amount (USD)', 'شحن المحفظة عبر Ezone Pay': 'Top up wallet via Ezone Pay',
    'يُضاف الرصيد تلقائياً فقط بعد تأكيد الدفع من Ezone Pay، وليس بمجرد العودة للموقع.': 'The balance is added automatically only after Ezone Pay confirms the payment, not merely by returning to the site.', 'سجل العمليات': 'Transaction history',
    'إيداع': 'Deposit', 'خصم': 'Debit', 'استرداد': 'Refund', 'لا توجد عمليات': 'No transactions', 'لا توجد طلبات بعد': 'No orders yet', 'الحالة': 'Status', 'المدفوع': 'Paid', 'المنتجات': 'Items', 'مراحل الطلب': 'Order timeline', 'عرض الأكواد': 'Show codes',
    'تقديم شكوى على هذا الطلب': 'File a complaint about this order', 'لا توجد أكواد (تسليم مباشر)': 'No codes (direct delivery)', 'بانتظار الدفع': 'Awaiting payment', 'مدفوع': 'Paid', 'قيد المعالجة': 'Processing', 'مكتمل': 'Completed', 'فشل': 'Failed', 'مسترد': 'Refunded', 'ملغي': 'Cancelled',
    'البريد': 'Email', 'تأكيد البريد': 'Email confirmation', 'مؤكد': 'Confirmed', 'غير مؤكد (تحقق من بريدك)': 'Not confirmed (check your inbox)', 'التوثيق': 'Verification', 'غير موثق': 'Not verified', 'قيد المراجعة': 'Under review', 'موثق': 'Verified', 'مرفوض': 'Rejected',
    'الاسم الكامل (مطلوب للدفع)': 'Full name (required for payment)', 'رقم الهاتف (مثال: +218911234567)': 'Phone number (e.g. +218911234567)', 'حفظ البيانات': 'Save details', 'رفع وثيقة التوثيق (JPG/PNG/PDF حتى 5MB)': 'Upload verification document (JPG/PNG/PDF up to 5MB)', 'إرسال للمراجعة': 'Submit for review',
    'لوحة الإدارة': 'Admin panel', 'الدعم والشكاوى': 'Support & complaints', 'الموضوع': 'Subject', 'التفاصيل': 'Details', 'إرسال': 'Send', 'مفتوحة': 'Open', 'مغلقة': 'Closed', 'تسجيل الخروج': 'Sign out', 'اختر ملفاً': 'Choose a file',
    'تم الحفظ': 'Saved', 'تم إرسال الشكوى': 'Complaint sent', 'تم الإرسال للمراجعة': 'Submitted for review', 'تم': 'Done', 'هذا الحساب ليس من فريق الإدارة.': 'This account is not part of the admin team.',
    // server notifications (stored in Arabic)
    'تم شحن المحفظة': 'Wallet topped up', 'تم استرداد المبلغ إلى محفظتك': 'Refund sent to your wallet', 'اكتمل طلبك': 'Your order is complete', 'أكوادك جاهزة في صفحة الطلب': 'Your codes are ready on the order page', 'تم التسليم': 'Delivered', 'فشل الطلب': 'Order failed',
    'تم استلام العربون': 'Deposit received', 'تم تسليم طلب SHEIN': 'SHEIN order delivered', 'بدأ شراء طلبك': 'Purchasing of your order has started', 'تم توثيق حسابك': 'Your account was verified', 'تم رفض طلب التوثيق': 'Your verification request was rejected',
    'نفد المخزون ': 'Out of stock', 'تغيّر السعر': 'Price changed', 'مشكلة في الحساب المُدخل': 'Problem with the account entered', 'المنتج غير متاح في منطقتك': 'Product not available in your region', 'تجاوز الحد المسموح': 'Limit exceeded', 'انتهت مهلة التنفيذ': 'Execution timed out', 'أُلغي الطلب': 'Order cancelled', 'رُفض الطلب': 'Order declined', 'تعذّر تنفيذ الطلب': 'The order could not be completed',
    // admin
    'لوحة إدارة لمحة': 'LAMHA admin', 'دخول الإدارة': 'Admin sign-in', 'دخول': 'Sign in', 'خروج': 'Sign out', 'لا توجد بيانات': 'No data', 'الإحصائيات': 'Statistics', 'الطلبات': 'Orders', 'طلبات المزود': 'Provider orders', 'العملاء': 'Customers', 'المدفوعات': 'Payments', 'المعاملات المالية': 'Financial transactions', 'الشكاوى': 'Complaints',
    'إعدادات العربون والرسوم': 'Deposit & fee settings', 'التسعير': 'Pricing', 'الخدمات': 'Services', 'المشرفون': 'Staff', 'مدفوعات معلقة': 'Pending payments', 'تحتاج إجراء': 'Need action', 'الإيراد (USD)': 'Revenue (USD)', 'الربح المتوقع (USD)': 'Expected profit (USD)',
    'نسبة عربون SHEIN %': 'SHEIN deposit %', 'شحن SHEIN (USD)': 'SHEIN shipping (USD)', 'رسوم SHEIN الإضافية (USD)': 'SHEIN extra fees (USD)', 'أدنى شحن (USD)': 'Minimum top-up (USD)', 'أقصى شحن (USD)': 'Maximum top-up (USD)', 'حفظ': 'Save',
    'الأولوية: منتج ← خدمة ← عام (لا تُجمع النسب). مفتاح المنتج مثل': 'Priority: product → service → global (percentages are never added). Product key such as', 'أو': 'or', 'إضافة/تعديل قاعدة': 'Add/update a rule', 'النطاق': 'Scope', 'عام': 'Global', 'خدمة': 'Service', 'منتج': 'Product',
    'المفتاح (للخدمة/المنتج)': 'Key (for service/product)', 'نسبة الربح %': 'Profit %', 'ربح ثابت USD': 'Fixed profit USD', 'إيقاف': 'Disable', 'تفعيل': 'Enable', 'إلغاء شرط التوثيق': 'Remove verification requirement', 'اشتراط التوثيق': 'Require verification', 'حذف': 'Delete',
    'إضافة مشرف': 'Add staff member', 'معرّف المستخدم (UUID)': 'User ID (UUID)', 'حفظ الصلاحيات': 'Save permissions', 'بدء الشراء': 'Start purchase', 'مزامنة': 'Sync', 'مطابقة طلب المزود': 'Match provider order', 'فشل + استرداد': 'Fail + refund', 'عرض الوثيقة': 'View document', 'قبول': 'Approve', 'رفض': 'Reject', 'إغلاق': 'Close', 'ربط': 'Link',
    'رجّعنا المبلغ للعميل لكن المزود قد لا يُرجعه تلقائياً: افتح تذكرة عند ReSellCodes.': 'We refunded the customer but the provider may not refund automatically: open a ticket with ReSellCodes.', 'لم نعرف نتيجة الإرسال: طابقه من تبويب الطلبات.': 'The send outcome is unknown: match it from the Orders tab.',
    'عدة طلبات متشابهة: لا تربط إلا بعد التأكد من لوحة المزود.': 'Several similar orders: link only after checking the provider panel.', 'لا يوجد طلب مطابق (السعر والنوع والوقت). تحقق من لوحة المزود قبل أي استرداد.': 'No matching order (price, type, time). Check the provider panel before any refund.', 'تطابق واحد: تأكد منه قبل الربط.': 'One match: verify it before linking.',
    'تأكيد: فشل الطلب واسترداد المبلغ لمحفظة العميل؟': 'Confirm: fail the order and refund the customer wallet?', 'سبب الرفض (يظهر للعميل):': 'Rejection reason (shown to the customer):', 'حذف هذا المشرف؟': 'Delete this staff member?',
    // provider & pricing tab
    'المزود والتسعير': 'Provider & pricing', 'نسب الربح لكل الخدمات': 'Profit rates for all services', 'القاعدة العامة تشمل كل المزودين والخدمات. قاعدة الخدمة تتغلب عليها، وقاعدة المنتج تتغلب على الاثنتين (لا تُجمع النسب).': 'The global rule covers every provider and service. A service rule overrides it, and a product rule overrides both (percentages are never added).',
    'ربح %': 'Profit %', 'ربح ثابت': 'Fixed profit', 'عام (كل الخدمات)': 'Global (all services)', 'جلب الخدمات والعروض من المزود': 'Fetch services and offers from the provider', 'الخدمة': 'Service', 'كل الخدمات (كل المزودين)': 'All services (all providers)', 'بحث': 'Search', 'جلب التصنيفات': 'Fetch categories',
    'اضغط جلب التصنيفات': 'Press "Fetch categories"', 'الاسم': 'Name', 'جلب العروض': 'Fetch offers', 'الأولوية: منتج ← خدمة ← عام (لا تُجمع النسب). سعر البيع = التكلفة × (1 + النسبة) + الربح الثابت.': 'Priority: product → service → global (percentages are never added). Sell price = cost × (1 + percentage) + fixed profit.',
    'اختر تصنيفاً لعرض الأسعار وتعديل الربح': 'Choose a category to see prices and edit profit', 'العرض': 'Offer', 'التكلفة': 'Cost', 'سعر البيع': 'Sell price', 'الربح': 'Profit', 'القاعدة': 'Rule', 'قاعدة منتج': 'Product rule', 'قاعدة خدمة': 'Service rule', 'قاعدة عامة': 'Global rule', 'بدون ربح': 'No profit',
    'إزالة قاعدة المنتج': 'Remove product rule', 'ربح % لكل العروض': 'Profit % for all offers', 'تطبيق على كل عروض التصنيف': 'Apply to all offers in the category', 'قيمة غير صالحة (أرقام فقط، حتى منزلتين عشريتين)': 'Invalid value (numbers only, up to two decimals)', 'تم حفظ الربح': 'Profit saved', 'تمت الإزالة': 'Removed',
    'لم يُجلب الكل: استعمل البحث للباقي': 'Not everything was loaded: use search for the rest', 'تصفية النتائج المحملة…': 'Filter loaded results…', 'عرض المزيد': 'Show more',
    'لا توجد تصنيفات مطابقة': 'No matching categories', 'لا توجد عروض نشطة لهذا التصنيف الآن': 'No active offers in this category right now', 'إزالة قاعدة هذا المنتج؟ سيعود لقاعدة الخدمة أو العامة.': 'Remove this product rule? It will fall back to the service or global rule.', 'تطبيق هذه النسبة على كل عروض التصنيف؟': 'Apply this rate to all offers in the category?',
  },
};
const RULES = {
  en: [
    [/^طلب #(\d+)$/, 'Order #$1'], [/^طلب SHEIN #(\d+)$/, 'SHEIN order #$1'], [/^طلب #(\d+) — (.*)$/, 'Order #$1 — $2'], [/^متوفر: (\d+)$/, 'Available: $1'], [/^يُعرض (\d+) من (\d+)\. استعمل البحث للوصول لباقي التصنيفات\.$/, 'Showing $1 of $2. Use search to find other categories.'],
    [/^وفّر (\S+) \((.*)%\)$/, 'Save $1 ($2%)'], [/^(.*) · رصيد بعد: (.*)$/, '$1 · Balance after: $2'], [/^العملة التي أعادتها SHEIN: (.*) · الأسعار المعتمدة بالدولار فقط · الكميات يحددها العميل$/, 'Currency returned by SHEIN: $1 · Prices used are USD only · You choose the quantities'],
    [/^تم استلام العربون\. طلب #(\d+)$/, 'Deposit received. Order #$1'], [/^اكتب الشكوى أدناه \(طلب #(\d+)\)$/, 'Write your complaint below (order #$1)'], [/^تعذّر التنفيذ: (.*)$/, 'Action failed: $1'],
    [/^التصنيفات \((\d+)\)$/, 'Categories ($1)'], [/^عرض المزيد \((\d+)\)$/, 'Show more ($1)'], [/^العروض \((\d+)\)(\s·)?$/, 'Offers ($1)$2'],
    [/^[a-z_]+: .+$/, (k) => k.split(' | ').map((p) => p.replace(/^([a-z_]+: )(.*)$/, (_m, a, b) => a + trText(b))).join(' | ')], // "service: error text" notes
  ],
};
let LANG = 'ar'; try { LANG = localStorage.getItem('lamha_lang') || 'ar'; } catch { /* private mode */ }
if (LANG !== 'ar' && !DICT[LANG]) LANG = 'ar';
const LANGS = ['ar', ...Object.keys(DICT)];
const AR = /[\u0600-\u06FF]/;
function trText(s) {
  if (LANG === 'ar' || !AR.test(s)) return s;
  const k = s.trim(), d = DICT[LANG]; if (d[k] != null) return s.replace(k, d[k]);
  for (const [re, to] of RULES[LANG] || []) if (re.test(k)) return s.replace(k, k.replace(re, to));
  return s;
}
const tt = trText;
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'data-l'];
function trTree(root) {
  if (LANG === 'ar' || !root) return;
  if (root.nodeType === 3) { const v = trText(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = root; n; n = w.nextNode()) {
    if (n.nodeType === 3) { if (n.parentNode?.closest('[data-notr]')) continue; const v = trText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    else for (const a of ATTRS) if (n.hasAttribute?.(a)) { const v = trText(n.getAttribute(a)); if (v !== n.getAttribute(a)) n.setAttribute(a, v); }
  }
}
function applyLang() {
  document.documentElement.lang = LANG; document.documentElement.dir = RTL[LANG] || LANG === 'ar' ? 'rtl' : 'ltr';
  const adm = location.pathname.includes('admin'); document.title = LANG === 'ar' ? (adm ? 'لوحة إدارة لمحة' : 'لمحة | LAMHA') : (adm ? 'LAMHA admin' : 'LAMHA | Everything in a glimpse');
}
const mo = new MutationObserver((ms) => { if (LANG === 'ar') return; mo.disconnect(); for (const m of ms) { if (m.type === 'characterData') trTree(m.target); else m.addedNodes.forEach(trTree); } mo.observe(document.body, { childList: true, subtree: true, characterData: true }); });
document.addEventListener('DOMContentLoaded', () => { applyLang(); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); trTree(document.body); });
function setLang(l) { if (!LANGS.includes(l)) return; LANG = l; try { localStorage.setItem('lamha_lang', l); } catch { /* ignore */ } applyLang(); document.dispatchEvent(new Event('lamha:lang')); }
const nextLang = () => LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length];
const langBtn = () => `<button data-a="lang" aria-label="Language" data-notr="1">${esc(LANG_NAME[nextLang()] || nextLang().toUpperCase())}</button>`;
const locale = () => (LANG === 'ar' ? 'ar-LY-u-nu-latn' : 'en-GB');

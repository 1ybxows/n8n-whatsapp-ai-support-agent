// Route Message: deterministic rules that run BEFORE the AI agent.
// route: agent | escalate | reply_only | ignore
// Workflow static data (kept only while the workflow is active) holds duplicate ids,
// a failed-answer counter per customer and a short chat history for handoffs.
const MAX_SEEN = 500;
const MAX_HISTORY = 6;
const FAIL_LIMIT = 2;

const store = $getWorkflowStaticData('global');
store.seenIds = store.seenIds || [];
store.fails = store.fails || {};
store.history = store.history || {};

const normAr = (s) =>
  String(s).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const arTokens = (norm) =>
  norm.split(/[^؀-ۿa-z0-9-]+/).filter(Boolean).map((t) => t.replace(/^(وال|بال|لل|ال)(?=.{2,})/, ''));
const arHit = (norm, tokens, kw) => (kw.includes(' ') || kw.length >= 4 ? norm.includes(kw) : tokens.includes(kw));

const NOTICE = {
  en: "I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.",
  ar: 'أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.',
};
NOTICE.und = NOTICE.en + '\n\n' + NOTICE.ar;
const UNSUPPORTED = {
  en: 'I can only read text messages for now. Please type your question and I will help.',
  ar: 'أستطيع قراءة الرسائل النصية فقط حاليًا. من فضلك اكتب سؤالك وسأساعدك.',
};
UNSUPPORTED.und = UNSUPPORTED.en + '\n\n' + UNSUPPORTED.ar;
const UNCLEAR = {
  en: 'Sorry, I did not understand that. Could you write your question in a few words? You can also type "human" to reach a team member.',
  ar: 'عذرًا، لم أفهم رسالتك. هل يمكنك كتابة سؤالك بكلمات قليلة؟ يمكنك أيضًا كتابة "موظف" للتحدث مع أحد أعضاء الفريق.',
};
UNCLEAR.und = UNCLEAR.en + '\n\n' + UNCLEAR.ar;

const STRONG_EN = /\b(scam\w*|fraud\w*|lawyer\w*|sue|chargeback|rip(?:ped)?[- ]?off|steal\w*|stole)\b/i;
const MILD_EN = /\b(worst|terrible|awful|ridiculous|unacceptable|furious|disgusting|useless|angry|fed up|nothing works|waste of (?:my )?money)\b/i;
const STRONG_AR = ['نصب', 'نصاب', 'احتيال', 'حرامي', 'سرقه', 'محامي', 'اقاضي'];
const MILD_AR = ['سيئه جدا', 'خدمه سيئه', 'اسوا', 'اسوء', 'غاضب', 'زفت', 'مهزله', 'غير مقبول', 'مو معقول', 'مش معقول', 'كذابين'];
const HUMAN_EN = /\b(human|real person|live agent|representative|manager|operator)\b|\b(?:talk|speak|chat)\s+(?:to|with)\s+(?:a\s+|an\s+|the\s+)?(?:real\s+|live\s+)?(?:person|human|someone|agent|representative|manager)\b/i;
const HUMAN_AR = ['موظف', 'مدير', 'مسؤول', 'شخص حقيقي', 'انسان', 'بشري'];

const TOPICS = [
  ['refund', /refund|money back|chargeback|cancel/i, ['استرجاع', 'استرداد', 'ارجاع', 'مالي', 'الغاء', 'رد المبلغ']],
  ['certificate', /certificat|diploma/i, ['شهاده', 'شهادات']],
  ['access', /access|log ?in|sign ?in|password|link|download|can'?t open|cannot open|didn'?t (?:get|receive)/i, ['دخول', 'ادخل', 'تسجيل الدخول', 'كلمه المرور', 'رابط', 'تحميل', 'افتح']],
  ['order_status', /\border\b|\bCC-\d{4,6}\b|receipt|invoice|status|tracking|delivery/i, ['طلب', 'طلبي', 'فاتوره', 'ايصال', 'حاله']],
  ['payment', /\bpay|payment|paid|card|paypal|visa|charged|declined/i, ['دفع', 'بطاقه', 'مدفوع']],
  ['pricing', /price|cost|discount|coupon|how much|bundle/i, ['سعر', 'اسعار', 'تكلفه', 'خصم', 'كوبون', 'كم']],
  ['content', /lesson|module|beginner|syllabus|hours|level|learn|language|subtitle|device/i, ['دروس', 'مستوي', 'محتوي', 'ساعات', 'مبتدئ', 'لغه', 'ترجمه', 'جهاز']],
];

function detectTopic(raw, norm, tokens) {
  for (const [topic, re, ar] of TOPICS) {
    if (re.test(raw) || ar.some((k) => arHit(norm, tokens, k))) return topic;
  }
  return 'other';
}

function angerScore(raw, norm) {
  let score = 0;
  if (STRONG_EN.test(raw) || STRONG_AR.some((k) => norm.includes(k))) score += 2;
  if (MILD_EN.test(raw) || MILD_AR.some((k) => norm.includes(k))) score += 1;
  const latin = raw.replace(/[^A-Za-z]/g, '');
  if (latin.length >= 12 && latin.replace(/[^A-Z]/g, '').length / latin.length >= 0.6) score += 1;
  if ((raw.match(/!/g) || []).length >= 3) score += 1;
  return score;
}

function isUnclear(raw) {
  const letters = raw.replace(/[^A-Za-z؀-ۿ]/g, '');
  if (letters.length < 2) return true;
  if (/(.)\1{3,}/.test(raw.replace(/\s/g, ''))) return true;
  if (/[؀-ۿ]/.test(raw)) return false;
  const tokens = raw.match(/[A-Za-z]{3,}/g) || [];
  if (!tokens.length) return false;
  const odd = tokens.filter((t) => !/[aeiouy]/i.test(t) || /[^aeiouy]{5,}/i.test(t)).length;
  return odd / tokens.length >= 0.5;
}

const results = [];
for (const item of $input.all()) {
  const m = item.json;
  const lang = m.language || 'und';
  const raw = String(m.text || '');
  const norm = normAr(raw.toLowerCase());
  const tokens = arTokens(norm);
  const orderMatch = raw.match(/\bCC-\d{4,6}\b/i);
  const out = {
    ...m,
    route: 'agent',
    reason: null,
    reply: '',
    escalate: false,
    outcome: null,
    topic: detectTopic(raw, norm, tokens),
    orderId: orderMatch ? orderMatch[0].toUpperCase() : null,
    sessionKey: m.phone,
  };
  const finish = (route, reason, reply, outcome) => {
    out.route = route;
    out.reason = reason;
    out.reply = reply;
    out.escalate = route === 'escalate';
    out.outcome = outcome;
    out.lastMessages = (store.history[m.phone] || []).slice();
    results.push({ json: out });
  };

  if (!m.waId) { finish('ignore', 'no_sender', '', 'ignored'); continue; }
  if (m.messageId) {
    if (store.seenIds.includes(m.messageId)) { finish('ignore', 'duplicate', '', 'ignored'); continue; }
    store.seenIds.push(m.messageId);
    if (store.seenIds.length > MAX_SEEN) store.seenIds.shift();
  }
  if (!m.supported) { finish('reply_only', 'unsupported_type', UNSUPPORTED[lang], 'reply_only'); continue; }
  if (!raw) { finish('ignore', 'empty', '', 'ignored'); continue; }

  const hist = (store.history[m.phone] = store.history[m.phone] || []);
  hist.push({ from: 'customer', text: raw.slice(0, 300), at: m.receivedAt });
  while (hist.length > MAX_HISTORY) hist.shift();

  const score = angerScore(raw, norm);
  out.angerScore = score;
  if (score >= 2) { finish('escalate', 'unhappy', NOTICE[lang], 'escalated'); continue; }
  if (HUMAN_EN.test(raw) || HUMAN_AR.some((k) => norm.includes(k))) {
    finish('escalate', 'human_requested', NOTICE[lang], 'escalated');
    continue;
  }
  if (isUnclear(raw)) {
    store.fails[m.phone] = (store.fails[m.phone] || 0) + 1;
    if (store.fails[m.phone] >= FAIL_LIMIT) {
      store.fails[m.phone] = 0;
      finish('escalate', 'two_failed_answers', NOTICE[lang], 'escalated');
    } else {
      finish('reply_only', 'unclear', UNCLEAR[lang], 'reply_only');
    }
    continue;
  }
  finish('agent', null, '', null);
}
return results;

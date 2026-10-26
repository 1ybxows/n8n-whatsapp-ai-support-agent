#!/usr/bin/env node
// Writes samples/*.json (made-up WhatsApp Cloud API webhook payloads) and samples/expected.json.
// All people, numbers and ids are invented: numbers are in the fictional 1-555-010-xxxx range.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'samples');
mkdirSync(OUT, { recursive: true });
const P = {
  sam: ['Sam Carter', '15550100101'], layla: ['Layla Samir', '15550100102'], omar: ['Omar Hadi', '15550100103'],
  dana: ['Dana Brooks', '15550100104'], noor: ['Noor Aziz', '15550100105'], priya: ['Priya Menon', '15550100106'],
  tom: ['Tom Reyes', '15550100107'], ken: ['Ken Ortiz', '15550100108'], mia: ['Mia Stone', '15550100109'],
  lena: ['Lena Park', '15550100110'], rami: ['Rami Saad', '15550100111'], hala: ['Hala Yousef', '15550100112'],
  zain: ['Zain Tariq', '15550100113'], dalia: ['Dalia Nouri', '15550100114'],
};
const T0 = 1792900000;
const envelope = (value) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '100000000000001', changes: [{ value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550100000', phone_number_id: '100000000000002' }, ...value }, field: 'messages' }] }],
});
const msg = (who, n, id, body) => {
  const [name, wa] = P[who];
  const base = { from: wa, id: `wamid.DEMO-${id}`, timestamp: String(T0 + n * 60) };
  const m = typeof body === 'string' ? { ...base, type: 'text', text: { body } } : { ...base, ...body };
  return envelope({ contacts: [{ profile: { name }, wa_id: wa }], messages: [m] });
};
const audio = { type: 'audio', audio: { mime_type: 'audio/ogg; codecs=opus', sha256: 'DEMO-SHA256', id: 'DEMO-AUDIO-1', voice: true } };
const image = (caption) => ({ type: 'image', image: { caption, mime_type: 'image/jpeg', sha256: 'DEMO-SHA256', id: 'DEMO-IMAGE-1' } });

const S = [
  ['01-en-faq-access', msg('sam', 1, '0001', 'Hi! How do I access the course after paying?'), { route: 'agent', language: 'en', topic: 'access' }],
  ['02-en-faq-refund-policy', msg('dana', 2, '0002', 'What is your refund policy?'), { route: 'agent', language: 'en', topic: 'refund' }],
  ['03-en-order-status', msg('sam', 3, '0003', 'Where is my order CC-1042?'), { route: 'agent', language: 'en', topic: 'order_status', orderId: 'CC-1042' }],
  ['04-en-refund-ask', msg('sam', 4, '0004', "I want a refund for order CC-1042, it's not what I expected."), { route: 'agent', language: 'en', topic: 'refund', orderId: 'CC-1042' }],
  ['05-en-angry', msg('priya', 5, '0005', 'This is the WORST service!!! I paid and nothing works. Scam. I want my money back NOW'), { route: 'escalate', reason: 'unhappy', language: 'en', topic: 'refund' }],
  ['06-en-gibberish', msg('tom', 6, '0006', 'asdkjh qwrtp zxcvb'), { route: 'reply_only', reason: 'unclear', language: 'en', topic: 'other' }],
  ['07-en-empty', msg('ken', 7, '0007', '   '), { route: 'ignore', reason: 'empty', language: 'und' }],
  ['08-en-voice-note', msg('mia', 8, '0008', audio), { route: 'reply_only', reason: 'unsupported_type', language: 'und' }],
  ['09-en-duplicate', msg('sam', 1, '0001', 'Hi! How do I access the course after paying?'), { route: 'ignore', reason: 'duplicate', language: 'en' }],
  ['10-en-human-request', msg('lena', 10, '0010', 'Can I talk to a real person please?'), { route: 'escalate', reason: 'human_requested', language: 'en', topic: 'other' }],
  ['11-en-delivery-receipt', envelope({ statuses: [{ id: 'wamid.DEMO-0001', status: 'delivered', timestamp: String(T0 + 120), recipient_id: '15550100101' }] }), { produces: false }],
  ['12-en-gibberish-twice', msg('tom', 12, '0012', 'zzzzzz qqqqq'), { route: 'escalate', reason: 'two_failed_answers', language: 'en', topic: 'other' }],
  ['13-ar-faq-access', msg('layla', 13, '0013', 'السلام عليكم، كيف أدخل إلى الدورة بعد الدفع؟'), { route: 'agent', language: 'ar', topic: 'access' }],
  ['14-ar-faq-certificate', msg('omar', 14, '0014', 'هل أحصل على شهادة بعد إنهاء الدورة؟'), { route: 'agent', language: 'ar', topic: 'certificate' }],
  ['15-ar-order-status', msg('layla', 15, '0015', 'أين طلبي رقم CC-1077؟'), { route: 'agent', language: 'ar', topic: 'order_status', orderId: 'CC-1077' }],
  ['16-ar-refund-ask', msg('omar', 16, '0016', 'أريد استرجاع المبلغ للطلب CC-2003 من فضلك'), { route: 'agent', language: 'ar', topic: 'refund', orderId: 'CC-2003' }],
  ['17-ar-angry', msg('noor', 17, '0017', 'هذه خدمة سيئة جدا! أنا غاضب، نصب واحتيال، أريد مالي الآن'), { route: 'escalate', reason: 'unhappy', language: 'ar', topic: 'refund' }],
  ['18-ar-gibberish', msg('rami', 18, '0018', 'ققققق ببببب ؤؤؤؤ'), { route: 'reply_only', reason: 'unclear', language: 'ar', topic: 'other' }],
  ['19-ar-empty', msg('hala', 19, '0019', ''), { route: 'ignore', reason: 'empty', language: 'und' }],
  ['20-ar-voice-note', msg('hala', 20, '0020', audio), { route: 'reply_only', reason: 'unsupported_type', language: 'und' }],
  ['21-ar-duplicate', msg('layla', 13, '0013', 'السلام عليكم، كيف أدخل إلى الدورة بعد الدفع؟'), { route: 'ignore', reason: 'duplicate', language: 'ar' }],
  ['22-ar-human-request', msg('zain', 22, '0022', 'أريد التحدث مع موظف'), { route: 'escalate', reason: 'human_requested', language: 'ar', topic: 'other' }],
  ['23-ar-image-attachment', msg('dalia', 23, '0023', image('هذه صورة الإيصال')), { route: 'reply_only', reason: 'unsupported_type', language: 'und' }],
  ['24-ar-gibberish-twice', msg('rami', 24, '0024', 'هههههههههه ؤؤؤؤ'), { route: 'escalate', reason: 'two_failed_answers', language: 'ar', topic: 'other' }],
];
const expected = {};
for (const [name, payload, exp] of S) {
  writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(payload, null, 2) + '\n');
  expected[`${name}.json`] = exp;
}
writeFileSync(path.join(OUT, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
console.log(`wrote ${S.length} samples + expected.json`);

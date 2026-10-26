// Process Agent Reply (Run Once for Each Item): reads the markers the agent was told to use,
//   [[UNSURE]]            it could not answer from the FAQ, order data or policies
//   [[HANDOFF:reason]]    a person must take over
// strips them, counts failed answers, and decides whether to escalate.
const ctx = $('Route Message').item.json;
const store = $getWorkflowStaticData('global');
store.fails = store.fails || {};
store.history = store.history || {};
const lang = ctx.language || 'und';

const NOTICE = {
  en: "I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.",
  ar: 'أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.',
};
NOTICE.und = NOTICE.en + '\n\n' + NOTICE.ar;
const REPHRASE = {
  en: 'I am not sure about that one, and I do not want to guess. Could you rephrase it, or type "human" to reach a team member?',
  ar: 'لست متأكدًا من ذلك ولا أريد التخمين. هل يمكنك إعادة صياغة سؤالك، أو كتابة "موظف" للتحدث مع أحد أعضاء الفريق؟',
};
REPHRASE.und = REPHRASE.en + '\n\n' + REPHRASE.ar;

const raw = String($input.item.json.output ?? '').trim();
const handoff = raw.match(/\[\[HANDOFF(?::([a-z_]+))?\]\]/i);
const unsure = /\[\[UNSURE\]\]/i.test(raw);
let reply = raw.replace(/\[\[(?:HANDOFF(?::[a-z_]+)?|UNSURE)\]\]/gi, '').trim();

let escalate = false;
let reason = null;
let outcome = 'resolved';
if (handoff) {
  escalate = true;
  reason = handoff[1] ? handoff[1].toLowerCase() : 'agent_handoff';
  outcome = 'escalated';
  store.fails[ctx.phone] = 0;
} else if (unsure || !reply) {
  const n = (store.fails[ctx.phone] || 0) + 1;
  store.fails[ctx.phone] = n;
  if (n >= 2) {
    escalate = true;
    reason = 'two_failed_answers';
    outcome = 'escalated';
    store.fails[ctx.phone] = 0;
  } else {
    outcome = 'unsure';
    reply = REPHRASE[lang];
  }
} else {
  store.fails[ctx.phone] = 0;
}
if (escalate) reply = NOTICE[lang];
reply = reply.slice(0, 900);

const hist = (store.history[ctx.phone] = store.history[ctx.phone] || []);
hist.push({ from: 'bot', text: reply.slice(0, 300), at: new Date().toISOString() });
while (hist.length > 6) hist.shift();

return {
  json: { ...ctx, reply, escalate, reason, outcome, lastMessages: hist.slice() },
};

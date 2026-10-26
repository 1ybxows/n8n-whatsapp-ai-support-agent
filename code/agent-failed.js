// Agent Failed (Run Once for Each Item): the AI Agent node errored (model down, quota, bad key).
// The customer still gets an answer and a person is notified.
const ctx = $('Route Message').item.json;
const lang = ctx.language || 'und';
const NOTICE = {
  en: "I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.",
  ar: 'أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.',
};
NOTICE.und = NOTICE.en + '\n\n' + NOTICE.ar;
return {
  json: {
    ...ctx,
    reply: NOTICE[lang],
    escalate: true,
    reason: 'agent_error',
    outcome: 'escalated',
    agentError: String($input.item.json.error?.message ?? 'unknown').slice(0, 200),
  },
};

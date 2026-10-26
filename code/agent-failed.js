// Agent Failed (Run Once for Each Item): the AI Agent step gave no answer: the node errored (model down, quota, bad key)
// or came back empty. The customer still gets the honest notice and a person is notified.
const ctx = $('Route Message').item.json;
const lang = ctx.language || 'und';
const NOTICE = {
  en: "I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.",
  ar: 'أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.',
};
NOTICE.und = NOTICE.en + '\n\n' + NOTICE.ar;
// The error arrives as text (the agent node's own catch), as an object (the error output),
// or not at all (the node stopped before it ran and passed its input through).
const err = $input.item.json.error;
const detail = typeof err === 'string' ? err : err?.message;
return {
  json: {
    ...ctx,
    reply: NOTICE[lang],
    escalate: true,
    reason: 'agent_error',
    outcome: 'escalated',
    agentError: String(detail || 'the agent gave no answer').slice(0, 200),
  },
};

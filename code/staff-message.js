// Build Staff Message: the text a team member sees in Slack (or Telegram) for a handoff.
const p = $input.first().json;
const LABELS = {
  unhappy: 'Unhappy customer',
  human_requested: 'Customer asked for a person',
  two_failed_answers: 'The bot could not answer twice in a row',
  refund_over_limit: 'Refund above the automatic limit',
  team_task: 'Needs a team member (invoice or account change)',
  payment_dispute: 'Payment problem',
  agent_handoff: 'The agent handed the chat over',
  agent_error: 'The AI step failed',
};
const label = LABELS[p.reason] || p.reason || 'Needs a person';
const langName = p.language === 'ar' ? 'Arabic' : p.language === 'en' ? 'English' : 'unknown';
const msgs = Array.isArray(p.lastMessages) ? p.lastMessages : [];
const lines = msgs.slice(-6).map((m) => `${m.from === 'bot' ? 'Bot' : 'Customer'}: ${String(m.text ?? '').replace(/\s+/g, ' ').slice(0, 300)}`);
const text = [
  `Handoff needed: ${label}`,
  `Customer: ${p.name || 'Unknown'} (${p.phone})`,
  `Language: ${langName} | Topic: ${p.topic || 'n/a'}${p.order_id ? ' | Order: ' + p.order_id : ''}`,
  '',
  'Last messages:',
  ...(lines.length ? lines : ['(none recorded)']),
  '',
  'Reply to the customer in WhatsApp. The bot already told them a person will reply.',
].join('\n');
return [{ json: { text: text.slice(0, 3500), reason: p.reason, label } }];

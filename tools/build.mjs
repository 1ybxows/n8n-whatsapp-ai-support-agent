#!/usr/bin/env node
// Builds workflows/*.json (n8n 2.x) from code/*.js (the Code node sources) and kb/faq.md.
// Usage: node tools/build.mjs     (no installs, no network)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFaq } from './kb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readCode = (f) => readFileSync(path.join(ROOT, 'code', f), 'utf8').trimEnd() + '\n';
const kb = parseFaq(readFileSync(path.join(ROOT, 'kb', 'faq.md'), 'utf8'));

const NOTE =
  'Demo on made-up data. Not imported into or run on a live n8n instance and not connected to a live WhatsApp number. No credential is configured: every credential is a placeholder with id REPLACE_ME.';
const uid = (s) => {
  const h = createHash('sha1').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const cred = (type, label) => ({ [type]: { id: 'REPLACE_ME', name: `${label} (placeholder)` } });

class Flow {
  constructor(file, name) {
    this.file = file;
    this.name = name;
    this.nodes = [];
    this.connections = {};
  }
  add(name, type, typeVersion, parameters, position, extra = {}) {
    if (this.nodes.some((n) => n.name === name)) throw new Error(`duplicate node name: ${name}`);
    const { credentials, ...rest } = extra;
    this.nodes.push({ parameters, id: uid(`${this.file}:${name}`), name, type, typeVersion, position, ...(credentials ? { credentials } : {}), ...rest });
    return name;
  }
  link(from, to, { out = 0, input = 0, kind = 'main' } = {}) {
    const byKind = (this.connections[from] ||= {});
    const outs = (byKind[kind] ||= []);
    while (outs.length <= out) outs.push([]);
    outs[out].push({ node: to, type: kind, index: input });
  }
  chain(...names) {
    for (let i = 0; i < names.length - 1; i++) this.link(names[i], names[i + 1]);
  }
  json() {
    return { name: this.name, nodes: this.nodes, pinData: {}, connections: this.connections, active: false, settings: { executionOrder: 'v1' }, meta: { templateNote: NOTE } };
  }
}

// ---------- parameter helpers ----------
const code = (file, mode) => ({ jsCode: readCode(file), ...(mode ? { mode } : {}) });
const sticky = (content, width, height, color) => ({ content, width, height, ...(color ? { color } : {}) });
const strEq = (left, right) => ({ id: uid(`cond:${left}:${right}`), leftValue: left, rightValue: right, operator: { type: 'string', operation: 'equals' } });
const isTrue = (left) => ({ id: uid(`cond:${left}`), leftValue: left, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } });
const notEmpty = (left) => ({ id: uid(`cond:${left}`), leftValue: left, rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } });
const ifParams = (cond) => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [cond], combinator: 'and' }, options: {} });
const assign = (name, value, type = 'string') => ({ id: uid(`assign:${name}`), name, value, type });
const setParams = (...assignments) => ({ assignments: { assignments }, includeOtherFields: false, options: {} });
const sheet = (tab) => ({ documentId: { __rl: true, value: 'REPLACE_ME_SPREADSHEET_ID', mode: 'id' }, sheetName: { __rl: true, value: tab, mode: 'name' } });
const columns = (value) => ({ mappingMode: 'defineBelow', value, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: false });
const subWorkflow = (placeholder, label, inputs) => ({
  workflowId: { __rl: true, value: placeholder, mode: 'id', cachedResultName: label },
  workflowInputs: { mappingMode: 'defineBelow', value: inputs, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
  options: {},
});
const trigger = (...fields) => ({ inputSource: 'workflowInputs', workflowInputs: { values: fields.map(([name, type = 'string']) => ({ name, type })) } });
const retry = (tries = 3, wait = 5000) => ({ retryOnFail: true, maxTries: tries, waitBetweenTries: wait });
const RR = (field) => `={{ $('Reply Ready').item.json.${field} }}`;

// =====================================================================
// 1. support-agent.json
// =====================================================================
const sa = new Flow('support-agent', 'Cedar Course Co. - WhatsApp Support Agent (demo, not live)');
sa.add('Read Me', 'n8n-nodes-base.stickyNote', 1, sticky(
  '## Demo on made-up data\nCedar Course Co. is a fictional store. This workflow has NOT been run on a live n8n or a live WhatsApp number.\n\n1. Rules run first (code, no AI): duplicates, empty, voice notes, anger, "human please", gibberish.\n2. Only normal questions reach the AI Agent. It has 3 tools: FAQ, order lookup, refund request.\n3. The agent marks doubt with [[UNSURE]] or [[HANDOFF:reason]]. Code reads those marks.\n4. Anything risky goes to a person through the Escalation workflow.\n\nSet the Error Workflow of every workflow to "Error Handler" in Workflow Settings (UI only).',
  560, 330), [-700, -440]);
sa.add('WhatsApp Trigger', 'n8n-nodes-base.whatsAppTrigger', 1, { updates: ['messages'] }, [-640, 0], { credentials: cred('whatsAppTriggerApi', 'WhatsApp trigger account'), webhookId: uid('support-agent:webhook') });
sa.add('Normalize Message', 'n8n-nodes-base.code', 2, code('normalize-message.js'), [-420, 0]);
sa.add('Detect Language', 'n8n-nodes-base.code', 2, code('detect-language.js'), [-200, 0]);
sa.add('Route Message', 'n8n-nodes-base.code', 2, code('route-message.js'), [20, 0]);
sa.add('Needs Agent?', 'n8n-nodes-base.if', 2.2, ifParams(strEq('={{ $json.route }}', 'agent')), [240, 0]);

const SYSTEM = [
  '=You are the WhatsApp support assistant for Cedar Course Co., a small online store that sells one digital course with a one-time payment. Today is {{ $now.format(\'DDDD\') }}.',
  '',
  'The customer is {{ $json.name }}. Reply in {{ $json.language === \'ar\' ? \'Arabic\' : \'English\' }}. If the customer changes language, change with them.',
  '',
  'Rules:',
  '1. Answer only from the search_faq tool, the order tools and the facts in this message. Never guess a price, date or policy. If the tools do not give the answer, say you are not sure and end your reply with [[UNSURE]].',
  '2. Order questions: call look_up_order with the order number the customer wrote (format CC-1234). If they gave none, ask for it. Share only what the tool returns.',
  '3. Refunds: you cannot approve refunds. When the customer clearly asks for one and gave an order number, call request_refund with their reason. Repeat the tool answer in plain words and promise nothing else. If the tool says the order is above the automatic limit, end your reply with [[HANDOFF:refund_over_limit]].',
  '4. If the customer needs something only a person can do (a company invoice, an account or email change, a payment problem, a legal threat), write one short sentence and end with [[HANDOFF:team_task]] or [[HANDOFF:payment_dispute]].',
  '5. Never ask for or accept card numbers, passwords or one-time codes. If the customer sends them, tell them to delete the message.',
  '6. Keep answers under 80 words, friendly and plain, with no tables or markdown. One emoji at most.',
  '7. The marks [[UNSURE]] and [[HANDOFF:reason]] are read by the workflow and removed before the customer sees your message.',
].join('\n');
sa.add('Customer Support Agent', '@n8n/n8n-nodes-langchain.agent', 3.1, {
  promptType: 'define',
  text: '={{ $json.text }}',
  options: { systemMessage: SYSTEM, maxIterations: 12 },
}, [480, -160], { onError: 'continueErrorOutput', ...retry(2, 3000) });
sa.add('OpenAI Chat Model', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 1.2, {
  model: { __rl: true, mode: 'list', value: 'gpt-4o-mini', cachedResultName: 'gpt-4o-mini' },
  options: { temperature: 0.2, maxTokens: 500 },
}, [340, 220], { credentials: cred('openAiApi', 'OpenAI account') });
sa.add('Chat Memory', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3, { sessionIdType: 'customKey', sessionKey: '={{ $json.sessionKey }}', contextWindowLength: 20 }, [520, 220]);
sa.add('Search FAQ', '@n8n/n8n-nodes-langchain.toolCode', 1.3, {
  name: 'search_faq',
  description: 'Search the Cedar Course Co. FAQ and policies (access, devices, price, payment methods, refund policy, certificate, course level, invoices, support hours, language). Input: a short search phrase in the customer\'s own words, English or Arabic, for example "refund policy" or "شهادة". Returns up to 2 matching FAQ entries, or NO_MATCH when the FAQ has no answer.',
  jsCode: readCode('faq-search.js').replace('__KB__', JSON.stringify(kb)),
}, [700, 220]);
sa.add('Look Up Order', '@n8n/n8n-nodes-langchain.toolWorkflow', 2.2, {
  name: 'look_up_order',
  description: 'Look up ONE order by its order number (format CC-1234). Use when the customer asks where their order is, whether a payment went through, or what they bought, and they gave an order number (ask for it if not). Returns status, product, amount and purchase date, only when the order belongs to the customer\'s WhatsApp number. Never guess an order number.',
  source: 'database',
  ...subWorkflow('REPLACE_ME_ORDER_LOOKUP_WORKFLOW_ID', 'Cedar Course Co. - Order Lookup (tool, demo)', {
    order_id: "={{ $fromAI('order_id', 'The order number the customer wrote, format CC-1234', 'string') }}",
    customer_phone: "={{ $('Route Message').item.json.phone }}",
  }),
}, [880, 220]);
sa.add('Request Refund', '@n8n/n8n-nodes-langchain.toolWorkflow', 2.2, {
  name: 'request_refund',
  description: 'Log a refund REQUEST for one order after the customer clearly asks for a refund and gave an order number. The system itself checks ownership, the 14-day window and the automatic limit; you cannot change its decision. Returns what happened and the exact meaning to tell the customer. Parameters: order_id (format CC-1234); reason (the customer\'s reason in one short English sentence).',
  source: 'database',
  ...subWorkflow('REPLACE_ME_REFUND_REQUEST_WORKFLOW_ID', 'Cedar Course Co. - Refund Request (tool, demo)', {
    order_id: "={{ $fromAI('order_id', 'The order number the customer wrote, format CC-1234', 'string') }}",
    reason: "={{ $fromAI('reason', 'Why the customer wants a refund, one short sentence in English', 'string') }}",
    customer_phone: "={{ $('Route Message').item.json.phone }}",
    customer_name: "={{ $('Route Message').item.json.name }}",
    message_id: "={{ $('Route Message').item.json.messageId }}",
    language: "={{ $('Route Message').item.json.language }}",
  }),
}, [1060, 220]);
sa.add('Process Agent Reply', 'n8n-nodes-base.code', 2, code('process-agent-reply.js', 'runOnceForEachItem'), [900, -200]);
sa.add('Agent Failed', 'n8n-nodes-base.code', 2, code('agent-failed.js', 'runOnceForEachItem'), [900, -20]);
// The Agent node does not always use its error output: if it stops before it runs (bad credential, model not reachable) it passes
// its input through with no "output" on the normal branch. So a missing or blank answer is treated as a failure here.
sa.add('Agent Answered?', 'n8n-nodes-base.if', 2.2, ifParams(isTrue("={{ String($json.output ?? '').trim() !== '' }}")), [690, -160]);
sa.add('Reply Ready', 'n8n-nodes-base.noOp', 1, {}, [1120, 0]);
sa.add('Has Reply?', 'n8n-nodes-base.if', 2.2, ifParams(notEmpty('={{ $json.reply }}')), [1340, 0]);
sa.add('Send WhatsApp Reply', 'n8n-nodes-base.whatsApp', 1.1, {
  resource: 'message',
  operation: 'send',
  phoneNumberId: 'REPLACE_ME_PHONE_NUMBER_ID',
  recipientPhoneNumber: '={{ $json.waId }}',
  messageType: 'text',
  textBody: '={{ $json.reply }}',
  additionalFields: {},
}, [1560, -100], { credentials: cred('whatsAppApi', 'WhatsApp Business Cloud account'), onError: 'continueErrorOutput', ...retry() });
sa.add('Log Conversation', 'n8n-nodes-base.googleSheets', 4.7, {
  operation: 'append',
  ...sheet('Conversations'),
  columns: columns({
    logged_at: '={{ $now.toISO() }}',
    message_id: RR('messageId'),
    customer: "={{ '…' + String($('Reply Ready').item.json.phone).slice(-4) }}",
    language: RR('language'),
    message_type: RR('type'),
    topic: RR('topic'),
    route: RR('route'),
    outcome: RR('outcome'),
    escalation_reason: "={{ $('Reply Ready').item.json.reason || '' }}",
    order_id: "={{ $('Reply Ready').item.json.orderId || '' }}",
    delivery: "={{ $json.error ? 'failed' : ($json.messages ? 'sent' : 'no_reply') }}",
  }),
  options: {},
}, [1780, 0], { credentials: cred('googleSheetsOAuth2Api', 'Google Sheets account'), onError: 'continueRegularOutput', ...retry() });
sa.add('Needs Human?', 'n8n-nodes-base.if', 2.2, ifParams(isTrue(RR('escalate'))), [2000, 0]);
sa.add('Notify Team', 'n8n-nodes-base.executeWorkflow', 1.2, subWorkflow('REPLACE_ME_ESCALATION_WORKFLOW_ID', 'Cedar Course Co. - Escalation (demo)', {
  phone: RR('phone'),
  name: RR('name'),
  language: RR('language'),
  reason: RR('reason'),
  topic: RR('topic'),
  order_id: "={{ $('Reply Ready').item.json.orderId || '' }}",
  lastMessages: RR('lastMessages'),
}), [2220, -80], { onError: 'continueRegularOutput' });

sa.link('WhatsApp Trigger', 'Normalize Message');
sa.chain('Normalize Message', 'Detect Language', 'Route Message', 'Needs Agent?');
sa.link('Needs Agent?', 'Customer Support Agent', { out: 0 });
sa.link('Needs Agent?', 'Reply Ready', { out: 1 });
sa.link('Customer Support Agent', 'Agent Answered?', { out: 0 });
sa.link('Agent Answered?', 'Process Agent Reply', { out: 0 });
sa.link('Agent Answered?', 'Agent Failed', { out: 1 });
sa.link('Customer Support Agent', 'Agent Failed', { out: 1 });
sa.link('Process Agent Reply', 'Reply Ready');
sa.link('Agent Failed', 'Reply Ready');
sa.link('Reply Ready', 'Has Reply?');
sa.link('Has Reply?', 'Send WhatsApp Reply', { out: 0 });
sa.link('Has Reply?', 'Log Conversation', { out: 1 });
sa.link('Send WhatsApp Reply', 'Log Conversation', { out: 0 });
sa.link('Send WhatsApp Reply', 'Log Conversation', { out: 1 });
sa.link('Log Conversation', 'Needs Human?');
sa.link('Needs Human?', 'Notify Team', { out: 0 });
sa.link('OpenAI Chat Model', 'Customer Support Agent', { kind: 'ai_languageModel' });
sa.link('Chat Memory', 'Customer Support Agent', { kind: 'ai_memory' });
for (const tool of ['Search FAQ', 'Look Up Order', 'Request Refund']) sa.link(tool, 'Customer Support Agent', { kind: 'ai_tool' });

// =====================================================================
// 2. escalation.json (sub-workflow)
// =====================================================================
const es = new Flow('escalation', 'Cedar Course Co. - Escalation (demo, not live)');
es.add('Read Me', 'n8n-nodes-base.stickyNote', 1, sticky(
  '## Handoff to a person\nCalled by "Notify Team" in the support agent.\n\nSlack is on by default. To use Telegram instead: disable "Post to Slack" and enable "Post to Telegram (optional)", then pick your Telegram credential and chat id.\n\nIf this posting fails, the Error Workflow (set in Workflow Settings) alerts you on a different channel.',
  520, 240), [-420, -300]);
es.add('Handoff Input', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, trigger(['phone'], ['name'], ['language'], ['reason'], ['topic'], ['order_id'], ['lastMessages', 'array']), [-300, 0]);
es.add('Build Staff Message', 'n8n-nodes-base.code', 2, code('staff-message.js'), [-80, 0]);
es.add('Post to Slack', 'n8n-nodes-base.slack', 2.3, {
  resource: 'message',
  operation: 'post',
  select: 'channel',
  channelId: { __rl: true, value: 'REPLACE_ME_CHANNEL_ID', mode: 'id' },
  text: '={{ $json.text }}',
  otherOptions: {},
}, [160, -60], { credentials: cred('slackApi', 'Slack account'), ...retry() });
es.add('Post to Telegram (optional)', 'n8n-nodes-base.telegram', 1.2, {
  chatId: 'REPLACE_ME_CHAT_ID',
  text: '={{ $json.text }}',
  additionalFields: { appendAttribution: false },
}, [160, 100], { credentials: cred('telegramApi', 'Telegram bot'), disabled: true, ...retry() });
es.link('Handoff Input', 'Build Staff Message');
es.link('Build Staff Message', 'Post to Slack');
es.link('Build Staff Message', 'Post to Telegram (optional)');

// =====================================================================
// 3. order-lookup.json (sub-workflow used as an agent tool)
// =====================================================================
const ol = new Flow('order-lookup', 'Cedar Course Co. - Order Lookup (tool, demo, not live)');
ol.add('Read Me', 'n8n-nodes-base.stickyNote', 1, sticky(
  '## Order lookup tool\n1. Ask the payment API (placeholder URL api.payments.example.com).\n2. If that fails or finds nothing, read the "Orders" sheet instead (the demo data source).\n3. Share details only if the order belongs to the WhatsApp number that asked.\n\nPlaceholder API answer shape: { id, status, product: { name }, amount, currency, created_at, customer: { phone, name } }.',
  560, 250), [-460, -320]);
ol.add('Tool Input', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, trigger(['order_id'], ['customer_phone']), [-400, 0]);
ol.add('Validate Order ID', 'n8n-nodes-base.code', 2, code('validate-order-id.js'), [-180, 0]);
ol.add('Valid ID?', 'n8n-nodes-base.if', 2.2, ifParams(isTrue('={{ $json.valid }}')), [40, 0]);
ol.add('Payment API Lookup', 'n8n-nodes-base.httpRequest', 4.2, {
  method: 'GET',
  url: '=https://api.payments.example.com/v1/orders/{{ $json.order_id }}',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  options: { timeout: 8000 },
}, [260, -80], { credentials: cred('httpHeaderAuth', 'Payment API key'), onError: 'continueErrorOutput', ...retry(2, 2000) });
ol.add('Orders Sheet Fallback', 'n8n-nodes-base.googleSheets', 4.7, {
  operation: 'read',
  ...sheet('Orders'),
  filtersUI: { values: [{ lookupColumn: 'order_id', lookupValue: "={{ $('Validate Order ID').item.json.order_id }}" }] },
  options: {},
}, [480, 80], { credentials: cred('googleSheetsOAuth2Api', 'Google Sheets account'), alwaysOutputData: true });
ol.add('Normalize Order', 'n8n-nodes-base.code', 2, code('normalize-order.js'), [700, 0]);
ol.add('Invalid ID Result', 'n8n-nodes-base.set', 3.4, setParams(
  assign('found', false, 'boolean'),
  assign('order_id', "={{ $json.order_id }}"),
  assign('message', '=That does not look like an order number. Order numbers look like CC-1234. Ask the customer to check their receipt email.'),
), [260, 200]);
ol.link('Tool Input', 'Validate Order ID');
ol.link('Validate Order ID', 'Valid ID?');
ol.link('Valid ID?', 'Payment API Lookup', { out: 0 });
ol.link('Valid ID?', 'Invalid ID Result', { out: 1 });
ol.link('Payment API Lookup', 'Normalize Order', { out: 0 });
ol.link('Payment API Lookup', 'Orders Sheet Fallback', { out: 1 });
ol.link('Orders Sheet Fallback', 'Normalize Order');

// =====================================================================
// 4. refund-request.json (sub-workflow used as an agent tool)
// =====================================================================
const rf = new Flow('refund-request', 'Cedar Course Co. - Refund Request (tool, demo, not live)');
rf.add('Read Me', 'n8n-nodes-base.stickyNote', 1, sticky(
  '## Refund request tool\nThe agent only asks. This workflow decides.\n\n- Not found, not the sender\'s order, already refunded, not paid, older than 14 days: nothing is logged.\n- Over 150 USD: nothing is logged; the agent hands the chat to a person.\n- Otherwise one row goes to the "Refunds" sheet with status "pending approval". A person approves it by hand.\n\nThis workflow never moves money.',
  560, 270), [-460, -340]);
rf.add('Tool Input', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, trigger(['order_id'], ['reason'], ['customer_phone'], ['customer_name'], ['message_id'], ['language']), [-400, 0]);
rf.add('Look Up Order', 'n8n-nodes-base.executeWorkflow', 1.2, subWorkflow('REPLACE_ME_ORDER_LOOKUP_WORKFLOW_ID', 'Cedar Course Co. - Order Lookup (tool, demo)', {
  order_id: '={{ $json.order_id }}',
  customer_phone: '={{ $json.customer_phone }}',
}), [-180, 0]);
rf.add('Refund Policy Check', 'n8n-nodes-base.code', 2, code('refund-policy.js'), [40, 0]);
rf.add('Can Log Refund?', 'n8n-nodes-base.if', 2.2, ifParams(strEq('={{ $json.decision }}', 'ok')), [260, 0]);
rf.add('Append Refund Row', 'n8n-nodes-base.googleSheets', 4.7, {
  operation: 'append',
  ...sheet('Refunds'),
  columns: columns(Object.fromEntries(['requested_at', 'message_id', 'customer_phone', 'customer_name', 'order_id', 'product', 'amount', 'currency', 'reason', 'language', 'status', 'handled_by', 'handled_at'].map((c) => [c, `={{ $json.refundRow.${c} }}`]))),
  options: {},
}, [480, -60], { credentials: cred('googleSheetsOAuth2Api', 'Google Sheets account'), ...retry() });
rf.add('Return Result', 'n8n-nodes-base.set', 3.4, setParams(
  assign('decision', "={{ $('Refund Policy Check').item.json.decision }}"),
  assign('result', "={{ $('Refund Policy Check').item.json.message }}"),
), [700, 60]);
rf.chain('Tool Input', 'Look Up Order', 'Refund Policy Check', 'Can Log Refund?');
rf.link('Can Log Refund?', 'Append Refund Row', { out: 0 });
rf.link('Can Log Refund?', 'Return Result', { out: 1 });
rf.link('Append Refund Row', 'Return Result');

// =====================================================================
// 5. weekly-report.json
// =====================================================================
const wr = new Flow('weekly-report', 'Cedar Course Co. - Weekly Support Report (demo, not live)');
wr.add('Read Me', 'n8n-nodes-base.stickyNote', 1, sticky(
  '## Weekly report\nEvery Monday 08:00 (set your timezone in Workflow Settings). Reads the "Conversations" and "Refunds" sheets, counts the last 7 days, posts to Slack.\n\nTo email it instead: disable "Post to Slack", enable "Email Report (optional)", add an SMTP credential.\n\nBoth sheets are read in full: fine for a small shop, not for a very large log.',
  520, 240), [-420, -300]);
wr.add('Every Monday 08:00', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } }, [-380, 0]);
wr.add('Read Conversations', 'n8n-nodes-base.googleSheets', 4.7, { operation: 'read', ...sheet('Conversations'), options: {} }, [-160, -80], { credentials: cred('googleSheetsOAuth2Api', 'Google Sheets account'), alwaysOutputData: true, ...retry() });
wr.add('Read Refunds', 'n8n-nodes-base.googleSheets', 4.7, { operation: 'read', ...sheet('Refunds'), options: {} }, [-160, 100], { credentials: cred('googleSheetsOAuth2Api', 'Google Sheets account'), alwaysOutputData: true, ...retry() });
wr.add('Combine Rows', 'n8n-nodes-base.merge', 3.2, {}, [60, 0]);
wr.add('Build Weekly Report', 'n8n-nodes-base.code', 2, code('report-counts.js'), [280, 0]);
wr.add('Post to Slack', 'n8n-nodes-base.slack', 2.3, {
  resource: 'message',
  operation: 'post',
  select: 'channel',
  channelId: { __rl: true, value: 'REPLACE_ME_CHANNEL_ID', mode: 'id' },
  text: '={{ $json.text }}',
  otherOptions: {},
}, [500, -60], { credentials: cred('slackApi', 'Slack account'), ...retry() });
wr.add('Email Report (optional)', 'n8n-nodes-base.emailSend', 2.1, {
  fromEmail: 'reports@example.com',
  toEmail: 'owner@example.com',
  subject: '={{ $json.subject }}',
  emailFormat: 'text',
  text: '={{ $json.text }}',
  options: {},
}, [500, 100], { credentials: cred('smtp', 'SMTP account'), disabled: true });
wr.link('Every Monday 08:00', 'Read Conversations');
wr.link('Every Monday 08:00', 'Read Refunds');
wr.link('Read Conversations', 'Combine Rows', { input: 0 });
wr.link('Read Refunds', 'Combine Rows', { input: 1 });
wr.link('Combine Rows', 'Build Weekly Report');
wr.link('Build Weekly Report', 'Post to Slack');
wr.link('Build Weekly Report', 'Email Report (optional)');

// =====================================================================
// 6. error-handler.json
// =====================================================================
const eh = new Flow('error-handler', 'Cedar Course Co. - Error Handler (demo, not live)');
eh.add('Read Me', 'n8n-nodes-base.stickyNote', 1, sticky(
  '## Catch-all error workflow\nAssign it as the Error Workflow of the support agent, escalation, order lookup, refund request and weekly report workflows (Workflow Settings, UI only: it cannot be set by importing JSON).\n\nIt alerts on Telegram on purpose, not Slack: if Slack is the thing that broke, this alert still arrives.',
  520, 230), [-420, -280]);
eh.add('Error Trigger', 'n8n-nodes-base.errorTrigger', 1, {}, [-300, 0]);
eh.add('Build Alert', 'n8n-nodes-base.set', 3.4, setParams(
  assign('workflowName', '={{ $json.workflow.name }}'),
  assign('failedNode', '={{ $json.execution.lastNodeExecuted }}'),
  assign('errorMessage', '={{ $json.execution.error.message }}'),
  assign('executionUrl', '={{ $json.execution.url }}'),
  assign('text', '=Workflow failed: {{ $json.workflow.name }}\nNode: {{ $json.execution.lastNodeExecuted }}\nError: {{ $json.execution.error.message }}\nExecution: {{ $json.execution.url }}'),
), [-80, 0]);
eh.add('Alert on Telegram', 'n8n-nodes-base.telegram', 1.2, {
  chatId: 'REPLACE_ME_CHAT_ID',
  text: '={{ $json.text }}',
  additionalFields: { appendAttribution: false },
}, [160, 0], { credentials: cred('telegramApi', 'Telegram bot'), ...retry() });
eh.chain('Error Trigger', 'Build Alert', 'Alert on Telegram');

// ---------- write ----------
mkdirSync(path.join(ROOT, 'workflows'), { recursive: true });
for (const f of [sa, es, ol, rf, wr, eh]) {
  writeFileSync(path.join(ROOT, 'workflows', `${f.file}.json`), JSON.stringify(f.json(), null, 2) + '\n');
  console.log(`wrote workflows/${f.file}.json  (${f.nodes.length} nodes)`);
}

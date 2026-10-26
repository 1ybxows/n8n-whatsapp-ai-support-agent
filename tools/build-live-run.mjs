#!/usr/bin/env node
// Builds the LIVE-RUN test harness for a real n8n instance:
//   test/live-run.json                       the main harness (Manual trigger -> the 24 made-up samples -> the support-agent steps)
//   test/live-run-tool-order-lookup.json     sandbox copy of the Order Lookup tool (Orders table embedded, no payment API, no Sheets)
//   test/live-run-tool-refund-request.json   sandbox copy of the Refund Request tool (refund row is captured, not appended)
// Usage: node tools/build-live-run.mjs     (no installs, no network; run `node tools/build.mjs` first if code/ changed)
//
// The harness is DERIVED from workflows/*.json, so the nodes under test are the real ones: Normalize Message, Detect Language,
// Route Message, the AI Agent with its real OpenAI chat model, memory and tools, Process Agent Reply, Agent Failed.
// Only what would leave the machine is swapped for a "Capture" Code node that records what would be sent and sends nothing:
// WhatsApp send, Google Sheets writes and reads, the payment API, Slack/Telegram.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (...p) => readFileSync(path.join(ROOT, ...p), 'utf8');
const wf = (n) => JSON.parse(rd('workflows', `${n}.json`));
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = (s) => {
  const h = createHash('sha1').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

// Fixed workflow ids, so the tool nodes can point at the sandbox tools after `n8n import:workflow`.
const ID = { main: 'cedarLiveRun0001', mainAnthropic: 'cedarLiveRun0002', order: 'cedarLiveTool0001', refund: 'cedarLiveTool0002' };
const CRED_NAME_ANTHROPIC = 'Anthropic demo'; // same idea for the Anthropic copy of the harness
const ANTHROPIC_MODEL = 'claude-haiku-5-5'; // the cheapest current Haiku; if n8n says "model not found", pick another in the node
const CRED_NAME = 'OpenAI demo'; // the credential the person running the test creates in the n8n UI
const NOTE =
  'LIVE-RUN test harness. Runs the demo steps on a real n8n with a real OpenAI chat model, on made-up messages only. Every send (WhatsApp, Sheets, payment API, Slack, Telegram) is replaced by a Capture node that records and sends nothing.';

const csv = (f) => {
  const [head, ...rows] = rd('sheets', f).trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => {
    if (r.includes('"')) throw new Error(`${f}: quoted CSV fields are not supported by this builder`);
    const v = r.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? '']));
  });
};
const conn = (to) => to.map((o) => o.map((node) => ({ node, type: 'main', index: 0 })));
const codeNode = (name, jsCode, position, each = true) => ({
  parameters: { jsCode, ...(each ? { mode: 'runOnceForEachItem' } : {}) },
  id: uid(`live:${name}`),
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
});
const mustReplace = (src, from, to) => {
  if (!src.includes(from)) throw new Error(`code changed: expected to find ${JSON.stringify(from.slice(0, 60))}`);
  return src.replace(from, to);
};
// Point every connection that used the old node name at the new name (keys and targets).
const rename = (flow, from, to) => {
  if (!flow.nodes.some((x) => x.name === to)) throw new Error(`no node ${to}`);
  const next = {};
  for (const [k, v] of Object.entries(flow.connections)) {
    for (const outs of Object.values(v)) for (const o of outs) for (const c of o) if (c.node === from) c.node = to;
    next[k === from ? to : k] = v;
  }
  flow.connections = next;
};
const finish = (flow, id, name, note = NOTE) => {
  flow.id = id;
  flow.name = name;
  flow.active = false;
  flow.pinData = {};
  flow.settings = { executionOrder: 'v1', executionTimeout: 900 };
  flow.meta = { templateNote: note };
  return flow;
};

// ---------- 1. sandbox Order Lookup tool ----------
const ol = clone(wf('order-lookup'));
const orders = csv('Orders.csv');
{
  const pay = ol.nodes.find((n) => n.name === 'Payment API Lookup');
  ol.nodes = ol.nodes.filter((n) => !['Read Me', 'Payment API Lookup', 'Orders Sheet Fallback'].includes(n.name));
  ol.nodes.push(
    codeNode(
      'Orders Sandbox Data',
      [
        '// Orders Sandbox Data: stands in for the payment-API call and the Orders sheet read (nothing leaves this machine).',
        '// The rows are the made-up sheets/Orders.csv, embedded by tools/build-live-run.mjs. Like the sheet filter, it returns',
        '// the rows whose order_id matches, or one empty item when there is none.',
        `const ORDERS = ${JSON.stringify(orders)};`,
        "const wanted = $('Validate Order ID').first().json.order_id;",
        'const rows = ORDERS.filter((r) => r.order_id === wanted);',
        'return rows.length ? rows.map((json) => ({ json })) : [{ json: {} }];',
        '',
      ].join('\n'),
      pay.position,
      false,
    ),
  );
  ol.connections = {
    'Tool Input': { main: conn([['Validate Order ID']]) },
    'Validate Order ID': { main: conn([['Valid ID?']]) },
    'Valid ID?': { main: conn([['Orders Sandbox Data'], ['Invalid ID Result']]) },
    'Orders Sandbox Data': { main: conn([['Normalize Order']]) },
  };
  finish(ol, ID.order, 'Cedar Course Co. - Order Lookup (LIVE RUN sandbox tool)');
}

// ---------- 2. sandbox Refund Request tool ----------
const rf = clone(wf('refund-request'));
{
  rf.nodes = rf.nodes.filter((n) => n.name !== 'Read Me');
  const look = rf.nodes.find((n) => n.name === 'Look Up Order');
  look.parameters.workflowId = { __rl: true, value: ID.order, mode: 'id', cachedResultName: ol.name };
  const i = rf.nodes.findIndex((n) => n.name === 'Append Refund Row');
  const pos = rf.nodes[i].position;
  rf.nodes[i] = codeNode(
    'Capture Refund Row (not written)',
    [
      '// Capture Refund Row: stands in for "Append Refund Row" (Google Sheets append). Nothing is written anywhere;',
      '// the row that WOULD be appended is kept in the output.',
      "return { json: { ...$input.item.json, capturedRefundRow: $input.item.json.refundRow, wouldAppendTo: 'Refunds sheet' } };",
      '',
    ].join('\n'),
    pos,
  );
  rename(rf, 'Append Refund Row', 'Capture Refund Row (not written)');
  finish(rf, ID.refund, 'Cedar Course Co. - Refund Request (LIVE RUN sandbox tool)');
}

// ---------- 3. main harness ----------
const sa = clone(wf('support-agent'));
const samplesDir = path.join(ROOT, 'samples');
const sampleFiles = readdirSync(samplesDir).filter((f) => /^\d\d-.*\.json$/.test(f)).sort();
const payloads = sampleFiles.map((f) => JSON.parse(rd('samples', f)));
const at = (name) => sa.nodes.find((n) => n.name === name);
const posOf = (name) => at(name).position;
{
  // swap nodes that would send or write for Capture nodes
  const trig = at('WhatsApp Trigger');
  const sticky = at('Read Me');
  const sendPos = posOf('Send WhatsApp Reply');
  const logPos = posOf('Log Conversation');
  const notifyPos = posOf('Notify Team');

  const staffSrc = rd('code', 'staff-message.js');
  let staff = mustReplace(
    staffSrc,
    'const p = $input.first().json;',
    [
      "const ctx = $('Reply Ready').item.json;",
      "const p = { phone: ctx.phone, name: ctx.name, language: ctx.language, reason: ctx.reason, topic: ctx.topic, order_id: ctx.orderId || '', lastMessages: ctx.lastMessages };",
    ].join('\n'),
  );
  staff = mustReplace(
    staff,
    'return [{ json: { text: text.slice(0, 3500), reason: p.reason, label } }];',
    "return { json: { captured: 'team notice (NOT posted to Slack/Telegram)', text: text.slice(0, 3500), reason: p.reason, label } };",
  );

  sa.nodes = sa.nodes.filter((n) => !['WhatsApp Trigger', 'Read Me', 'Send WhatsApp Reply', 'Log Conversation', 'Notify Team'].includes(n.name));
  sa.nodes.push(
    {
      parameters: {
        content:
          '## LIVE RUN harness (test)\nRuns the demo steps on real n8n with a real OpenAI chat model, on made-up messages only.\n\n- Start: **Execute workflow** (Manual Trigger). One run = every sample once.\n- Credential: **OpenAI demo** (an OpenAI credential you create yourself).\n- Nothing is sent: the three **Capture** nodes record what would go to WhatsApp, Google Sheets and Slack/Telegram.\n- The two tools call the sandbox tool workflows (Orders table embedded).\n\nBuilt by `tools/build-live-run.mjs`. See `test/LIVE-RUN.md`.',
        width: 520,
        height: 260,
        color: 5,
      },
      id: uid('live:Read Me'),
      name: 'Read Me',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: sticky.position,
    },
    {
      parameters: {},
      id: uid('live:Manual Trigger'),
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [trig.position[0] - 240, trig.position[1]],
    },
    codeNode(
      'Load Samples',
      [
        '// Load Samples: the made-up WhatsApp webhook payloads from samples/*.json, one item each, in file order.',
        '// Embedded by tools/build-live-run.mjs, so this file needs no file access.',
        `// Files: ${sampleFiles.join(', ')}`,
        `const SAMPLES = [\n${payloads.map((p) => '  ' + JSON.stringify(p)).join(',\n')},\n];`,
        '// Start every run clean: n8n keeps the duplicate-id list, failed-answer counters and chat history of a CLI/active run in',
        '// the workflow\'s static data, so a second run would see all 24 samples as duplicates.',
        "const store = $getWorkflowStaticData('global');",
        'for (const k of Object.keys(store)) delete store[k];',
        'return SAMPLES.map((json) => ({ json }));',
        '',
      ].join('\n'),
      trig.position,
      false,
    ),
    codeNode(
      'Capture WhatsApp Reply (not sent)',
      [
        '// Capture WhatsApp Reply: stands in for "Send WhatsApp Reply" (WhatsApp Cloud API). Nothing is sent.',
        '// It answers with the same shape a successful send returns, so the nodes after it behave as in the live flow.',
        "const ctx = $('Reply Ready').item.json;",
        "return { json: { messaging_product: 'whatsapp', contacts: [{ input: ctx.waId, wa_id: ctx.waId }], messages: [{ id: 'captured-not-sent' }], capturedSend: { to: ctx.waId, body: ctx.reply } } };",
        '',
      ].join('\n'),
      sendPos,
    ),
    codeNode(
      'Capture Sheet Row (not written)',
      [
        '// Capture Sheet Row: stands in for "Log Conversation" (Google Sheets append). Nothing is written.',
        '// `row` has the same columns the live node maps; the other fields are kept so the results file can show them.',
        "const ctx = $('Reply Ready').item.json;",
        'const row = {',
        '  logged_at: $now.toISO(),',
        '  message_id: ctx.messageId,',
        "  customer: '…' + String(ctx.phone).slice(-4),",
        '  language: ctx.language,',
        '  message_type: ctx.type,',
        '  topic: ctx.topic,',
        '  route: ctx.route,',
        '  outcome: ctx.outcome,',
        "  escalation_reason: ctx.reason || '',",
        "  order_id: ctx.orderId || '',",
        "  delivery: $json.error ? 'failed' : ($json.messages ? 'sent' : 'no_reply'),",
        '};',
        'return { json: { row, messageId: ctx.messageId, inbound: ctx.text, reply: ctx.reply, escalate: Boolean(ctx.escalate), capturedSend: $json.capturedSend ?? null } };',
        '',
      ].join('\n'),
      logPos,
    ),
    codeNode('Capture Team Notice (not posted)', staff.trimEnd() + '\n', notifyPos),
  );

  // models, tools, credentials
  at('OpenAI Chat Model').credentials = { openAiApi: { id: 'REPLACE_ME', name: CRED_NAME } };
  at('Look Up Order').parameters.workflowId = { __rl: true, value: ID.order, mode: 'id', cachedResultName: ol.name };
  at('Request Refund').parameters.workflowId = { __rl: true, value: ID.refund, mode: 'id', cachedResultName: rf.name };

  // wiring
  const c = sa.connections;
  delete c['WhatsApp Trigger'];
  delete c['Send WhatsApp Reply'];
  delete c['Log Conversation'];
  c['Manual Trigger'] = { main: conn([['Load Samples']]) };
  c['Load Samples'] = { main: conn([['Normalize Message']]) };
  c['Has Reply?'] = { main: conn([['Capture WhatsApp Reply (not sent)'], ['Capture Sheet Row (not written)']]) };
  c['Capture WhatsApp Reply (not sent)'] = { main: conn([['Capture Sheet Row (not written)']]) };
  c['Capture Sheet Row (not written)'] = { main: conn([['Needs Human?']]) };
  c['Needs Human?'] = { main: conn([['Capture Team Notice (not posted)']]) };
  finish(sa, ID.main, 'Cedar Course Co. - WhatsApp Support Agent (LIVE RUN harness, nothing is sent)');
}

// ---------- 3b. the same harness with an Anthropic chat model (test/live-run-anthropic.json) ----------
// Only the chat model node changes (and the words that name it). Both copies use the same two sandbox tools; run only one of them.
const saA = clone(sa);
{
  const i = saA.nodes.findIndex((n) => n.name === 'OpenAI Chat Model');
  if (i < 0) throw new Error('no OpenAI Chat Model node to swap');
  saA.nodes[i] = {
    parameters: { model: { __rl: true, mode: 'id', value: ANTHROPIC_MODEL, cachedResultName: ANTHROPIC_MODEL }, options: { maxTokensToSample: 500 } },
    id: uid('live:Anthropic Chat Model'),
    name: 'Anthropic Chat Model',
    type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
    typeVersion: 1.6,
    position: saA.nodes[i].position,
    credentials: { anthropicApi: { id: 'REPLACE_ME', name: CRED_NAME_ANTHROPIC } },
  };
  rename(saA, 'OpenAI Chat Model', 'Anthropic Chat Model');
  const note = saA.nodes.find((n) => n.name === 'Read Me');
  note.parameters.content = note.parameters.content
    .replace('a real OpenAI chat model', 'a real Anthropic chat model (' + ANTHROPIC_MODEL + ')')
    .replace('**OpenAI demo** (an OpenAI credential you create yourself)', '**Anthropic demo** (an Anthropic credential you create yourself)');
  finish(saA, ID.mainAnthropic, 'Cedar Course Co. - WhatsApp Support Agent (LIVE RUN harness, Anthropic model, nothing is sent)', NOTE.replace('a real OpenAI chat model', 'a real Anthropic chat model'));
  const credsOf = (flow) => [...new Set(flow.nodes.flatMap((n) => Object.keys(n.credentials || {})))].sort().join(',');
  if (credsOf(sa) !== 'openAiApi') throw new Error('OpenAI harness must use only openAiApi, found: ' + credsOf(sa));
  if (credsOf(saA) !== 'anthropicApi') throw new Error('Anthropic harness must use only anthropicApi, found: ' + credsOf(saA));
  if (/openai/i.test(JSON.stringify(saA))) throw new Error('the Anthropic harness still mentions OpenAI');
}

// ---------- 4. safety checks: nothing in the harness can reach a real service except the chat model ----------
const FORBIDDEN = /whatsApp|whatsAppTrigger|googleSheets|slack|telegram|httpRequest|webhook|emailSend|gmail/i;
const ALLOWED_CRED = new Set(['openAiApi', 'anthropicApi']);
for (const flow of [sa, saA, ol, rf]) {
  const names = new Set(flow.nodes.map((n) => n.name));
  for (const n of flow.nodes) {
    if (FORBIDDEN.test(n.type.split('.').pop())) throw new Error(`${flow.name}: outward node left in: ${n.name} (${n.type})`);
    for (const k of Object.keys(n.credentials || {})) if (!ALLOWED_CRED.has(k)) throw new Error(`${flow.name}: credential ${k} on ${n.name}`);
    if (n.type === 'n8n-nodes-base.executeWorkflow' && ![ID.order, ID.refund].includes(n.parameters.workflowId?.value)) throw new Error(`${n.name}: calls a workflow that is not a sandbox tool`);
  }
  for (const [from, v] of Object.entries(flow.connections)) {
    if (!names.has(from)) throw new Error(`${flow.name}: connection from missing node ${from}`);
    for (const outs of Object.values(v)) for (const o of outs) for (const c of o) if (!names.has(c.node)) throw new Error(`${flow.name}: connection to missing node ${c.node}`);
  }
}
for (const n of [...sa.nodes, ...saA.nodes].filter((x) => /toolWorkflow$/.test(x.type))) {
  if (![ID.order, ID.refund].includes(n.parameters.workflowId.value)) throw new Error(`${n.name} does not point at a sandbox tool`);
}

writeFileSync(path.join(ROOT, 'test', 'live-run.json'), JSON.stringify(sa, null, 2) + '\n');
writeFileSync(path.join(ROOT, 'test', 'live-run-anthropic.json'), JSON.stringify(saA, null, 2) + '\n');
writeFileSync(path.join(ROOT, 'test', 'live-run-tool-order-lookup.json'), JSON.stringify(ol, null, 2) + '\n');
writeFileSync(path.join(ROOT, 'test', 'live-run-tool-refund-request.json'), JSON.stringify(rf, null, 2) + '\n');
console.log(`built test/live-run.json (${sa.nodes.length} nodes, ${payloads.length} samples) + test/live-run-anthropic.json (Anthropic model) + 2 sandbox tool workflows`);

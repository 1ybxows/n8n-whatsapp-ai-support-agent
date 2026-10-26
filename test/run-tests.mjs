#!/usr/bin/env node
// Offline test runner. Plain Node, no npm installs, no network, nothing is sent anywhere.
//
// It reads the workflow JSON files, pulls the JavaScript out of every Code node (and the FAQ Code Tool)
// straight from the JSON (not a copy), and runs it against the made-up WhatsApp payloads in samples/.
// It also checks that every workflow parses, every node type/version is a known n8n 2.x one, and every
// connection points at a real node.
//
// Usage: node test/run-tests.mjs        (writes results.md next to README.md)
//
// NOT covered, on purpose: the AI Agent node itself (needs a model key), live WhatsApp/Slack/Telegram/
// Google Sheets calls, and a real import into n8n. Agent text in these tests is simulated.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFaq } from '../tools/kb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (...p) => readFileSync(path.join(ROOT, ...p), 'utf8');
const NOW_ISO = '2026-10-26T12:00:00Z';
const NOW_MS = Date.parse(NOW_ISO);
// Words that must never appear anywhere in the repo (a personal name). They live in an untracked local
// file, test/.private-words (one word per line, listed in .gitignore), so this file never contains them.
const PRIVATE_WORDS = (() => {
  try { return readFileSync(path.join(ROOT, 'test', '.private-words'), 'utf8').split('\n').map((w) => w.trim()).filter(Boolean); } catch { return null; }
})();
if (!PRIVATE_WORDS) console.log('note: test/.private-words is missing, so the personal-name scan is skipped');
const WF = ['support-agent', 'escalation', 'order-lookup', 'refund-request', 'weekly-report', 'error-handler'];

// ---------- tiny test kit ----------
const results = [];
function check(group, name, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error('returned false');
    results.push({ group, name, ok: true });
  } catch (e) {
    results.push({ group, name, ok: false, detail: String(e.message).split('\n')[0].slice(0, 160) });
  }
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}
const eq = (actual, expected, what = 'value') => {
  if (!deepEqual(actual, expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const hasAr = (s) => /[؀-ۿ]/.test(s);
const hasLat = (s) => /[A-Za-z]/.test(s);

// ---------- load workflows ----------
const workflows = {};
for (const n of WF) {
  check('Workflow files', `${n}.json parses`, () => {
    workflows[n] = JSON.parse(rd('workflows', `${n}.json`));
    ok(Array.isArray(workflows[n].nodes) && workflows[n].connections && workflows[n].name, 'missing name/nodes/connections');
  });
}
const nodeOf = (wf, name) => {
  const n = workflows[wf].nodes.find((x) => x.name === name);
  if (!n) throw new Error(`node not found: ${wf} / ${name}`);
  return n;
};

// ---------- run Code nodes taken from the JSON ----------
function makeInput(arr) {
  return { all: () => arr, first: () => arr[0], last: () => arr[arr.length - 1], item: arr[0] };
}
function runNode(wf, nodeName, { items = [], nodes = {}, store = {} } = {}) {
  const node = nodeOf(wf, nodeName);
  const each = node.parameters.mode === 'runOnceForEachItem';
  const dollar = (name) => {
    if (!nodes[name]) throw new Error(`test gave no data for $('${name}')`);
    return makeInput(nodes[name].map((j) => ({ json: j })));
  };
  const nowObj = { toMillis: () => NOW_MS, toISO: () => new Date(NOW_MS).toISOString() };
  const fn = new Function('$input', '$', '$getWorkflowStaticData', '$now', '$json', node.parameters.jsCode);
  const wrapped = items.map((j) => ({ json: j }));
  return fn(makeInput(wrapped), dollar, () => store, nowObj, wrapped[0]?.json);
}
const runAll = (wf, name, jsons, ctx = {}) => runNode(wf, name, { items: jsons, ...ctx }).map((x) => x.json);
const runEach = (wf, name, json, nodes, store = {}) => runNode(wf, name, { items: [json], nodes: Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, [v]])), store }).json;

// ---------- 1. Workflow files: structure ----------
const typeList = JSON.parse(rd('test', 'node-types.json')).types;
const NTYPES = Object.keys(typeList).length, NSRC = Object.values(typeList).filter((t) => t.source === 'source').length;
const MODEL = /\.lmChat/, MEMORY = /\.memory/, TOOL = /\.tool/;
for (const n of WF) {
  if (!workflows[n]) continue;
  const w = workflows[n];
  const names = w.nodes.map((x) => x.name);
  check('Workflow files', `${n}: unique node names and ids`, () => {
    eq(new Set(names).size, names.length, 'duplicate names');
    eq(new Set(w.nodes.map((x) => x.id)).size, w.nodes.length, 'duplicate ids');
  });
  check('Workflow files', `${n}: every node type + version exists in n8n 2.x`, () => {
    for (const x of w.nodes) {
      const t = typeList[x.type];
      ok(t, `unknown node type ${x.type}`);
      ok(t.versions.includes(x.typeVersion), `${x.type} has no typeVersion ${x.typeVersion}`);
    }
  });
  check('Workflow files', `${n}: every connection points at a real node`, () => {
    for (const [from, kinds] of Object.entries(w.connections)) {
      ok(names.includes(from), `connection from missing node "${from}"`);
      for (const [kind, outs] of Object.entries(kinds)) {
        ok(kind === 'main' || kind.startsWith('ai_'), `odd connection type ${kind}`);
        for (const out of outs) for (const t of out) {
          ok(names.includes(t.node), `"${from}" connects to missing node "${t.node}"`);
          eq(t.type, kind, `connection type on ${from}`);
        }
      }
    }
  });
  check('Workflow files', `${n}: exactly one trigger, nothing left unconnected`, () => {
    const triggers = w.nodes.filter((x) => /Trigger$/.test(x.type));
    eq(triggers.length, 1, 'trigger count');
    const incoming = new Set();
    for (const kinds of Object.values(w.connections)) for (const outs of Object.values(kinds)) for (const out of outs) for (const t of out) incoming.add(t.node);
    for (const x of w.nodes) {
      if (x.type.endsWith('stickyNote') || /Trigger$/.test(x.type)) continue;
      ok(incoming.has(x.name) || w.connections[x.name], `"${x.name}" is not connected to anything`);
    }
  });
  check('Workflow files', `${n}: error outputs wired both ways (onError <-> main[1])`, () => {
    for (const x of w.nodes) {
      const main = w.connections[x.name]?.main || [];
      const wired1 = (main[1] || []).length > 0;
      if (x.onError === 'continueErrorOutput') ok(wired1, `"${x.name}" has onError=continueErrorOutput but main[1] is not wired`);
      else if (wired1 && !/\.(if|switch|filter)$/.test(x.type)) throw new Error(`"${x.name}" wires main[1] without onError=continueErrorOutput`);
    }
  });
  check('Workflow files', `${n}: IF nodes wire both branches (except documented)`, () => {
    for (const x of w.nodes.filter((y) => y.type === 'n8n-nodes-base.if')) {
      const main = w.connections[x.name]?.main || [];
      if (x.name === 'Needs Human?') { ok((main[0] || []).length > 0, 'Needs Human? true branch unwired'); continue; }
      ok((main[0] || []).length > 0 && (main[1] || []).length > 0, `"${x.name}" has an unwired branch`);
    }
  });
  check('Workflow files', `${n}: credentials are placeholders (id REPLACE_ME), workflow inactive`, () => {
    eq(w.active, false, 'active');
    for (const x of w.nodes) for (const c of Object.values(x.credentials || {})) {
      eq(c.id, 'REPLACE_ME', `${x.name} credential id`);
      ok(/\(placeholder\)$/.test(c.name), `${x.name} credential name not marked placeholder`);
    }
    const flat = JSON.stringify(w);
    for (const m of flat.matchAll(/"(?:workflowId|documentId|channelId)":\s*\{[^}]*"value":\s*"([^"]*)"/g)) ok(m[1].startsWith('REPLACE_ME'), `real-looking id: ${m[1]}`);
  });
}
check('Workflow files', 'support-agent: the AI sub-nodes are wired on ai_* connections', () => {
  const w = workflows['support-agent'], c = w.connections;
  const into = (kind) => Object.entries(c).filter(([, k]) => (k[kind] || []).some((o) => o.some((t) => t.node === 'Customer Support Agent'))).map(([f]) => f);
  const models = into('ai_languageModel'), mem = into('ai_memory'), tools = into('ai_tool');
  eq(models.length, 1, 'models'); eq(mem.length, 1, 'memory'); eq(tools.sort(), ['Look Up Order', 'Request Refund', 'Search FAQ'], 'tools');
  ok(MODEL.test(nodeOf('support-agent', models[0]).type) && MEMORY.test(nodeOf('support-agent', mem[0]).type), 'sub-node types');
  for (const t of tools) ok(TOOL.test(nodeOf('support-agent', t).type), `${t} is not a tool node`);
});
check('Workflow files', 'support-agent: sub-workflow calls point at the 3 helper workflows (placeholders)', () => {
  const ids = JSON.stringify(workflows['support-agent']) + JSON.stringify(workflows['refund-request']);
  for (const p of ['REPLACE_ME_ORDER_LOOKUP_WORKFLOW_ID', 'REPLACE_ME_REFUND_REQUEST_WORKFLOW_ID', 'REPLACE_ME_ESCALATION_WORKFLOW_ID']) ok(ids.includes(p), `missing ${p}`);
});
check('Workflow files', 'support-agent: a failing send or log never blocks the human hand-off (Notify Team)', () => {
  const w = workflows['support-agent'];
  const out = {}, back = {};
  for (const [from, kinds] of Object.entries(w.connections)) for (const t of (kinds.main || []).flat()) { (out[from] ||= []).push(t.node); (back[t.node] ||= []).push(from); }
  const walk = (start, adj) => { const seen = new Set(); const todo = [start]; while (todo.length) { const n = todo.pop(); for (const m of adj[n] || []) if (!seen.has(m)) { seen.add(m); todo.push(m); } } return seen; };
  const after = walk('Reply Ready', out), before = walk('Notify Team', back);
  const between = [...after].filter((n) => before.has(n));
  ok(between.includes('Send WhatsApp Reply') && between.includes('Log Conversation'), 'path not found: ' + between.join(', '));
  for (const n of between) {
    const node = nodeOf('support-agent', n);
    if (/\.(whatsApp|googleSheets|slack|telegram|httpRequest|executeWorkflow|emailSend)$/.test(node.type)) ok(['continueRegularOutput', 'continueErrorOutput'].includes(node.onError), `"${n}" can stop the run before Notify Team (onError=${node.onError || 'default'})`);
  }
});
check('Workflow files', 'weekly-report: Merge has both inputs wired', () => {
  const c = workflows['weekly-report'].connections;
  const idx = new Set([...(c['Read Conversations']?.main?.[0] || []), ...(c['Read Refunds']?.main?.[0] || [])].filter((t) => t.node === 'Combine Rows').map((t) => t.index));
  eq([...idx].sort(), [0, 1], 'merge inputs');
});

// ---------- 2. Code nodes: syntax + built from code/ ----------
const CODE_FILES = {
  'support-agent': { 'Normalize Message': 'normalize-message.js', 'Detect Language': 'detect-language.js', 'Route Message': 'route-message.js', 'Process Agent Reply': 'process-agent-reply.js', 'Agent Failed': 'agent-failed.js' },
  escalation: { 'Build Staff Message': 'staff-message.js' },
  'order-lookup': { 'Validate Order ID': 'validate-order-id.js', 'Normalize Order': 'normalize-order.js' },
  'refund-request': { 'Refund Policy Check': 'refund-policy.js' },
  'weekly-report': { 'Build Weekly Report': 'report-counts.js' },
};
let codeNodeCount = 0;
for (const n of WF) {
  if (!workflows[n]) continue;
  for (const x of workflows[n].nodes.filter((y) => y.type === 'n8n-nodes-base.code' || y.type.endsWith('toolCode'))) {
    codeNodeCount++;
    check('Code nodes', `${n} / ${x.name}: JavaScript compiles`, () => {
      const src = x.parameters.jsCode;
      ok(typeof src === 'string' && src.trim().length > 40, 'no jsCode');
      if (x.type.endsWith('toolCode')) new Function('query', src); else new Function('$input', '$', '$getWorkflowStaticData', '$now', '$json', src);
    });
  }
}
for (const [n, map] of Object.entries(CODE_FILES)) {
  for (const [nodeName, file] of Object.entries(map)) {
    check('Code nodes', `${nodeName}: JSON matches code/${file} (rebuild if not)`, () => eq(nodeOf(n, nodeName).parameters.jsCode, rd('code', file), 'jsCode'));
  }
}

// ---------- 3. Samples through normalize -> language -> route ----------
const expected = JSON.parse(rd('samples', 'expected.json'));
const sampleFiles = readdirSync(path.join(ROOT, 'samples')).filter((f) => /^\d\d-.*\.json$/.test(f)).sort();
check('Samples', 'at least 16 payloads, half English half Arabic, every file has an expectation', () => {
  ok(sampleFiles.length >= 16, `only ${sampleFiles.length}`);
  const en = sampleFiles.filter((f) => f.includes('-en-')).length, ar = sampleFiles.filter((f) => f.includes('-ar-')).length;
  ok(en >= 8 && ar >= 8 && en + ar === sampleFiles.length, `en ${en} / ar ${ar}`);
  for (const f of sampleFiles) ok(expected[f], `no expectation for ${f}`);
});
check('Samples', 'payload shape is the Cloud API webhook (object / entry / changes / value / metadata)', () => {
  for (const f of sampleFiles) {
    const p = JSON.parse(rd('samples', f));
    eq(p.object, 'whatsapp_business_account', f);
    const v = p.entry?.[0]?.changes?.[0]?.value;
    ok(v?.metadata?.phone_number_id && (v.messages || v.statuses), `${f}: bad value`);
  }
});
check('Samples', 'covers: FAQ, order, refund, angry, gibberish, empty, voice note, duplicate id', () => {
  const need = ['faq', 'order', 'refund', 'angry', 'gibberish', 'empty', 'voice', 'duplicate'];
  for (const k of need) ok(sampleFiles.some((f) => f.includes(k)), `missing ${k}`);
  const ids = sampleFiles.flatMap((f) => (JSON.parse(rd('samples', f)).entry[0].changes[0].value.messages || []).map((m) => m.id));
  ok(new Set(ids).size < ids.length, 'no duplicate message id in samples');
});
const store = {};
const sampleOut = {};
for (const f of sampleFiles) {
  try {
    const payload = JSON.parse(rd('samples', f));
    const a = runAll('support-agent', 'Normalize Message', [payload]);
    const b = a.length ? runAll('support-agent', 'Detect Language', a) : [];
    sampleOut[f] = b.length ? runAll('support-agent', 'Route Message', b, { store }) : [];
  } catch (e) { sampleOut[f] = { error: e.message }; }
}
for (const f of sampleFiles) {
  check('Samples', `${f.replace('.json', '')}`, () => {
    const exp = expected[f], out = sampleOut[f];
    ok(!out.error, out.error);
    if (exp.produces === false) { eq(out.length, 0, 'items produced'); return; }
    eq(out.length, 1, 'items produced');
    const r = out[0];
    for (const k of ['route', 'reason', 'language', 'topic', 'orderId']) if (k in exp) eq(r[k] ?? null, exp[k], k);
    if (r.route === 'agent') {
      ok(r.text && r.sessionKey === r.phone && /^\+1555010\d{4}$/.test(r.phone) && r.waId === r.phone.slice(1), 'agent route fields');
      eq(r.reply, '', 'agent route has no canned reply');
    } else if (r.route === 'ignore') {
      eq(r.reply, '', 'ignored message gets no reply'); eq(r.escalate, false, 'ignore never escalates');
    } else {
      ok(r.reply.length > 20, 'canned reply missing');
      if (r.language === 'ar') ok(hasAr(r.reply) && !hasLat(r.reply), 'Arabic customer should get an Arabic-only reply');
      if (r.language === 'en') ok(!hasAr(r.reply), 'English customer should get an English-only reply');
      if (r.language === 'und') ok(hasAr(r.reply) && hasLat(r.reply), 'unknown language should get both languages');
      eq(r.escalate, r.route === 'escalate', 'escalate flag');
      if (r.escalate) ok(r.lastMessages.length >= 1 && r.lastMessages.at(-1).from === 'customer', 'handoff needs the last messages');
    }
  });
}
check('Samples', 'a duplicate message id is dropped only the second time', () => {
  eq(sampleOut['01-en-faq-access.json'][0].route, 'agent', 'first');
  eq(sampleOut['09-en-duplicate.json'][0].reason, 'duplicate', 'second');
  eq(sampleOut['13-ar-faq-access.json'][0].route, 'agent', 'first (ar)');
  eq(sampleOut['21-ar-duplicate.json'][0].reason, 'duplicate', 'second (ar)');
});
check('Samples', 'static data keeps a short history per customer (max 6)', () => {
  ok(Object.values(store.history).every((h) => h.length <= 6), 'history too long');
  ok(store.seenIds.length >= 20, 'seen ids not stored');
});
check('Samples', 'extra rules: shouting needs company, a calm "worst case" question is not anger', () => {
  const run = (text) => { const s = {}; const j = { messageId: 'x' + Math.random(), waId: '15550100199', phone: '+15550100199', type: 'text', supported: true, text, name: 'T', language: 'en' }; return runAll('support-agent', 'Route Message', [j], { store: s })[0]; };
  eq(run('What is the worst case if I miss the 14 days?').route, 'agent', 'calm worst-case question');
  eq(run('WHY IS THIS NOT WORKING!!! TERRIBLE').route, 'escalate', 'shouting + terrible');
  eq(run('Is there a manager I can write to?').reason, 'human_requested', 'manager');
  eq(run('Honestly this looks like a scam').reason, 'unhappy', 'score 2 (one strong word) escalates');
  eq(run('Honestly awful!!!').reason, 'unhappy', 'score 2 (mild word + three !) escalates');
  eq(run('This is terrible').route, 'agent', 'score 1 (one mild word) does not escalate');
});

// ---------- 4. Agent reply handling (agent text is SIMULATED) ----------
const ctxEn = { ...sampleOut['01-en-faq-access.json'][0] }, ctxAr = { ...sampleOut['13-ar-faq-access.json'][0] };
const agentRun = (ctx, output, st) => runEach('support-agent', 'Process Agent Reply', { output }, { 'Route Message': ctx }, st);
check('Agent reply', 'normal answer: kept as written, counts as resolved', () => {
  const r = agentRun(ctxEn, 'You get a sign-in link by email within 10 minutes.', {});
  eq([r.reply, r.outcome, r.escalate], ['You get a sign-in link by email within 10 minutes.', 'resolved', false]);
});
check('Agent reply', '[[UNSURE]] once: asks to rephrase, no escalation', () => {
  const r = agentRun(ctxEn, 'Not sure about that. [[UNSURE]]', {});
  eq([r.outcome, r.escalate], ['unsure', false]); ok(/rephrase/.test(r.reply) && !r.reply.includes('[['), 'reply');
});
check('Agent reply', '[[UNSURE]] twice in a row: escalates (two_failed_answers)', () => {
  const st = {}; agentRun(ctxEn, '[[UNSURE]]', st);
  const r = agentRun(ctxEn, '[[UNSURE]]', st);
  eq([r.escalate, r.reason, r.outcome], [true, 'two_failed_answers', 'escalated']); ok(/team member/.test(r.reply), 'notice');
});
check('Agent reply', 'a good answer in between resets the counter', () => {
  const st = {}; agentRun(ctxEn, '[[UNSURE]]', st); agentRun(ctxEn, 'Here you go.', st);
  eq(agentRun(ctxEn, '[[UNSURE]]', st).escalate, false);
});
check('Agent reply', '[[HANDOFF:refund_over_limit]]: escalates with that reason; marker never reaches the customer', () => {
  const r = agentRun(ctxEn, 'A person will review it. [[HANDOFF:refund_over_limit]]', {});
  eq([r.escalate, r.reason], [true, 'refund_over_limit']); ok(!r.reply.includes('[[') && !r.reply.includes('HANDOFF'), 'marker leaked');
});
check('Agent reply', 'bare [[HANDOFF]] gets reason agent_handoff', () => eq(agentRun(ctxEn, 'x [[HANDOFF]]', {}).reason, 'agent_handoff'));
check('Agent reply', 'empty agent output counts as a failed answer', () => eq(agentRun(ctxEn, '   ', {}).outcome, 'unsure'));
check('Agent reply', 'Arabic customer gets Arabic notices (escalation and rephrase)', () => {
  const a = agentRun(ctxAr, '[[HANDOFF:team_task]]', {}), b = agentRun(ctxAr, '[[UNSURE]]', {});
  ok(hasAr(a.reply) && !hasLat(a.reply) && hasAr(b.reply) && !hasLat(b.reply), 'language');
});
check('Agent reply', 'long answers are cut to 900 characters; history stays at 6', () => {
  const st = {}; let r;
  for (let i = 0; i < 9; i++) r = agentRun(ctxEn, 'x'.repeat(2000), st);
  eq(r.reply.length, 900, 'length'); eq(r.lastMessages.length, 6, 'history');
});
check('Agent reply', 'Agent Failed: customer still gets a notice, reason agent_error, error text kept short', () => {
  const r = runEach('support-agent', 'Agent Failed', { error: { message: 'Insufficient quota '.repeat(30) } }, { 'Route Message': ctxEn });
  eq([r.escalate, r.reason, r.outcome], [true, 'agent_error', 'escalated']); ok(r.reply.length > 20 && r.agentError.length <= 200, 'fields');
});
check('Agent reply', 'Agent Answered?: the agent feeds the check; no answer goes to Agent Failed, a real answer to Process Agent Reply', () => {
  const c = workflows['support-agent'].connections;
  const to = (from, out) => (c[from]?.main?.[out] || []).map((t) => t.node);
  eq(to('Customer Support Agent', 0), ['Agent Answered?'], 'agent normal output');
  eq(to('Customer Support Agent', 1), ['Agent Failed'], 'agent error output');
  eq(to('Agent Answered?', 0), ['Process Agent Reply'], 'answered');
  eq(to('Agent Answered?', 1), ['Agent Failed'], 'not answered');
  eq(to('Agent Failed', 0), ['Reply Ready'], 'fallback joins the normal path');
});
const answered = (json) => {
  const cond = nodeOf('support-agent', 'Agent Answered?').parameters.conditions.conditions[0].leftValue;
  ok(cond.startsWith('={{') && cond.endsWith('}}'), 'expression');
  return new Function('$json', `return (${cond.slice(3, -2).trim()});`)(json);
};
check('Agent reply', 'Agent Answered?: text passes; empty, blank, missing output and an error-only item do not', () => {
  eq(answered({ output: 'You get a link by email.' }), true, 'text');
  eq(answered({ output: '' }), false, 'empty');
  eq(answered({ output: '  \n ' }), false, 'blank');
  eq(answered({ ...ctxEn }), false, 'input passed through with no output (the agent node stopped before it ran)');
  eq(answered({ error: 'Insufficient quota' }), false, 'error only');
  eq(answered({ output: '[[UNSURE]]' }), true, 'a bare mark is an answer; Process Agent Reply handles it');
});
check('Agent reply', 'failed or empty agent run: honest notice, team escalation, never "please rephrase"', () => {
  for (const [label, item] of [['error text', { error: 'Insufficient quota' }], ['error object', { error: { message: 'Rate limit' } }], ['no output', { ...ctxEn }]]) {
    ok(!answered(item), `${label} should not count as answered`);
    const r = runEach('support-agent', 'Agent Failed', item, { 'Route Message': ctxEn });
    eq([r.escalate, r.reason, r.outcome], [true, 'agent_error', 'escalated'], label);
    ok(/team member/.test(r.reply) && !/rephrase/i.test(r.reply), `${label}: reply`);
    ok(r.agentError.length > 0 && r.agentError.length <= 200, `${label}: agentError`);
  }
  eq(runEach('support-agent', 'Agent Failed', { error: 'Insufficient quota' }, { 'Route Message': ctxEn }).agentError, 'Insufficient quota', 'text error kept');
  const ar = runEach('support-agent', 'Agent Failed', { error: 'x' }, { 'Route Message': ctxAr });
  ok(hasAr(ar.reply) && !hasLat(ar.reply), 'Arabic customer gets the Arabic notice');
});
check('Agent reply', 'agent prompt: has the marks, today\'s date expression, a raised maxIterations', () => {
  const a = nodeOf('support-agent', 'Customer Support Agent').parameters;
  const sm = a.options.systemMessage;
  ok(sm.startsWith('=') && sm.includes('[[UNSURE]]') && sm.includes('[[HANDOFF:') && sm.includes('$now'), 'prompt');
  ok(a.options.maxIterations >= 10, 'maxIterations');
});
check('Agent reply', 'tools: named and described; identity and limits are plumbed, only order_id and reason come from the AI', () => {
  for (const t of ['Search FAQ', 'Look Up Order', 'Request Refund']) {
    const p = nodeOf('support-agent', t).parameters;
    ok(/^[a-z]+(_[a-z]+)+$/.test(p.name) && p.description.length >= 150, `${t}: name/description`);
  }
  const vals = nodeOf('support-agent', 'Request Refund').parameters.workflowInputs.value;
  for (const k of ['customer_phone', 'customer_name', 'message_id', 'language']) ok(!vals[k].includes('$fromAI'), `${k} must not come from the AI`);
  for (const k of ['order_id', 'reason']) ok(vals[k].includes('$fromAI'), `${k} should come from the AI`);
  const mem = nodeOf('support-agent', 'Chat Memory').parameters.sessionKey;
  ok(mem.includes('sessionKey') && !mem.includes('$fromAI') && !/default/i.test(mem), 'memory key');
});

// ---------- 5. FAQ tool ----------
const faq = parseFaq(rd('kb', 'faq.md'));
const faqCode = nodeOf('support-agent', 'Search FAQ').parameters.jsCode;
const faqSearch = new Function('query', faqCode);
check('FAQ tool', 'kb/faq.md has 10+ entries with both languages complete', () => {
  ok(faq.length >= 10, `${faq.length} entries`);
  for (const e of faq) for (const k of ['q_en', 'a_en', 'q_ar', 'a_ar', 'keywords_en', 'keywords_ar']) ok(e[k] && e[k].length, `${e.id}: ${k} empty`);
  eq(new Set(faq.map((e) => e.id)).size, faq.length, 'ids unique');
  for (const e of faq) { ok(hasAr(e.q_ar) && hasAr(e.a_ar), `${e.id}: Arabic text missing`); ok(!hasAr(e.q_en + e.a_en), `${e.id}: Arabic inside English text`); }
});
check('FAQ tool', 'the FAQ inside the workflow equals kb/faq.md (no drift)', () => eq(JSON.parse(faqCode.match(/const KB = (\[.*\]);/)[1]), faq, 'KB'));
check('FAQ tool', 'every FAQ question (EN and AR) finds its own entry first', () => {
  const bad = [];
  for (const e of faq) for (const q of [e.q_en, e.q_ar]) { const first = faqSearch(q).match(/\[([a-z-]+)\]/)?.[1]; if (first !== e.id) bad.push(`${e.id}<-${first}`); }
  ok(!bad.length, 'wrong: ' + bad.join(', '));
});
const PARA = [
  ['i didnt get any email after buying', 'access'], ['do you give certificates', 'certificate'], ['is it lifetime access or monthly', 'lifetime'],
  ['can I pay with paypal', 'payment-methods'], ['how many hours of video is it', 'level'], ['I need a company invoice', 'invoice'],
  ['what are your support hours', 'support-hours'], ['are there arabic subtitles', 'language'], ['which devices work', 'devices'],
  ['هل يوجد خصم على السعر', 'price'], ['لم يصلني الرابط على الايميل', 'access'], ['هل الدورة بالعربي', 'language'],
  ['كيف ادفع بالفيزا', 'payment-methods'], ['اريد استرداد المبلغ', 'refund-policy'],
];
check('FAQ tool', `${PARA.length} reworded questions land on the right entry`, () => {
  const bad = PARA.filter(([q, id]) => faqSearch(q).match(/\[([a-z-]+)\]/)?.[1] !== id).map(([q, id]) => `"${q}" (want ${id}, got ${faqSearch(q).match(/\[([a-z-]+)\]/)?.[1]})`);
  ok(!bad.length, bad.join('; '));
});
check('FAQ tool', 'off-topic or empty queries return NO_MATCH (the agent then says it is not sure)', () => {
  for (const q of ['what is the weather in paris', 'qwerty asdf', '', 'ما هو الطقس اليوم']) ok(faqSearch(q).startsWith('NO_MATCH') && faqSearch(q).includes('[[UNSURE]]'), `"${q}"`);
});
check('FAQ tool', 'an Arabic question gets the Arabic answer text', () => ok(hasAr(faqSearch('هل أحصل على شهادة؟')) && faqSearch('هل أحصل على شهادة؟').includes('[certificate]')));

// ---------- 6. Orders, refunds, sheet columns ----------
const csv = (file) => { const [h, ...rows] = rd('sheets', file).trim().split('\n').map((l) => l.split(',')); return { header: h, rows: rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))) }; };
const orders = csv('Orders.csv').rows;
const lookup = (orderId, phone, rows) => runAll('order-lookup', 'Normalize Order', rows, { nodes: { 'Validate Order ID': [{ order_id: orderId, customer_phone: phone, valid: true }] } })[0];
check('Orders & refunds', 'Validate Order ID: accepts CC-1234 style only', () => {
  const v = (s) => runAll('order-lookup', 'Validate Order ID', [{ order_id: s, customer_phone: '+1' }])[0];
  eq(v(' cc-1042 ').order_id, 'CC-1042'); eq(v('cc-1042').valid, true);
  for (const bad of ['CC-12', 'CC-1234567', '../etc/passwd', '', 'CC-1042; DROP TABLE', 'XX-1042', undefined]) eq(v(bad).valid, false, `"${bad}"`);
});
check('Orders & refunds', 'Normalize Order: sheet row, same owner -> full details', () => {
  const r = lookup('CC-1042', '+15550100101', [orders[0]]);
  eq([r.found, r.owner_match, r.source, r.amount, r.status], [true, true, 'orders_sheet', 89, 'paid']); ok(r.message.includes('89 USD') && r.message.includes('2026-10-20'), 'message');
});
check('Orders & refunds', 'Normalize Order: payment-API shape gives the same answer', () => {
  const api = { id: 'CC-1042', status: 'PAID', product: { name: 'Cedar Course' }, amount: 89, currency: 'USD', created_at: '2026-10-20T09:12:00Z', customer: { phone: '+15550100101', name: 'Sam Carter' } };
  const r = lookup('CC-1042', '+15550100101', [api]);
  eq([r.source, r.status, r.product, r.owner_match], ['payment_api', 'paid', 'Cedar Course', true]);
});
check('Orders & refunds', 'Normalize Order: other number -> no details leak', () => {
  const r = lookup('CC-1042', '+15550100199', [orders[0]]);
  eq([r.found, r.owner_match], [true, false]); ok(!('amount' in r) && !('product' in r) && !r.message.includes('89'), 'leak');
});
check('Orders & refunds', 'Normalize Order: no rows / empty item / other order id -> not found', () => {
  for (const rows of [[], [{}], [orders[1]]]) eq(lookup('CC-1042', '+15550100101', rows).found, false);
});
check('Orders & refunds', 'Normalize Order: phone formats compare by digits', () => eq(lookup('CC-1042', '1 (555) 010-0101', [orders[0]]).owner_match, true));
const policy = (order, req = {}) => runAll('refund-request', 'Refund Policy Check', [order], { nodes: { 'Tool Input': [{ order_id: 'CC-1042', reason: 'not what I expected', customer_phone: '+15550100101', customer_name: 'Sam Carter', message_id: 'wamid.DEMO-0004', language: 'en', ...req }] } })[0];
const owned = (o) => lookup(o.order_id, o.customer_phone, [o]);
const DECISIONS = { 'CC-1042': 'ok', 'CC-1077': 'ok', 'CC-2003': 'needs_human', 'CC-1015': 'window_closed', 'CC-1099': 'already_refunded', 'CC-1120': 'not_paid' };
check('Orders & refunds', 'Refund Policy: each sheet order gets the expected decision', () => {
  const got = Object.fromEntries(orders.map((o) => [o.order_id, policy(owned(o), { order_id: o.order_id, customer_phone: o.customer_phone }).decision]));
  eq(got, DECISIONS, 'decisions');
});
check('Orders & refunds', 'Refund Policy: ok row has every Refunds column, status "pending approval", nothing else decides', () => {
  const r = policy(owned(orders[0]));
  eq(Object.keys(r.refundRow), csv('Refunds.csv').header, 'columns');
  eq([r.refundRow.status, r.refundRow.amount, r.refundRow.order_id, r.refundRow.requested_at], ['pending approval', 89, 'CC-1042', '2026-10-26T12:00:00.000Z']);
  ok(r.message.includes('pending approval'), 'message');
});
check('Orders & refunds', 'Refund Policy: declined cases log nothing', () => {
  for (const id of ['CC-2003', 'CC-1015', 'CC-1099', 'CC-1120']) { const o = orders.find((x) => x.order_id === id); eq(policy(owned(o), { order_id: id, customer_phone: o.customer_phone }).refundRow, null, id); }
  eq(policy({ found: false, owner_match: false, order_id: 'CC-9999' }).decision, 'not_found');
  eq(policy({ found: true, owner_match: false, order_id: 'CC-1042' }).decision, 'not_owner');
});
check('Orders & refunds', 'Refund Policy: the 14-day and 150 USD edges (14.0 days ok, 14.01 closed, 150 ok, 150.01 over)', () => {
  const base = { found: true, owner_match: true, order_id: 'CC-1500', status: 'paid', product: 'X', currency: 'USD' };
  const ago = (days) => new Date(NOW_MS - days * 86400000).toISOString();
  eq(policy({ ...base, amount: 89, purchased_at: ago(14) }).decision, 'ok');
  eq(policy({ ...base, amount: 89, purchased_at: ago(14.01) }).decision, 'window_closed');
  eq(policy({ ...base, amount: 150, purchased_at: ago(1) }).decision, 'ok');
  eq(policy({ ...base, amount: 150.01, purchased_at: ago(1) }).decision, 'needs_human');
});
check('Orders & refunds', 'Refund Policy: reason is trimmed, capped at 300, defaults to "not given"', () => {
  const o = owned(orders[0]);
  eq(policy(o, { reason: '' }).refundRow.reason, 'not given'); eq(policy(o, { reason: '  too   slow ' }).refundRow.reason, 'too slow');
  eq(policy(o, { reason: 'x'.repeat(900) }).refundRow.reason.length, 300);
});
check('Orders & refunds', 'declined messages tell the agent which mark to use', () => {
  ok(policy(owned(orders[2]), { order_id: 'CC-2003', customer_phone: '+15550100103' }).message.includes('[[HANDOFF:refund_over_limit]]'), 'over limit');
  ok(policy({ found: true, owner_match: false, order_id: 'CC-1042' }).message.includes('[[HANDOFF:team_task]]'), 'not owner');
});
check('Orders & refunds', 'sample senders own the orders they mention (CC-1042 Sam, CC-1077 Layla, CC-2003 Omar)', () => {
  const owner = (id) => orders.find((o) => o.order_id === id).customer_phone;
  const from = (f) => '+' + JSON.parse(rd('samples', f)).entry[0].changes[0].value.messages[0].from;
  eq(from('04-en-refund-ask.json'), owner('CC-1042')); eq(from('15-ar-order-status.json'), owner('CC-1077')); eq(from('16-ar-refund-ask.json'), owner('CC-2003'));
});
check('Orders & refunds', 'sheet column names match the nodes that write them (Refunds, Conversations)', () => {
  eq(Object.keys(nodeOf('refund-request', 'Append Refund Row').parameters.columns.value), csv('Refunds.csv').header, 'Refunds');
  eq(Object.keys(nodeOf('support-agent', 'Log Conversation').parameters.columns.value), csv('Conversations.csv').header, 'Conversations');
  eq(csv('Orders.csv').header.every((c) => ['order_id', 'customer_phone', 'customer_name', 'product', 'amount', 'currency', 'purchased_at', 'status'].includes(c)), true, 'Orders header');
});

// ---------- 7. Escalation + weekly report ----------
check('Escalation & report', 'Staff message: reason, customer, language, topic, order, last messages', () => {
  const p = { phone: '+15550100106', name: 'Priya Menon', language: 'en', reason: 'unhappy', topic: 'refund', order_id: 'CC-1120', lastMessages: [{ from: 'customer', text: 'This is the WORST' }, { from: 'bot', text: 'Sorry about that' }] };
  const t = runAll('escalation', 'Build Staff Message', [p])[0].text;
  for (const s of ['Unhappy customer', 'Priya Menon (+15550100106)', 'English', 'refund', 'CC-1120', 'Customer: This is the WORST', 'Bot: Sorry about that']) ok(t.includes(s), `missing "${s}"`);
});
check('Escalation & report', 'Staff message: keeps Arabic text, copes with missing messages and unknown reasons, stays short', () => {
  const a = runAll('escalation', 'Build Staff Message', [{ phone: '+15550100113', name: 'Zain Tariq', language: 'ar', reason: 'human_requested', lastMessages: [{ from: 'customer', text: 'أريد التحدث مع موظف' }] }])[0].text;
  ok(a.includes('أريد التحدث مع موظف') && a.includes('Arabic') && a.includes('asked for a person'), 'arabic');
  const b = runAll('escalation', 'Build Staff Message', [{ phone: '+1', reason: 'something_new' }])[0].text;
  ok(b.includes('something_new') && b.includes('(none recorded)'), 'fallbacks');
  ok(runAll('escalation', 'Build Staff Message', [{ phone: '+1', reason: 'unhappy', lastMessages: Array(6).fill({ from: 'customer', text: 'y'.repeat(900) }) }])[0].text.length <= 3500, 'length');
});
check('Escalation & report', 'every escalation reason the workflows can produce has a readable label', () => {
  const labels = rd('code', 'staff-message.js');
  for (const r of ['unhappy', 'human_requested', 'two_failed_answers', 'refund_over_limit', 'team_task', 'payment_dispute', 'agent_handoff', 'agent_error']) ok(labels.includes(r + ':'), r);
});
const D = (days) => new Date(NOW_MS - days * 86400000).toISOString();
const conv = (days, o) => ({ logged_at: D(days), message_id: 'm', customer: '…0101', language: 'en', message_type: 'text', topic: 'other', route: 'agent', outcome: 'resolved', escalation_reason: '', order_id: '', delivery: 'sent', ...o });
const rows = [
  conv(1, { topic: 'access' }), conv(2, { topic: 'access', language: 'ar' }), conv(2, { topic: 'order_status' }),
  conv(3, { topic: 'refund', outcome: 'escalated', escalation_reason: 'unhappy', route: 'escalate' }),
  conv(3, { language: 'ar', outcome: 'escalated', escalation_reason: 'human_requested', route: 'escalate' }),
  conv(4, { language: 'und', outcome: 'reply_only', route: 'reply_only' }), conv(4, { outcome: 'ignored', route: 'ignore' }),
  conv(5, { topic: 'pricing', outcome: 'unsure' }), conv(16, { topic: 'access' }), conv(6, { language: 'ar', topic: 'refund' }),
  { requested_at: D(2), order_id: 'CC-1042', amount: '89', status: 'pending approval' }, { requested_at: D(5), order_id: 'CC-1077', amount: '129', status: 'pending approval' }, { requested_at: D(20), order_id: 'CC-1015', amount: '89', status: 'pending approval' },
];
check('Escalation & report', 'Weekly report: counts for the last 7 days only (fixed fake rows, hand-counted)', () => {
  const s = runAll('weekly-report', 'Build Weekly Report', rows)[0].stats;
  eq([s.messages, s.ignored, s.resolved, s.escalated, s.other, s.resolutionRate], [8, 1, 4, 2, 2, 50], 'message counts');
  eq([s.refunds, s.refundsPending, s.refundAmount], [2, 2, 218], 'refunds');
  eq(s.topTopics, [['access', 2], ['other', 2], ['refund', 2], ['order_status', 1], ['pricing', 1]], 'topics');
  eq(s.languages, { en: 4, ar: 3, und: 1 }, 'languages'); eq(s.escalationReasons, { unhappy: 1, human_requested: 1 }, 'reasons');
});
check('Escalation & report', 'Weekly report: text lists every number; empty sheets give zeros, not a crash', () => {
  const r = runAll('weekly-report', 'Build Weekly Report', rows)[0];
  for (const s of ['Messages handled: 8', 'Resolved by the bot: 4 (50%)', 'Passed to a person: 2', 'Refund requests logged: 2 (2 pending approval, 218 USD)', 'Top topics: access 2']) ok(r.text.includes(s), `missing "${s}"`);
  ok(r.subject.includes('2026-10-19') && r.subject.includes('2026-10-26'), 'subject dates');
  const e = runAll('weekly-report', 'Build Weekly Report', [{}])[0];
  eq([e.stats.messages, e.stats.resolutionRate, e.stats.refundAmount], [0, 0, 0]);
});

// ---------- 8. Safety + docs ----------
const textFiles = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'node_modules' && f !== '.git') walk(p); }
    else if (/\.(json|md|js|mjs|csv)$/.test(f) && f !== 'results.md') textFiles.push(p);
  }
})(ROOT);
check('Safety & docs', `no keys, tokens or real-looking emails/numbers in ${textFiles.length} files`, () => {
  for (const p of textFiles) {
    const s = readFileSync(p, 'utf8'), rel = path.relative(ROOT, p);
    for (const [name, re] of [['OpenAI-style key', /sk-[A-Za-z0-9]{20,}/], ['Slack token', /xox[abprs]-[A-Za-z0-9-]{10,}/], ['Telegram token', /\b\d{8,10}:[A-Za-z0-9_-]{30,}/], ['Meta token', /EAA[A-Za-z0-9]{30,}/], ['AWS key', /AKIA[0-9A-Z]{16}/], ['bearer', /Bearer\s+[A-Za-z0-9._-]{20,}/]]) ok(!re.test(s), `${rel}: ${name}`);
    for (const m of s.matchAll(/[\w.+-]+@([\w-]+\.)+[\w-]+/g)) ok(/@example\.com$/.test(m[0]), `${rel}: email ${m[0]}`);
    for (const m of s.matchAll(/\+\d[\d ]{7,}\d/g)) ok(/^\+1555010\d{4}$/.test(m[0]), `${rel}: phone ${m[0]}`);
  }
  for (const f of sampleFiles) {
    const v = JSON.parse(rd('samples', f)).entry[0].changes[0].value;
    for (const n of [v.metadata.display_phone_number, ...(v.contacts || []).map((c) => c.wa_id), ...(v.messages || []).map((m) => m.from), ...(v.statuses || []).map((x) => x.recipient_id)]) ok(/^1555010\d{4}$/.test(n), `${f}: number ${n}`);
  }
});
check('Safety & docs', `no real business or personal name anywhere (shop types, brands, private word list)${PRIVATE_WORDS ? '' : ' [personal-name scan SKIPPED: test/.private-words missing]'}`, () => {
  const bad = /butcher|bakery|bakeries|dairy|restaurant|supermarket/i; // generic shop types only; real names live in test/.private-words
  for (const p of textFiles) { const m = readFileSync(p, 'utf8').match(bad); ok(!m || p.endsWith('run-tests.mjs'), `${path.relative(ROOT, p)}: "${m && m[0]}"`); }
  if (PRIVATE_WORDS) for (const p of textFiles) { const s = readFileSync(p, 'utf8').toLowerCase(); for (const w of PRIVATE_WORDS) ok(!s.includes(w.toLowerCase()), `${path.relative(ROOT, p)}: private word found`); }
});
check('Safety & docs', 'README: honest status line, Mermaid diagram, all workflows and sheets named', () => {
  const r = rd('README.md');
  ok(r.includes('Demo on made-up data. Not yet run against a live WhatsApp number.'), 'status line');
  ok(/```mermaid\nflowchart/.test(r), 'mermaid');
  for (const n of WF) ok(r.includes(`${n}.json`), `README does not mention ${n}.json`);
  for (const s of ['Orders', 'Refunds', 'Conversations', 'REPLACE_ME', 'Telegram']) ok(r.includes(s), `README does not mention ${s}`);
  ok(/(never|not) (been )?run/i.test(r) && /AI (Agent|step)/.test(r), 'README must say the AI step was not run');
  ok(r.includes(`${NSRC} of ${NTYPES} node types`), 'README must say how many node types were checked in the n8n source');
});
check('Safety & docs', 'case-study.md: about 200 words, first person, labelled as a demo, no personal name', () => {
  const c = rd('case-study.md').replace(/^#.*$/m, '').trim();
  const words = c.split(/\s+/).length;
  ok(words >= 150 && words <= 260, `${words} words`);
  ok(/\bI\b/.test(c) && /demo|made-up|sample/i.test(c), 'first person / label');
  if (PRIVATE_WORDS) ok(!PRIVATE_WORDS.some((w) => c.toLowerCase().includes(w.toLowerCase())), 'personal name in case-study.md');
});
check('Safety & docs', 'cover.png is 1600x1200 and cover.json is marked as a sample', () => {
  const b = readFileSync(path.join(ROOT, 'cover.png'));
  eq([b.readUInt32BE(16), b.readUInt32BE(20)], [1600, 1200], 'size');
  ok(/sample|personal project/i.test(JSON.parse(rd('cover.json')).label), 'label');
});

// ---------- report ----------
const total = results.length, passed = results.filter((r) => r.ok).length, failed = total - passed;
const rowsMd = results.map((r, i) => `| ${i + 1} | ${r.group} | ${r.name.replace(/\|/g, '/')} | ${r.ok ? 'PASS' : 'FAIL: ' + r.detail.replace(/\|/g, '/')} |`);
const head = '| # | Group | Check | Result |\n|---|---|---|---|';
const groups = [...new Set(results.map((r) => r.group))].map((g) => `- ${g}: ${results.filter((r) => r.group === g && r.ok).length}/${results.filter((r) => r.group === g).length}`).join('\n');
const md = `# Test results

Run: ${new Date().toISOString()} on Node ${process.version}. Fixed test clock for the date rules: ${NOW_ISO}.
Command: \`node test/run-tests.mjs\`

**${passed}/${total} checks passed, ${failed} failed.** ${codeNodeCount} Code nodes were compiled and the main ones were run on ${sampleFiles.length} made-up payloads.

${groups}

${head}
${rowsMd.join('\n')}

## What these tests do not show
- The AI Agent node was NOT run: it needs a model key. Agent text in these tests is simulated, to test the code around it (marks, counters, escalation).
- No n8n instance was used. Node types and versions are checked against \`test/node-types.json\` (${NSRC} of ${NTYPES} node types checked in the n8n source on GitHub on 2026-10-26, the other ${NTYPES - NSRC} from the docs), not by importing.
- Nothing was sent to WhatsApp, Slack, Telegram, Google Sheets or any API. All people, numbers and orders are invented.
`;
console.log(`${head}\n${rowsMd.join('\n')}\n\n${passed}/${total} checks passed, ${failed} failed.`);
writeFileSync(path.join(ROOT, 'results.md'), md);
process.exit(failed ? 1 : 0);

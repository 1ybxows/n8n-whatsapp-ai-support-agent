#!/usr/bin/env node
// Turns the execution JSON of the LIVE-RUN harness into test/live-run-results.md.
// Usage: node tools/live-run-report.mjs <execution.json> [--n8n 2.44.7] [--model gpt-4o-mini]
//   <execution.json> is the output of `n8n execute --id=cedarLiveRun0001 --rawOutput` (the whole run, every node's output).
// Reads only the run you give it plus samples/ and samples/expected.json. Writes only test/live-run-results.md.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const file = args.find((a) => !a.startsWith('--') && a !== flag('n8n') && a !== flag('model'));
if (!file) { console.error('usage: node tools/live-run-report.mjs <execution.json> [--n8n 2.44.7] [--model gpt-4o-mini]'); process.exit(2); }

// the CLI prints text before the JSON unless --rawOutput was used; take everything from the first "{"
const text = readFileSync(file, 'utf8');
const run = JSON.parse(text.slice(text.indexOf('{')));
const resultData = run.data?.resultData ?? run.resultData ?? run;
const runData = resultData.runData ?? {};
if (resultData.error) console.error(`note: the run reports an error: ${resultData.error.message ?? JSON.stringify(resultData.error).slice(0, 200)}`);

const outputs = (node, port = 'main') => (runData[node] ?? []).flatMap((r) => (r.data?.[port] ?? []).flat().map((i) => i.json));
const rows = outputs('Capture Sheet Row (not written)');
const notices = outputs('Capture Team Notice (not posted)');
const sends = outputs('Capture WhatsApp Reply (not sent)');
const agentErrors = (runData['Customer Support Agent'] ?? []).filter((r) => r.error).length;

// samples, in file order, joined to the run by WhatsApp message id
const dir = path.join(ROOT, 'samples');
const expected = JSON.parse(readFileSync(path.join(dir, 'expected.json'), 'utf8'));
const samples = readdirSync(dir).filter((f) => /^\d\d-.*\.json$/.test(f)).sort().map((f) => {
  const body = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  return { file: f, id: f.replace(/\.json$/, ''), messageId: msg?.id ?? '', exp: expected[f] ?? {} };
});

// token usage: sum whatever the chat-model sub-node recorded
let tokens = 0;
let tokenRuns = 0;
const walk = (v) => {
  if (!v || typeof v !== 'object') return;
  if (typeof v.totalTokens === 'number') { tokens += v.totalTokens; tokenRuns++; return; }
  for (const k of Object.keys(v)) walk(v[k]);
};
walk((runData['OpenAI Chat Model'] ?? runData['Anthropic Chat Model'] ?? []).map((r) => r.data));

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const quote = (s) => String(s ?? '').trim().split('\n').map((l) => `> ${l}`).join('\n');
const yn = (b) => (b ? 'yes' : 'no');

const byId = new Map(rows.map((r) => [r.messageId, r]));
const table = [];
const sections = [];
let agentReplies = 0, routeOk = 0, langOk = 0, missing = 0;
for (const s of samples) {
  const r = byId.get(s.messageId);
  if (!r) { missing++; table.push(`| ${s.id} | not in run | | | | | |`); sections.push(`### ${s.id}\nNo result for this sample in the run (it may have been dropped as a duplicate or a status update).\n`); continue; }
  const row = r.row ?? {};
  const rOk = s.exp.route === undefined ? null : s.exp.route === row.route;
  const lOk = s.exp.language === undefined ? null : s.exp.language === row.language;
  if (rOk) routeOk++;
  if (lOk) langOk++;
  if (row.route === 'agent') agentReplies++;
  table.push(`| ${s.id} | ${cell(row.language)} | ${cell(row.topic)} | ${cell(row.route)} | ${cell(row.outcome)} | ${yn(r.escalate)}${row.escalation_reason ? ` (${cell(row.escalation_reason)})` : ''} | ${rOk === null ? 'n/a' : yn(rOk && lOk !== false)} |`);
  sections.push([
    `### ${s.id}`,
    `- Customer wrote: ${cell(r.inbound) || '(no text)'}`,
    `- Language **${row.language}**${s.exp.language ? ` (expected ${s.exp.language})` : ''} · topic **${row.topic}** · route **${row.route}**${s.exp.route ? ` (expected ${s.exp.route})` : ''} · outcome **${row.outcome}** · escalated **${yn(r.escalate)}**${row.escalation_reason ? ` (${row.escalation_reason})` : ''}${row.order_id ? ` · order ${row.order_id}` : ''}`,
    r.reply ? `- Reply that would be sent:\n\n${quote(r.reply)}\n` : '- No reply (nothing would be sent).\n',
  ].join('\n'));
}

const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
const out = `# Live run results

Run on **${when} (UTC)** on a Mac: n8n ${flag('n8n', '2.44.7')} running locally, chat model \`${flag('model', runData['Anthropic Chat Model'] ? 'claude-haiku-5-5' : 'gpt-4o-mini')}\`, harness \`test/live-run.json\`.
Everything below is the made-up sample data. **Nothing was sent anywhere:** the WhatsApp reply, the Google Sheets writes and the team notice were captured by Capture nodes (captured sends: ${sends.length}, captured team notices: ${notices.length}).

- Samples in the run: ${samples.length}. Results found: ${samples.length - missing}.
- Reached the AI step: ${agentReplies}. AI step errors: ${agentErrors}.
- Route matched \`samples/expected.json\`: ${routeOk} of ${samples.length - missing}. Language matched: ${langOk} of ${samples.length - missing}.
- Tokens used by the chat model: ${tokenRuns ? `${tokens} (${tokenRuns} model calls)` : 'not shown in the run data'}.

The replies are what the model wrote on this run. A different run can word them differently.

## Summary

| Sample | Language | Topic | Route | Outcome | Escalated | Matches expected |
|---|---|---|---|---|---|---|
${table.join('\n')}

## Every sample

${sections.join('\n')}
${notices.length ? `## Team notices that would have gone to Slack or Telegram (not posted)\n\n${notices.map((n) => '```\n' + String(n.text ?? '').trim() + '\n```').join('\n\n')}\n` : ''}`;

writeFileSync(path.join(ROOT, 'test', 'live-run-results.md'), out);
console.log(`wrote test/live-run-results.md: ${samples.length - missing}/${samples.length} samples, ${agentReplies} through the AI step, ${agentErrors} AI errors, ${tokenRuns ? tokens + ' tokens' : 'tokens not shown'}`);

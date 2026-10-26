// Build Weekly Report: counts the last 7 days from the Conversations and Refunds sheet rows.
// Conversation rows have `outcome`; refund rows have `requested_at`.
const nowMs = $now.toMillis();
const sinceMs = nowMs - 7 * 86400000;
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const rows = $input.all().map((i) => i.json).filter((r) => r && Object.keys(r).length > 0);
const inWindow = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= sinceMs && t <= nowMs;
};
const conv = rows.filter((r) => 'outcome' in r && inWindow(r.logged_at));
const refunds = rows.filter((r) => 'requested_at' in r && inWindow(r.requested_at));
const handled = conv.filter((r) => r.outcome !== 'ignored');
const tally = (arr, key) => {
  const m = {};
  for (const r of arr) {
    const k = String(r[key] || 'n/a');
    m[k] = (m[k] || 0) + 1;
  }
  return m;
};
const top = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
const fmt = (entries) => (entries.length ? entries.map(([k, v]) => `${k} ${v}`).join(', ') : 'none');

const resolved = handled.filter((r) => r.outcome === 'resolved').length;
const escalated = handled.filter((r) => r.outcome === 'escalated').length;
const other = handled.length - resolved - escalated;
const pending = refunds.filter((r) => r.status === 'pending approval').length;
const refundAmount = Math.round(refunds.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
const stats = {
  periodFrom: day(sinceMs),
  periodTo: day(nowMs),
  messages: handled.length,
  ignored: conv.length - handled.length,
  resolved,
  escalated,
  other,
  resolutionRate: handled.length ? Math.round((resolved / handled.length) * 100) : 0,
  refunds: refunds.length,
  refundsPending: pending,
  refundAmount,
  topTopics: top(tally(handled, 'topic'), 5),
  languages: tally(handled, 'language'),
  escalationReasons: tally(handled.filter((r) => r.outcome === 'escalated'), 'escalation_reason'),
};
const text = [
  'Cedar Course Co. weekly support report',
  `Period: ${stats.periodFrom} to ${stats.periodTo}`,
  `Messages handled: ${stats.messages} (ignored: duplicates and empty, ${stats.ignored})`,
  `Resolved by the bot: ${resolved} (${stats.resolutionRate}%)`,
  `Passed to a person: ${escalated}`,
  `Other (unsupported type, unclear, unsure): ${other}`,
  `Refund requests logged: ${refunds.length} (${pending} pending approval, ${refundAmount} USD)`,
  `Top topics: ${fmt(stats.topTopics)}`,
  `Languages: ${fmt(Object.entries(stats.languages))}`,
  `Why people were passed on: ${fmt(Object.entries(stats.escalationReasons))}`,
].join('\n');
return [{ json: { subject: `Weekly support report ${stats.periodFrom} to ${stats.periodTo}`, text, stats } }];

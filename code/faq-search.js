// Search FAQ (Code Tool): the agent passes its search words as `query`; the tool returns a string.
// KB is copied from kb/faq.md by tools/build.mjs. Matching is plain keyword scoring, no AI and no vector store.
const KB = __KB__;
const norm = (s) =>
  String(s).toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['the', 'and', 'for', 'you', 'your', 'are', 'can', 'how', 'what', 'which', 'does', 'this', 'that', 'with', 'have', 'from', 'about', 'please', 'any', 'get', 'got', 'did', 'not', 'its', 'was', 'who', 'where', 'when', 'will', 'would', 'could', 'should', 'there', 'their', 'than', 'then', 'into', 'had', 'has', 'one', 'out', 'just', 'هل', 'ما', 'ماذا', 'كيف', 'في', 'من', 'الي', 'علي', 'عن', 'مع', 'هذا', 'هذه', 'انا', 'لدي', 'ان', 'او', 'لا', 'نعم', 'ثم', 'قد', 'كل', 'قبل', 'هو', 'هي', 'هم', 'لي', 'لك']);
const stem = (t) => (/[؀-ۿ]/.test(t) ? t.replace(/^(وال|بال|لل|ال)(?=.{3,})/, '') : t.length > 4 ? t.replace(/s$/, '') : t);
const tokens = (s) => norm(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t)).map(stem);

const prepared = KB.map((e) => {
  const kw = [...e.keywords_en, ...e.keywords_ar].map(norm);
  return {
    e,
    kwTokens: new Set(kw.flatMap((k) => tokens(k))),
    phrases: kw.filter((k) => k.includes(' ')),
    qTokens: new Set(tokens(e.q_en + ' ' + e.q_ar)),
  };
});

const nq = norm(query);
const qt = [...new Set(tokens(query))];
const scored = prepared
  .map((p) => {
    let score = 0;
    for (const t of qt) {
      if (p.kwTokens.has(t)) score += 3;
      if (p.qTokens.has(t)) score += 1;
    }
    for (const ph of p.phrases) if (nq.includes(ph)) score += 4;
    return { p, score };
  })
  .sort((a, b) => b.score - a.score);

if (!scored.length || scored[0].score < 3) {
  return 'NO_MATCH: the FAQ has no answer for this. Do not guess. Tell the customer you are not sure and end your reply with [[UNSURE]].';
}
const isAr = /[؀-ۿ]/.test(query);
const picked = scored.filter((s) => s.score >= Math.max(3, scored[0].score * 0.6)).slice(0, 2);
return (
  'FAQ matches. Answer only from these, in the customer\'s language:\n\n' +
  picked.map(({ p: { e } }) => `[${e.id}] Q: ${isAr ? e.q_ar : e.q_en}\nA: ${isAr ? e.a_ar : e.a_en}`).join('\n\n')
);

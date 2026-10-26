// Parses kb/faq.md into entries: { id, keywords_en[], keywords_ar[], q_en, a_en, q_ar, a_ar }.
export function parseFaq(md) {
  const entries = [];
  for (const block of md.split(/^## /m).slice(1)) {
    const lines = block.split('\n');
    const e = { id: lines.shift().trim() };
    for (const line of lines) {
      let m;
      if ((m = line.match(/^keywords \((en|ar)\): (.+)$/))) {
        e['keywords_' + m[1]] = m[2].split(',').map((s) => s.trim()).filter(Boolean);
      } else if ((m = line.match(/^([QA]) \((en|ar)\): (.+)$/))) {
        e[m[1].toLowerCase() + '_' + m[2]] = m[3].trim();
      }
    }
    entries.push(e);
  }
  return entries;
}

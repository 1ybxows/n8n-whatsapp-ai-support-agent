// Detect Language: Arabic or English by counting letters of each script.
// 'und' (undetermined) when the message has no letters at all (emoji, voice note, empty).
const AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LAT = /[A-Za-z]/g;
return $input.all().map((item) => {
  const text = String(item.json.text ?? '');
  const ar = (text.match(AR) || []).length;
  const en = (text.match(LAT) || []).length;
  const language = ar + en === 0 ? 'und' : ar > en ? 'ar' : 'en';
  return { json: { ...item.json, language, scriptCounts: { ar, en } } };
});

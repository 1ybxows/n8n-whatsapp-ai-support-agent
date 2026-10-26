// Normalize Message: one output item per WhatsApp message in the webhook payload.
// Accepts the full Cloud API webhook body (object / entry / changes / value) or the
// bare `value` object. Status-only updates (delivered / read receipts) produce no items.
const out = [];
for (const item of $input.all()) {
  const raw = item.json || {};
  const value = raw.entry?.[0]?.changes?.[0]?.value ?? raw;
  const messages = Array.isArray(value.messages) ? value.messages : [];
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const phoneNumberId = String(value.metadata?.phone_number_id ?? '');
  for (const m of messages) {
    const contact = contacts.find((c) => c.wa_id === m.from) ?? contacts[0] ?? {};
    const type = String(m.type ?? 'unknown');
    let text = '';
    if (type === 'text') text = m.text?.body ?? '';
    else if (type === 'button') text = m.button?.text ?? '';
    else if (type === 'interactive') text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '';
    text = String(text).replace(/\s+/g, ' ').trim();
    const ts = Number(m.timestamp);
    const waId = String(m.from ?? '').replace(/\D/g, '');
    out.push({
      json: {
        messageId: String(m.id ?? ''),
        waId,
        phone: waId ? '+' + waId : '',
        name: String(contact.profile?.name ?? '').trim() || 'Customer',
        phoneNumberId,
        type,
        supported: ['text', 'button', 'interactive'].includes(type),
        text,
        receivedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null,
      },
    });
  }
}
return out;

// Normalize Order: maps the payment-API answer OR the Orders-sheet row into one shape.
// Details are shared only when the order belongs to the WhatsApp number that is asking.
const req = $('Validate Order ID').first().json;
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const rows = $input.all().map((i) => i.json).filter((r) => r && Object.keys(r).length > 0 && !r.error);

const notFound = {
  json: {
    found: false,
    owner_match: false,
    order_id: req.order_id,
    message: `No order ${req.order_id} was found. Ask the customer to check the number in their receipt email.`,
  },
};
const toRec = (r) =>
  r.id
    ? { source: 'payment_api', order_id: String(r.id).toUpperCase(), phone: r.customer?.phone, name: r.customer?.name, product: r.product?.name ?? r.product, amount: Number(r.amount), currency: r.currency || 'USD', purchased_at: r.created_at, status: String(r.status || '').toLowerCase() }
    : r.order_id
      ? { source: 'orders_sheet', order_id: String(r.order_id).toUpperCase(), phone: r.customer_phone, name: r.customer_name, product: r.product, amount: Number(r.amount), currency: r.currency || 'USD', purchased_at: r.purchased_at, status: String(r.status || '').toLowerCase() }
      : null;

const rec = rows.map(toRec).find((x) => x && x.order_id === req.order_id);
if (!rec) return [notFound];
if (digits(rec.phone) !== digits(req.customer_phone)) {
  return [{
    json: {
      found: true,
      owner_match: false,
      order_id: rec.order_id,
      message: 'An order with that number exists but is not linked to this WhatsApp number. Do not share any details. Offer to hand the chat to a team member.',
    },
  }];
}
return [{
  json: {
    found: true,
    owner_match: true,
    source: rec.source,
    order_id: rec.order_id,
    customer_name: rec.name,
    product: rec.product,
    amount: rec.amount,
    currency: rec.currency,
    status: rec.status,
    purchased_at: rec.purchased_at,
    message: `Order ${rec.order_id}: ${rec.product}, ${rec.amount} ${rec.currency}, status ${rec.status}, bought on ${String(rec.purchased_at).slice(0, 10)}.`,
  },
}];

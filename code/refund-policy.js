// Refund Policy Check: the agent can ask for a refund, but only this node decides what happens.
// Window 14 days, automatic logging up to 150 USD; anything else is declined or goes to a person.
const WINDOW_DAYS = 14;
const AUTO_LIMIT_USD = 150;
const req = $('Tool Input').first().json;
const order = $input.first().json;
const nowMs = $now.toMillis();
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

let decision = 'ok';
let message = '';
const id = order.order_id || req.order_id;
if (!order.found) {
  decision = 'not_found';
  message = `Order ${id} was not found, so no refund request was logged. Ask the customer to check the order number.`;
} else if (!order.owner_match) {
  decision = 'not_owner';
  message = 'That order is not linked to this WhatsApp number, so nothing was logged. Do not share details. Offer a team member and end your reply with [[HANDOFF:team_task]].';
} else if (order.status === 'refunded') {
  decision = 'already_refunded';
  message = `Order ${id} is already refunded. Tell the customer. Nothing was logged.`;
} else if (order.status !== 'paid') {
  decision = 'not_paid';
  message = `Order ${id} has status "${order.status}", not paid, so it cannot be refunded here. Nothing was logged. End your reply with [[HANDOFF:payment_dispute]].`;
} else if ((nowMs - Date.parse(order.purchased_at)) / 86400000 > WINDOW_DAYS) {
  decision = 'window_closed';
  message = `The ${WINDOW_DAYS}-day refund window for order ${id} closed on ${day(Date.parse(order.purchased_at) + WINDOW_DAYS * 86400000)}. Nothing was logged. Explain the policy politely.`;
} else if (order.amount > AUTO_LIMIT_USD) {
  decision = 'needs_human';
  message = `Order ${id} is ${order.amount} ${order.currency}, above the automatic limit of ${AUTO_LIMIT_USD} USD. Nothing was logged. Do not promise a refund. Say a person will review it and end your reply with [[HANDOFF:refund_over_limit]].`;
} else {
  message = `Refund request logged for order ${id} (${order.amount} ${order.currency}). Status: pending approval. A team member confirms within 2 business days. Tell the customer exactly this.`;
}

const refundRow =
  decision === 'ok'
    ? {
        requested_at: new Date(nowMs).toISOString(),
        message_id: String(req.message_id ?? ''),
        customer_phone: String(req.customer_phone ?? ''),
        customer_name: String(req.customer_name ?? ''),
        order_id: id,
        product: order.product,
        amount: order.amount,
        currency: order.currency,
        reason: String(req.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'not given',
        language: String(req.language ?? ''),
        status: 'pending approval',
        handled_by: '',
        handled_at: '',
      }
    : null;
return [{ json: { decision, message, refundRow } }];

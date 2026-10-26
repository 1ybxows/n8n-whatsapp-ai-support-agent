// Validate Order ID: only CC-1234 style ids (4 to 6 digits) go on to the payment API / sheet.
return $input.all().map((item) => {
  const orderId = String(item.json.order_id ?? '').trim().toUpperCase();
  return {
    json: {
      order_id: orderId,
      customer_phone: String(item.json.customer_phone ?? ''),
      valid: /^CC-\d{4,6}$/.test(orderId),
    },
  };
});

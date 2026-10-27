# Live run results

Run on **27 October 2026 at 12:46 (UTC)** on a Mac: n8n 2.44.7 running locally, chat model `claude-haiku-5-5`, harness `test/live-run-anthropic.json`.
Everything below is the made-up sample data. **Nothing was sent anywhere:** the WhatsApp reply, the Google Sheets writes and the team notice were captured by Capture nodes (captured sends: 19, captured team notices: 7).

Samples went through one at a time, so each customer had their own chat memory.

- Samples in the run: 24. Results found: 23 (the missing one is a delivery receipt, which the flow drops before the AI step on purpose).
- Reached the AI step: 8. The other 16 were handled by the fixed steps before the AI step. AI step errors: 0.
- Tool calls: FAQ search 4 (0 failed), order lookup 2 (0 said "not found" or failed), refund request 2 (0 said "not found" or failed).
- Route matched `samples/expected.json`: 23 of 23. Language matched: 23 of 23.
- Tokens used by the chat model: 32153 (16 model calls).

The replies are what the model wrote on this run. A different run can word them differently.

## Summary

| Sample | Language | Topic | Route | Outcome | Escalated | Matches expected |
|---|---|---|---|---|---|---|
| 01-en-faq-access | en | access | agent | resolved | no | yes |
| 02-en-faq-refund-policy | en | refund | agent | resolved | no | yes |
| 03-en-order-status | en | order_status | agent | resolved | no | yes |
| 04-en-refund-ask | en | refund | agent | resolved | no | yes |
| 05-en-angry | en | refund | escalate | escalated | yes (unhappy) | yes |
| 06-en-gibberish | en | other | reply_only | reply_only | no (unclear) | yes |
| 07-en-empty | und | other | ignore | ignored | no (empty) | yes |
| 08-en-voice-note | und | other | reply_only | reply_only | no (unsupported_type) | yes |
| 09-en-duplicate | en | access | ignore | ignored | no (duplicate) | yes |
| 10-en-human-request | en | other | escalate | escalated | yes (human_requested) | yes |
| 11-en-delivery-receipt | dropped on purpose (delivery receipt) | | | | | |
| 12-en-gibberish-twice | en | other | escalate | escalated | yes (two_failed_answers) | yes |
| 13-ar-faq-access | ar | access | agent | resolved | no | yes |
| 14-ar-faq-certificate | ar | certificate | agent | resolved | no | yes |
| 15-ar-order-status | ar | order_status | agent | resolved | no | yes |
| 16-ar-refund-ask | ar | refund | agent | escalated | yes (refund_over_limit) | yes |
| 17-ar-angry | ar | refund | escalate | escalated | yes (unhappy) | yes |
| 18-ar-gibberish | ar | other | reply_only | reply_only | no (unclear) | yes |
| 19-ar-empty | und | other | ignore | ignored | no (empty) | yes |
| 20-ar-voice-note | und | other | reply_only | reply_only | no (unsupported_type) | yes |
| 21-ar-duplicate | ar | access | ignore | ignored | no (duplicate) | yes |
| 22-ar-human-request | ar | other | escalate | escalated | yes (human_requested) | yes |
| 23-ar-image-attachment | und | other | reply_only | reply_only | no (unsupported_type) | yes |
| 24-ar-gibberish-twice | ar | other | escalate | escalated | yes (two_failed_answers) | yes |

## Every sample

### 01-en-faq-access
- Customer wrote: Hi! How do I access the course after paying?
- Language **en** (expected en) · topic **access** · route **agent** (expected agent) · outcome **resolved** · escalated **no**
- Reply that would be sent:

> Hi Sam! After payment, we email you a sign-in link to access the course. It usually arrives within 10 minutes, so please check your spam folder too. If nothing arrives after 30 minutes, send me your order number (it looks like CC-1234) and I'll check it for you.

### 02-en-faq-refund-policy
- Customer wrote: What is your refund policy?
- Language **en** (expected en) · topic **refund** · route **agent** (expected agent) · outcome **resolved** · escalated **no**
- Reply that would be sent:

> You can ask for a full refund within 14 days of buying, for any reason. If you send me your order number (format CC-1234), I can log the request. A team member then reviews it, usually within 2 business days, and the money goes back to your original payment method. After 14 days, we cannot offer a refund. Team licenses are always reviewed by a person.

### 03-en-order-status
- Customer wrote: Where is my order CC-1042?
- Language **en** (expected en) · topic **order_status** · route **agent** (expected agent) · outcome **resolved** · escalated **no** · order CC-1042
- Reply that would be sent:

> Good news, Sam! Order CC-1042 is for the Cedar Course, 89 USD, and its status is paid. It was purchased on October 20, 2026. If you haven't received your sign-in link yet, check your spam folder, and let me know if it still hasn't arrived after 30 minutes.

### 04-en-refund-ask
- Customer wrote: I want a refund for order CC-1042, it's not what I expected.
- Language **en** (expected en) · topic **refund** · route **agent** (expected agent) · outcome **resolved** · escalated **no** · order CC-1042
- Reply that would be sent:

> Your refund request for order CC-1042 (89 USD) has been logged and is pending approval. A team member will confirm within 2 business days. I can't approve refunds myself, so I can't promise the outcome.

### 05-en-angry
- Customer wrote: This is the WORST service!!! I paid and nothing works. Scam. I want my money back NOW
- Language **en** (expected en) · topic **refund** · route **escalate** (expected escalate) · outcome **escalated** · escalated **yes** (unhappy)
- Reply that would be sent:

> I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.

### 06-en-gibberish
- Customer wrote: asdkjh qwrtp zxcvb
- Language **en** (expected en) · topic **other** · route **reply_only** (expected reply_only) · outcome **reply_only** · escalated **no** (unclear)
- Reply that would be sent:

> Sorry, I did not understand that. Could you write your question in a few words? You can also type "human" to reach a team member.

### 07-en-empty
- Customer wrote: (no text)
- Language **und** (expected und) · topic **other** · route **ignore** (expected ignore) · outcome **ignored** · escalated **no** (empty)
- No reply (nothing would be sent).

### 08-en-voice-note
- Customer wrote: (no text)
- Language **und** (expected und) · topic **other** · route **reply_only** (expected reply_only) · outcome **reply_only** · escalated **no** (unsupported_type)
- Reply that would be sent:

> I can only read text messages for now. Please type your question and I will help.
> 
> أستطيع قراءة الرسائل النصية فقط حاليًا. من فضلك اكتب سؤالك وسأساعدك.

### 09-en-duplicate
- Customer wrote: Hi! How do I access the course after paying?
- Language **en** (expected en) · topic **access** · route **ignore** (expected ignore) · outcome **ignored** · escalated **no** (duplicate)
- No reply (nothing would be sent).

### 10-en-human-request
- Customer wrote: Can I talk to a real person please?
- Language **en** (expected en) · topic **other** · route **escalate** (expected escalate) · outcome **escalated** · escalated **yes** (human_requested)
- Reply that would be sent:

> I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.

### 11-en-delivery-receipt
This is a WhatsApp delivery receipt (a status update), not a customer message. The flow drops it before the AI step, so it has no result. That is expected.

### 12-en-gibberish-twice
- Customer wrote: zzzzzz qqqqq
- Language **en** (expected en) · topic **other** · route **escalate** (expected escalate) · outcome **escalated** · escalated **yes** (two_failed_answers)
- Reply that would be sent:

> I'm sorry about this. I've passed your chat to a team member, who will reply here as soon as possible. Please don't send card details in this chat.

### 13-ar-faq-access
- Customer wrote: السلام عليكم، كيف أدخل إلى الدورة بعد الدفع؟
- Language **ar** (expected ar) · topic **access** · route **agent** (expected agent) · outcome **resolved** · escalated **no**
- Reply that would be sent:

> وعليكم السلام ورحمة الله. بعد الدفع نرسل لك رابط تسجيل الدخول إلى الدورة عبر البريد الإلكتروني، وغالباً يصل خلال 10 دقائق. تحقق من مجلد الرسائل غير المرغوب فيها (Spam). إذا لم يصل بعد 30 دقيقة، أرسل لي رقم طلبك بصيغة CC-1234 لأتحقق منه.

### 14-ar-faq-certificate
- Customer wrote: هل أحصل على شهادة بعد إنهاء الدورة؟
- Language **ar** (expected ar) · topic **certificate** · route **agent** (expected agent) · outcome **resolved** · escalated **no**
- Reply that would be sent:

> نعم، تحصل على شهادة إتمام بصيغة PDF عند إنهاء جميع الدروس واجتياز الاختبار النهائي بنسبة 80% أو أكثر. يمكنك تنزيلها من حسابك. 🎓

### 15-ar-order-status
- Customer wrote: أين طلبي رقم CC-1077؟
- Language **ar** (expected ar) · topic **order_status** · route **agent** (expected agent) · outcome **resolved** · escalated **no** · order CC-1077
- Reply that would be sent:

> أهلاً ليلى. طلبك رقم CC-1077 (Cedar Course + Workbook) بقيمة 129 دولاراً، حالته: مدفوع. تاريخ الشراء كان 22 أكتوبر 2026. إذا لم يصلك رابط الدخول بعد، أخبرني وسأتحقق من ذلك.

### 16-ar-refund-ask
- Customer wrote: أريد استرجاع المبلغ للطلب CC-2003 من فضلك
- Language **ar** (expected ar) · topic **refund** · route **agent** (expected agent) · outcome **escalated** · escalated **yes** (refund_over_limit) · order CC-2003
- Reply that would be sent:

> أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.

### 17-ar-angry
- Customer wrote: هذه خدمة سيئة جدا! أنا غاضب، نصب واحتيال، أريد مالي الآن
- Language **ar** (expected ar) · topic **refund** · route **escalate** (expected escalate) · outcome **escalated** · escalated **yes** (unhappy)
- Reply that would be sent:

> أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.

### 18-ar-gibberish
- Customer wrote: ققققق ببببب ؤؤؤؤ
- Language **ar** (expected ar) · topic **other** · route **reply_only** (expected reply_only) · outcome **reply_only** · escalated **no** (unclear)
- Reply that would be sent:

> عذرًا، لم أفهم رسالتك. هل يمكنك كتابة سؤالك بكلمات قليلة؟ يمكنك أيضًا كتابة "موظف" للتحدث مع أحد أعضاء الفريق.

### 19-ar-empty
- Customer wrote: (no text)
- Language **und** (expected und) · topic **other** · route **ignore** (expected ignore) · outcome **ignored** · escalated **no** (empty)
- No reply (nothing would be sent).

### 20-ar-voice-note
- Customer wrote: (no text)
- Language **und** (expected und) · topic **other** · route **reply_only** (expected reply_only) · outcome **reply_only** · escalated **no** (unsupported_type)
- Reply that would be sent:

> I can only read text messages for now. Please type your question and I will help.
> 
> أستطيع قراءة الرسائل النصية فقط حاليًا. من فضلك اكتب سؤالك وسأساعدك.

### 21-ar-duplicate
- Customer wrote: السلام عليكم، كيف أدخل إلى الدورة بعد الدفع؟
- Language **ar** (expected ar) · topic **access** · route **ignore** (expected ignore) · outcome **ignored** · escalated **no** (duplicate)
- No reply (nothing would be sent).

### 22-ar-human-request
- Customer wrote: أريد التحدث مع موظف
- Language **ar** (expected ar) · topic **other** · route **escalate** (expected escalate) · outcome **escalated** · escalated **yes** (human_requested)
- Reply that would be sent:

> أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.

### 23-ar-image-attachment
- Customer wrote: (no text)
- Language **und** (expected und) · topic **other** · route **reply_only** (expected reply_only) · outcome **reply_only** · escalated **no** (unsupported_type)
- Reply that would be sent:

> I can only read text messages for now. Please type your question and I will help.
> 
> أستطيع قراءة الرسائل النصية فقط حاليًا. من فضلك اكتب سؤالك وسأساعدك.

### 24-ar-gibberish-twice
- Customer wrote: هههههههههه ؤؤؤؤ
- Language **ar** (expected ar) · topic **other** · route **escalate** (expected escalate) · outcome **escalated** · escalated **yes** (two_failed_answers)
- Reply that would be sent:

> أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.

## Team notices that would have gone to Slack or Telegram (not posted)

```
Handoff needed: Unhappy customer
Customer: Priya Menon (+15550100106)
Language: English | Topic: refund

Last messages:
Customer: This is the WORST service!!! I paid and nothing works. Scam. I want my money back NOW

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

```
Handoff needed: Customer asked for a person
Customer: Lena Park (+15550100110)
Language: English | Topic: other

Last messages:
Customer: Can I talk to a real person please?

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

```
Handoff needed: The bot could not answer twice in a row
Customer: Tom Reyes (+15550100107)
Language: English | Topic: other

Last messages:
Customer: asdkjh qwrtp zxcvb
Customer: zzzzzz qqqqq

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

```
Handoff needed: Refund above the automatic limit
Customer: Omar Hadi (+15550100103)
Language: Arabic | Topic: refund | Order: CC-2003

Last messages:
Customer: هل أحصل على شهادة بعد إنهاء الدورة؟
Bot: نعم، تحصل على شهادة إتمام بصيغة PDF عند إنهاء جميع الدروس واجتياز الاختبار النهائي بنسبة 80% أو أكثر. يمكنك تنزيلها من حسابك. 🎓
Customer: أريد استرجاع المبلغ للطلب CC-2003 من فضلك
Bot: أعتذر عن ذلك. حوّلت محادثتك إلى أحد أعضاء الفريق وسيرد عليك هنا في أقرب وقت. من فضلك لا ترسل بيانات بطاقتك في هذه المحادثة.

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

```
Handoff needed: Unhappy customer
Customer: Noor Aziz (+15550100105)
Language: Arabic | Topic: refund

Last messages:
Customer: هذه خدمة سيئة جدا! أنا غاضب، نصب واحتيال، أريد مالي الآن

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

```
Handoff needed: Customer asked for a person
Customer: Zain Tariq (+15550100113)
Language: Arabic | Topic: other

Last messages:
Customer: أريد التحدث مع موظف

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

```
Handoff needed: The bot could not answer twice in a row
Customer: Rami Saad (+15550100111)
Language: Arabic | Topic: other

Last messages:
Customer: ققققق ببببب ؤؤؤؤ
Customer: هههههههههه ؤؤؤؤ

Reply to the customer in WhatsApp. The bot already told them a person will reply.
```

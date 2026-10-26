# Case study: a WhatsApp support agent for a made-up course shop

Demo on made-up data. Not client work, and not yet run against a live WhatsApp number.

I built this to show a WhatsApp support agent, a common request for small online shops. The shop is invented: it sells one online course and gets the same questions in English and Arabic. The hard part is knowing when the bot must stop, because a wrong refund answer costs real money.

**What I built.** Six n8n workflows. Plain code checks every message first: duplicates, voice notes, angry words, requests for a person. Only normal questions reach the AI agent, which has three tools: FAQ search, order lookup and refund request. The agent can only ask for a refund; a separate step checks the order owner, the 14-day window and a 150 USD limit, then logs a "pending approval" row. Anything doubtful, angry or over the limit goes to Slack with the last messages, and the customer is told a person will reply. A weekly report counts chats, hand-offs and refunds.

**How I tested it.** 148 offline checks on 24 invented WhatsApp payloads, half English and half Arabic. All pass. The AI step itself was not run, because it needs a model key.

**What you would get.** Import-ready workflows (not yet imported into n8n), sheet templates, a credentials list and a list of limits. If you want this on your own number, I would connect it to your WhatsApp account and FAQ, and we would run it live together before it answers a real customer.

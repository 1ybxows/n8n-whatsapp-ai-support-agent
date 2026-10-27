# WhatsApp AI Support Agent (n8n 2.x)

**Demo on made-up data. Not yet run against a live WhatsApp number.**

**Live test, 27 Oct 2026:** the AI step ran live on n8n 2.44.7 on a Mac, with `claude-haiku-5-5`, on 8 of the 24 made-up messages (the other 16 are handled before the AI step). It ran in a test harness that sends nothing. No real Google Sheets or Slack was used. The first run found a bug in how the order and refund tools were wired for the AI; it is fixed and the run was repeated (see Limits). Results: [test/live-run-results.md](test/live-run-results.md).

"Cedar Course Co." is an invented online store that sells one digital course with a one-time payment. Customers write in English and Arabic. This demo shows how I would build the support line for a shop like that.

## What it does
1. A WhatsApp message arrives; code cleans it, finds the language (English or Arabic) and applies safety rules before any AI is used.
2. Normal questions go to an AI Agent with three tools: **search_faq**, **look_up_order** (payment API, then an Orders sheet as fallback) and **request_refund**.
3. The agent cannot approve money. A separate workflow checks the order owner, the 14-day window and a 150 USD limit, and logs a row with status `pending approval`.
4. Angry customers, "I want a person", two failed answers, refunds over the limit and AI errors or empty AI answers are handed to a person in Slack (or Telegram) with the last messages, and the customer is told a person will reply.
5. A weekly report counts messages, topics, resolved, handed over, and refunds.

```mermaid
flowchart TD
  A[WhatsApp message] --> B[Normalize + detect language]
  B --> C{Rules, no AI}
  C -->|duplicate, empty| Z[No reply]
  C -->|voice note, image, gibberish| R[Canned reply]
  C -->|angry, asks for a person, 2nd gibberish| H[Handoff notice]
  C -->|normal question| D[AI Agent]
  D --> T1[search_faq]
  D --> T2[look_up_order]
  D --> T3[request_refund]
  T2 --> O[Payment API, else Orders sheet]
  T3 --> F[Policy check, then Refunds sheet]
  D --> Q{Answer received?}
  Q -->|yes| P[Read UNSURE / HANDOFF marks]
  P -->|answered or rephrase| S
  P -->|2 failed answers or handoff| H
  Q -->|no answer| H
  D -.->|error output| H
  R --> S[Send WhatsApp reply]
  H --> S
  Z --> L
  S --> L[Log to Conversations sheet]
  L -->|escalated| E[Escalation workflow: Slack or Telegram]
  W[Every Monday 08:00] --> X[Read Conversations + Refunds] --> M[Weekly report to Slack]
```

## Files
| Path | What |
|---|---|
| `workflows/support-agent.json` | Main flow: trigger, rules, AI Agent, reply, log |
| `workflows/escalation.json` | Sub-workflow: handoff message to Slack (Telegram option) |
| `workflows/order-lookup.json` | Sub-workflow used as a tool: payment API, then Orders sheet |
| `workflows/refund-request.json` | Sub-workflow used as a tool: policy check, then Refunds sheet |
| `workflows/weekly-report.json` | Monday report from the two sheets |
| `workflows/error-handler.json` | Catch-all error workflow (alerts on Telegram) |
| `kb/faq.md` | The FAQ, English and Arabic (11 entries) |
| `sheets/*.csv` | Sheet templates: `Orders` (made-up rows), `Refunds`, `Conversations` |
| `samples/*.json` | 24 made-up WhatsApp webhook payloads + `expected.json` |
| `code/*.js` | The Code node sources; `node tools/build.mjs` builds the JSON from them |
| `test/run-tests.mjs`, `results.md` | The test runner and its latest output |

## Import and connect
1. Create one Google spreadsheet with three tabs named `Orders`, `Refunds`, `Conversations`. Import the matching CSV into each (header row first).
2. In n8n: Workflows, Import from File. Import in this order: `error-handler`, `escalation`, `order-lookup`, `refund-request`, `support-agent`, `weekly-report`.
3. Replace the placeholders: `REPLACE_ME_SPREADSHEET_ID` (Sheets nodes), `REPLACE_ME_CHANNEL_ID` (Slack), `REPLACE_ME_CHAT_ID` (Telegram), `REPLACE_ME_PHONE_NUMBER_ID` (WhatsApp send node), and the three workflow ids: `REPLACE_ME_ORDER_LOOKUP_WORKFLOW_ID` (in `support-agent` and `refund-request`), `REPLACE_ME_REFUND_REQUEST_WORKFLOW_ID` and `REPLACE_ME_ESCALATION_WORKFLOW_ID` (in `support-agent`). Then open each node that calls a workflow once and press the refresh icon beside its inputs, so n8n reads the sub-workflow's input names.
4. Set the credentials (all ship as placeholders with id `REPLACE_ME`):

| Credential | Used by |
|---|---|
| WhatsApp Business Cloud (`whatsAppApi`) and WhatsApp trigger (`whatsAppTriggerApi`) | `support-agent` |
| OpenAI (`openAiApi`); any n8n chat model node can replace it | `support-agent` |
| Google Sheets OAuth2 | `support-agent`, `order-lookup`, `refund-request`, `weekly-report` |
| Slack (`slackApi`) | `escalation`, `weekly-report` |
| Telegram bot | `error-handler`, optional in `escalation` |
| Header auth for the payment API | `order-lookup` (placeholder URL `api.payments.example.com`) |

5. In each workflow's Settings, set **Error Workflow** to `Error Handler`. This is a UI-only setting; an import cannot set it.
6. Activate `support-agent` last. Static data (duplicate ids, failed-answer counters, short chat history) only persists while a workflow is active, not in manual test runs.

### Sheets and columns
- `Orders`: order_id, customer_phone, customer_name, product, amount, currency, purchased_at, status
- `Refunds`: requested_at, message_id, customer_phone, customer_name, order_id, product, amount, currency, reason, language, status, handled_by, handled_at
- `Conversations`: logged_at, message_id, customer, language, message_type, topic, route, outcome, escalation_reason, order_id, delivery

`Conversations` keeps only the last 4 digits of a phone number. `Refunds` and the Slack message keep the full number, because a person must reply.

### Slack to Telegram
Open `escalation`: disable `Post to Slack`, enable `Post to Telegram (optional)`, pick the bot credential and set the chat id. Same swap for the report in `weekly-report` (email option: `Email Report (optional)`).

## The rules, in order
| # | Rule | Result |
|---|---|---|
| 1 | Message id already seen | ignored |
| 2 | Not text (voice note, image, ...) | canned reply asking for text |
| 3 | Empty text | ignored |
| 4 | Anger score 2 or more (strong word, or mild word + shouting or `!!!`) | handoff |
| 5 | Asks for a person / manager (EN, AR) | handoff |
| 6 | Gibberish (second time in a row) | first: "please rephrase"; second: handoff |
| 7 | Anything else | AI Agent |
| 8 | Agent ends with `[[UNSURE]]` | "not sure, rephrase"; second time in a row: handoff |
| 9 | Agent ends with `[[HANDOFF:reason]]` | handoff |
| 10 | Agent step errors | handoff |

## Tests
```bash
node test/run-tests.mjs
```
No installs, no network. The runner takes the JavaScript straight out of the workflow JSON and runs it on the 24 payloads, then checks FAQ search, order and refund rules, the report counts, workflow structure, node types, connections, secrets and these docs. Latest output: [results.md](results.md) (149 of 149 checks pass).

### Illustrative conversations (not a live run)
These show what the rules and tools are built to produce. The AI wording is an example, not output from a model.

> **Customer:** I want a refund for order CC-1042, it's not what I expected.
> **Agent (illustrative):** I have logged a refund request for order CC-1042 (89 USD). Status: pending approval. A team member confirms within 2 business days.

> **Customer (AR):** أريد استرجاع المبلغ للطلب CC-2003
> **Flow (illustrative):** the order is 349 USD, above the 150 USD limit, so nothing is logged. The agent ends with `[[HANDOFF:refund_over_limit]]`, the customer gets the Arabic handoff notice, and Slack gets the last messages.

## Limits (plain)
- **The AI Agent step ran live once, in a test harness.** On 27 Oct 2026, 24 made-up messages went through a copy of this flow on n8n 2.44.7 (Node 25) with `claude-haiku-5-5`: 8 reached the AI step with no AI errors, the other 16 were handled before it. WhatsApp, Sheets and Slack were replaced by capture nodes, so nothing was sent (see `test/LIVE-RUN.md`). One run is a spot check, not a quality guarantee: the wording changes from run to run.
- **A live run found a tool bug, now fixed.** The order and refund tools had an empty input list in the workflow JSON, so n8n treated them as plain text and the order number never reached the tool workflow: every call said "not found" (the AI handled that safely and invented nothing). The input list is now filled in and a test guards it. In the repeat run the order replies show the real order from the sample sheet, one refund was logged as pending approval and the 349 USD one was handed to a person. That is 2 order lookups and 2 refund calls: a spot check. The offline checks alone could not see this bug.
- n8n reads the chat memory key once per run. That is safe here because every WhatsApp message starts its own run, but several customers must never be put into one agent run (the test harness hit this and now feeds one sample at a time).
- On the Mac used for testing, n8n 2.44.7 runs with `N8N_EXPRESSION_ENGINE=legacy`, because Node 25 cannot build `isolated-vm`, which n8n's default expression engine needs (n8n itself asks for Node 24). The default engine has not been tried with this demo.
- Import-ready: all six workflows imported into n8n 2.44.7 with its command line (inactive). Not connected to a real WhatsApp number. 6 of 22 node types were checked in the n8n source, the other 16 come from the docs.
- If the Sheets log write fails after 3 tries, the chat still carries on and a person is still told, but that log row is lost without an alert (n8n treats the error as handled).
- Two settings were written from the n8n docs and could not be proven offline. In the live run the memory key worked (each customer had their own history) and, after the fix above, the inputs reach the order and refund sub-workflow tools. The FAQ search tool worked from the start.
- WhatsApp only allows free-text replies within 24 hours of the customer's last message; later replies need an approved template, which this demo does not include.
- Language detection counts Arabic and Latin letters. Arabic typed in Latin letters is not understood; the message goes to the agent as English.
- Anger and "person" rules are word lists. They will miss some messages and flag a few calm ones.
- A refund request is not checked against earlier requests for the same order (a repeat would add a second row).
- The weekly report reads both sheets in full. Fine for a small shop, not for a very large log.
- The payment API is a placeholder URL; the answer shape it expects is described in the `order-lookup` note.

## Rebuild
```bash
node tools/build.mjs          # code/*.js + kb/faq.md  ->  workflows/*.json
node tools/make-samples.mjs   # samples/*.json + expected.json
```

# Test results

Run: 2026-10-26T23:46:13.498Z on Node v25.9.0. Fixed test clock for the date rules: 2026-10-26T12:00:00Z.
Command: `node test/run-tests.mjs`

**148/148 checks passed, 0 failed.** 11 Code nodes were compiled and the main ones were run on 24 made-up payloads.

- Workflow files: 52/52
- Code nodes: 21/21
- Samples: 30/30
- Agent reply: 15/15
- FAQ tool: 6/6
- Orders & refunds: 14/14
- Escalation & report: 5/5
- Safety & docs: 5/5

| # | Group | Check | Result |
|---|---|---|---|
| 1 | Workflow files | support-agent.json parses | PASS |
| 2 | Workflow files | escalation.json parses | PASS |
| 3 | Workflow files | order-lookup.json parses | PASS |
| 4 | Workflow files | refund-request.json parses | PASS |
| 5 | Workflow files | weekly-report.json parses | PASS |
| 6 | Workflow files | error-handler.json parses | PASS |
| 7 | Workflow files | support-agent: unique node names and ids | PASS |
| 8 | Workflow files | support-agent: every node type + version exists in n8n 2.x | PASS |
| 9 | Workflow files | support-agent: every connection points at a real node | PASS |
| 10 | Workflow files | support-agent: exactly one trigger, nothing left unconnected | PASS |
| 11 | Workflow files | support-agent: error outputs wired both ways (onError <-> main[1]) | PASS |
| 12 | Workflow files | support-agent: IF nodes wire both branches (except documented) | PASS |
| 13 | Workflow files | support-agent: credentials are placeholders (id REPLACE_ME), workflow inactive | PASS |
| 14 | Workflow files | escalation: unique node names and ids | PASS |
| 15 | Workflow files | escalation: every node type + version exists in n8n 2.x | PASS |
| 16 | Workflow files | escalation: every connection points at a real node | PASS |
| 17 | Workflow files | escalation: exactly one trigger, nothing left unconnected | PASS |
| 18 | Workflow files | escalation: error outputs wired both ways (onError <-> main[1]) | PASS |
| 19 | Workflow files | escalation: IF nodes wire both branches (except documented) | PASS |
| 20 | Workflow files | escalation: credentials are placeholders (id REPLACE_ME), workflow inactive | PASS |
| 21 | Workflow files | order-lookup: unique node names and ids | PASS |
| 22 | Workflow files | order-lookup: every node type + version exists in n8n 2.x | PASS |
| 23 | Workflow files | order-lookup: every connection points at a real node | PASS |
| 24 | Workflow files | order-lookup: exactly one trigger, nothing left unconnected | PASS |
| 25 | Workflow files | order-lookup: error outputs wired both ways (onError <-> main[1]) | PASS |
| 26 | Workflow files | order-lookup: IF nodes wire both branches (except documented) | PASS |
| 27 | Workflow files | order-lookup: credentials are placeholders (id REPLACE_ME), workflow inactive | PASS |
| 28 | Workflow files | refund-request: unique node names and ids | PASS |
| 29 | Workflow files | refund-request: every node type + version exists in n8n 2.x | PASS |
| 30 | Workflow files | refund-request: every connection points at a real node | PASS |
| 31 | Workflow files | refund-request: exactly one trigger, nothing left unconnected | PASS |
| 32 | Workflow files | refund-request: error outputs wired both ways (onError <-> main[1]) | PASS |
| 33 | Workflow files | refund-request: IF nodes wire both branches (except documented) | PASS |
| 34 | Workflow files | refund-request: credentials are placeholders (id REPLACE_ME), workflow inactive | PASS |
| 35 | Workflow files | weekly-report: unique node names and ids | PASS |
| 36 | Workflow files | weekly-report: every node type + version exists in n8n 2.x | PASS |
| 37 | Workflow files | weekly-report: every connection points at a real node | PASS |
| 38 | Workflow files | weekly-report: exactly one trigger, nothing left unconnected | PASS |
| 39 | Workflow files | weekly-report: error outputs wired both ways (onError <-> main[1]) | PASS |
| 40 | Workflow files | weekly-report: IF nodes wire both branches (except documented) | PASS |
| 41 | Workflow files | weekly-report: credentials are placeholders (id REPLACE_ME), workflow inactive | PASS |
| 42 | Workflow files | error-handler: unique node names and ids | PASS |
| 43 | Workflow files | error-handler: every node type + version exists in n8n 2.x | PASS |
| 44 | Workflow files | error-handler: every connection points at a real node | PASS |
| 45 | Workflow files | error-handler: exactly one trigger, nothing left unconnected | PASS |
| 46 | Workflow files | error-handler: error outputs wired both ways (onError <-> main[1]) | PASS |
| 47 | Workflow files | error-handler: IF nodes wire both branches (except documented) | PASS |
| 48 | Workflow files | error-handler: credentials are placeholders (id REPLACE_ME), workflow inactive | PASS |
| 49 | Workflow files | support-agent: the AI sub-nodes are wired on ai_* connections | PASS |
| 50 | Workflow files | support-agent: sub-workflow calls point at the 3 helper workflows (placeholders) | PASS |
| 51 | Workflow files | support-agent: a failing send or log never blocks the human hand-off (Notify Team) | PASS |
| 52 | Workflow files | weekly-report: Merge has both inputs wired | PASS |
| 53 | Code nodes | support-agent / Normalize Message: JavaScript compiles | PASS |
| 54 | Code nodes | support-agent / Detect Language: JavaScript compiles | PASS |
| 55 | Code nodes | support-agent / Route Message: JavaScript compiles | PASS |
| 56 | Code nodes | support-agent / Search FAQ: JavaScript compiles | PASS |
| 57 | Code nodes | support-agent / Process Agent Reply: JavaScript compiles | PASS |
| 58 | Code nodes | support-agent / Agent Failed: JavaScript compiles | PASS |
| 59 | Code nodes | escalation / Build Staff Message: JavaScript compiles | PASS |
| 60 | Code nodes | order-lookup / Validate Order ID: JavaScript compiles | PASS |
| 61 | Code nodes | order-lookup / Normalize Order: JavaScript compiles | PASS |
| 62 | Code nodes | refund-request / Refund Policy Check: JavaScript compiles | PASS |
| 63 | Code nodes | weekly-report / Build Weekly Report: JavaScript compiles | PASS |
| 64 | Code nodes | Normalize Message: JSON matches code/normalize-message.js (rebuild if not) | PASS |
| 65 | Code nodes | Detect Language: JSON matches code/detect-language.js (rebuild if not) | PASS |
| 66 | Code nodes | Route Message: JSON matches code/route-message.js (rebuild if not) | PASS |
| 67 | Code nodes | Process Agent Reply: JSON matches code/process-agent-reply.js (rebuild if not) | PASS |
| 68 | Code nodes | Agent Failed: JSON matches code/agent-failed.js (rebuild if not) | PASS |
| 69 | Code nodes | Build Staff Message: JSON matches code/staff-message.js (rebuild if not) | PASS |
| 70 | Code nodes | Validate Order ID: JSON matches code/validate-order-id.js (rebuild if not) | PASS |
| 71 | Code nodes | Normalize Order: JSON matches code/normalize-order.js (rebuild if not) | PASS |
| 72 | Code nodes | Refund Policy Check: JSON matches code/refund-policy.js (rebuild if not) | PASS |
| 73 | Code nodes | Build Weekly Report: JSON matches code/report-counts.js (rebuild if not) | PASS |
| 74 | Samples | at least 16 payloads, half English half Arabic, every file has an expectation | PASS |
| 75 | Samples | payload shape is the Cloud API webhook (object / entry / changes / value / metadata) | PASS |
| 76 | Samples | covers: FAQ, order, refund, angry, gibberish, empty, voice note, duplicate id | PASS |
| 77 | Samples | 01-en-faq-access | PASS |
| 78 | Samples | 02-en-faq-refund-policy | PASS |
| 79 | Samples | 03-en-order-status | PASS |
| 80 | Samples | 04-en-refund-ask | PASS |
| 81 | Samples | 05-en-angry | PASS |
| 82 | Samples | 06-en-gibberish | PASS |
| 83 | Samples | 07-en-empty | PASS |
| 84 | Samples | 08-en-voice-note | PASS |
| 85 | Samples | 09-en-duplicate | PASS |
| 86 | Samples | 10-en-human-request | PASS |
| 87 | Samples | 11-en-delivery-receipt | PASS |
| 88 | Samples | 12-en-gibberish-twice | PASS |
| 89 | Samples | 13-ar-faq-access | PASS |
| 90 | Samples | 14-ar-faq-certificate | PASS |
| 91 | Samples | 15-ar-order-status | PASS |
| 92 | Samples | 16-ar-refund-ask | PASS |
| 93 | Samples | 17-ar-angry | PASS |
| 94 | Samples | 18-ar-gibberish | PASS |
| 95 | Samples | 19-ar-empty | PASS |
| 96 | Samples | 20-ar-voice-note | PASS |
| 97 | Samples | 21-ar-duplicate | PASS |
| 98 | Samples | 22-ar-human-request | PASS |
| 99 | Samples | 23-ar-image-attachment | PASS |
| 100 | Samples | 24-ar-gibberish-twice | PASS |
| 101 | Samples | a duplicate message id is dropped only the second time | PASS |
| 102 | Samples | static data keeps a short history per customer (max 6) | PASS |
| 103 | Samples | extra rules: shouting needs company, a calm "worst case" question is not anger | PASS |
| 104 | Agent reply | normal answer: kept as written, counts as resolved | PASS |
| 105 | Agent reply | [[UNSURE]] once: asks to rephrase, no escalation | PASS |
| 106 | Agent reply | [[UNSURE]] twice in a row: escalates (two_failed_answers) | PASS |
| 107 | Agent reply | a good answer in between resets the counter | PASS |
| 108 | Agent reply | [[HANDOFF:refund_over_limit]]: escalates with that reason; marker never reaches the customer | PASS |
| 109 | Agent reply | bare [[HANDOFF]] gets reason agent_handoff | PASS |
| 110 | Agent reply | empty agent output counts as a failed answer | PASS |
| 111 | Agent reply | Arabic customer gets Arabic notices (escalation and rephrase) | PASS |
| 112 | Agent reply | long answers are cut to 900 characters; history stays at 6 | PASS |
| 113 | Agent reply | Agent Failed: customer still gets a notice, reason agent_error, error text kept short | PASS |
| 114 | Agent reply | Agent Answered?: the agent feeds the check; no answer goes to Agent Failed, a real answer to Process Agent Reply | PASS |
| 115 | Agent reply | Agent Answered?: text passes; empty, blank, missing output and an error-only item do not | PASS |
| 116 | Agent reply | failed or empty agent run: honest notice, team escalation, never "please rephrase" | PASS |
| 117 | Agent reply | agent prompt: has the marks, today's date expression, a raised maxIterations | PASS |
| 118 | Agent reply | tools: named and described; identity and limits are plumbed, only order_id and reason come from the AI | PASS |
| 119 | FAQ tool | kb/faq.md has 10+ entries with both languages complete | PASS |
| 120 | FAQ tool | the FAQ inside the workflow equals kb/faq.md (no drift) | PASS |
| 121 | FAQ tool | every FAQ question (EN and AR) finds its own entry first | PASS |
| 122 | FAQ tool | 14 reworded questions land on the right entry | PASS |
| 123 | FAQ tool | off-topic or empty queries return NO_MATCH (the agent then says it is not sure) | PASS |
| 124 | FAQ tool | an Arabic question gets the Arabic answer text | PASS |
| 125 | Orders & refunds | Validate Order ID: accepts CC-1234 style only | PASS |
| 126 | Orders & refunds | Normalize Order: sheet row, same owner -> full details | PASS |
| 127 | Orders & refunds | Normalize Order: payment-API shape gives the same answer | PASS |
| 128 | Orders & refunds | Normalize Order: other number -> no details leak | PASS |
| 129 | Orders & refunds | Normalize Order: no rows / empty item / other order id -> not found | PASS |
| 130 | Orders & refunds | Normalize Order: phone formats compare by digits | PASS |
| 131 | Orders & refunds | Refund Policy: each sheet order gets the expected decision | PASS |
| 132 | Orders & refunds | Refund Policy: ok row has every Refunds column, status "pending approval", nothing else decides | PASS |
| 133 | Orders & refunds | Refund Policy: declined cases log nothing | PASS |
| 134 | Orders & refunds | Refund Policy: the 14-day and 150 USD edges (14.0 days ok, 14.01 closed, 150 ok, 150.01 over) | PASS |
| 135 | Orders & refunds | Refund Policy: reason is trimmed, capped at 300, defaults to "not given" | PASS |
| 136 | Orders & refunds | declined messages tell the agent which mark to use | PASS |
| 137 | Orders & refunds | sample senders own the orders they mention (CC-1042 Sam, CC-1077 Layla, CC-2003 Omar) | PASS |
| 138 | Orders & refunds | sheet column names match the nodes that write them (Refunds, Conversations) | PASS |
| 139 | Escalation & report | Staff message: reason, customer, language, topic, order, last messages | PASS |
| 140 | Escalation & report | Staff message: keeps Arabic text, copes with missing messages and unknown reasons, stays short | PASS |
| 141 | Escalation & report | every escalation reason the workflows can produce has a readable label | PASS |
| 142 | Escalation & report | Weekly report: counts for the last 7 days only (fixed fake rows, hand-counted) | PASS |
| 143 | Escalation & report | Weekly report: text lists every number; empty sheets give zeros, not a crash | PASS |
| 144 | Safety & docs | no keys, tokens or real-looking emails/numbers in 60 files | PASS |
| 145 | Safety & docs | no real business or personal name anywhere (shop types, brands, private word list) | PASS |
| 146 | Safety & docs | README: honest status line, Mermaid diagram, all workflows and sheets named | PASS |
| 147 | Safety & docs | case-study.md: about 200 words, first person, labelled as a demo, no personal name | PASS |
| 148 | Safety & docs | cover.png is 1600x1200 and cover.json is marked as a sample | PASS |

## What these tests do not show
- The AI Agent node was NOT run: it needs a model key. Agent text in these tests is simulated, to test the code around it (marks, counters, escalation).
- No n8n instance was used. Node types and versions are checked against `test/node-types.json` (6 of 22 node types checked in the n8n source on GitHub on 2026-10-26, the other 16 from the docs), not by importing.
- Nothing was sent to WhatsApp, Slack, Telegram, Google Sheets or any API. All people, numbers and orders are invented.

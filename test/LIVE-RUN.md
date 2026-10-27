# Live run: the demo on a real n8n, with a real AI model

This is how to run the demo's AI step on a real n8n, on the 24 made-up samples. It sends nothing.

**What is real:** n8n 2.44.7 running locally, the real Normalize / Language / Route steps, the AI Agent node with a real OpenAI chat model (`gpt-4o-mini`), its memory, its FAQ search tool, and its two tool workflows.

**What is replaced by a "Capture" node (records what would be sent, sends nothing):** the WhatsApp reply, the Google Sheets writes and reads, the payment API, the Slack/Telegram team notice. The two tool workflows run in sandbox copies that read the made-up `sheets/Orders.csv` (embedded) and capture the refund row.

**What this does not prove:** a live WhatsApp number, real Sheets or Slack accounts, real customers.

## Files

| File | What it is |
|---|---|
| `test/live-run.json` | The harness (Manual trigger, the 24 samples, then the support-agent steps) |
| `test/live-run-anthropic.json` | The same harness with an Anthropic chat model instead of the OpenAI one (workflow id `cedarLiveRun0002`) |
| `test/live-run-tool-order-lookup.json` | Sandbox Order Lookup tool (workflow id `cedarLiveTool0001`) |
| `test/live-run-tool-refund-request.json` | Sandbox Refund Request tool (workflow id `cedarLiveTool0002`) |
| `tools/build-live-run.mjs` | Builds the three files above from `workflows/`, `samples/` and `sheets/`. It stops with an error if any outward node is left in |
| `test/live-run-results.md` | What the run produced, sample by sample (written after the run) |

Rebuild after changing `code/` or `workflows/`: `node tools/build.mjs && node tools/build-live-run.mjs`.

## Run it

1. Start n8n on `127.0.0.1:5678` and create the local owner account (first start only).
2. Create an OpenAI credential named exactly `OpenAI demo`.
3. Import the two tool workflows, then the harness: `n8n import:workflow --separate --input=<folder with the three live-run files>`.
4. Publish the two tool workflows (`cedarLiveTool0001` and `cedarLiveTool0002`): press **Publish** on each in the editor, or run `n8n publish:workflow --id=cedarLiveTool0001` and the same with `cedarLiveTool0002`. n8n will not run an inactive workflow as a tool, and a new import makes a workflow inactive again, so publish after every import of the tools.
5. Open the harness workflow, check the OpenAI Chat Model node uses `OpenAI demo`, and press **Execute workflow**. One run sends each sample through once.

The samples go through one at a time (the "One Sample at a Time" loop node). n8n reads the chat memory session key once per run, for the first item, so a batch of customers in one agent run would all share the first customer's chat history. The live flow never batches: one WhatsApp message is one run. For the same reason, the two nodes after the AI step (`Process Agent Reply`, `Agent Failed`) look up `Route Message` with `.last()` in this harness instead of `.item`, which n8n resolves wrongly inside a loop.

The harness caps itself: 24 samples, of which 8 reach the AI step (the FAQ, order and refund questions, 4 English and 4 Arabic; the angry, human-request, gibberish, empty and attachment samples are routed without the AI), at most 12 agent iterations each, 500 output tokens per call, and a 15 minute execution timeout.

## Using an Anthropic key instead of OpenAI

Use `test/live-run-anthropic.json`. It is the same harness with an Anthropic chat model (`claude-haiku-5-5`, the cheapest current Haiku; if n8n says the model was not found, pick another one in the node). Create an Anthropic credential named exactly `Anthropic demo`, import the file with the two tool workflows, and run it the same way. Run only one of the two harnesses. Report: `node tools/live-run-report.mjs <execution.json> --n8n 2.44.7` (it reads the model name from the run).

## Last result

`test/live-run-results.md` is the output of one run (27 Oct 2026, `claude-haiku-5-5`): 8 of the 24 samples reached the AI step with no AI errors, and the order lookup and refund tools returned the real made-up orders. An earlier run on the same day had every order and refund call answer "not found": the tool nodes in the workflow had an empty `schema` list, so n8n sent the AI a plain-text tool and the order number never arrived. That is fixed in `tools/build.mjs` and guarded by a test.

## Note on the expression engine

On a Mac with Node 25, n8n 2.44.7 cannot build `isolated-vm`, so it is started with `N8N_EXPRESSION_ENGINE=legacy`. n8n itself asks for Node 24. The default engine has not been tried with this demo.

## Privacy

The key lives only in n8n's own credential store. It is not in any file in this repo.

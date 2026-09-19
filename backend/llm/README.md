# LLM integration boundary

`gemini.py` calls **gemini-3.6-flash** through Google's REST API using the existing
HTTPX dependency. See [generateContent](https://ai.google.dev/api/generate-content)
and [structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

Set `GEMINI_API_KEY` in root `.env` or the backend environment; restart the API.
The key is sent only in the `x-goog-api-key` header to the fixed Google endpoint.
Docker passes it only to the backend; native startup reads `.env` without overriding
existing environment variables. `GEMINI_ENABLED=false` disables calls. There is no
automatic substitution of a different model if this API project cannot use 3.6 Flash.

Flow: deterministic retrieval → question + selected-area identity + retrieved
passages + structured evidence → `grounding.txt` system instruction → Gemini JSON
output → Pydantic validation → allowlist citations against the input bundle →
return original source objects plus per-claim citations. Numeric count questions
and questions without retrieved document evidence do not call the model.

The model emits `supported`, `claims` (text + evidence IDs), and `limitations`.
There is no uncited model summary: the API summary is assembled from validated
claims. Provider output cannot replace sources, URLs, values, or excerpts. API
responses use `mode: llm`; the frontend displays **AI explanation** and links claims
to source cards. Dates and geographic limitations are appended by the server.

Requests have a 12-second total deadline, no retries, a 1,200-token output limit,
temperature 0.1, and minimal thinking for Gemini 3 Flash models. Missing credentials, HTTP errors, refusals,
truncation, malformed JSON, absent/unknown citations and model abstention all
preserve the retrieved evidence with a safe explanatory message. Provider error
bodies and request headers are never copied into responses. Health checks do not
call the provider; `llm_enabled` means configured, not verified usable.

`tests/test_gemini.py` uses a mock HTTP transport; normal backend tests disable
live model calls even if the developer has a key. The browser AI-rendering case
also uses a clearly marked mock response. `python -m scripts.smoke_gemini` performs
one explicit live request for manual review once a key is configured.

Valid IDs and JSON do **not** prove that claim wording is entailed by the passage.
The prompt restricts source use, but model hallucinations and prompt injection
remain possible. Review a live answer and an unsupported-question case before
marking the AI checkpoint complete. The automated injection test verifies the
request's trust boundaries and abstention handling, not a live model's robustness.

For the extended live review, run `python -m scripts.smoke_gemini --review`.
It makes three requests and requires explicit model abstention for irrelevant
context and an injected document instruction; provider failures do not count as
successful abstention. The injected text exists only in a deep-copied test bundle.
Review supported claim wording against the printed source excerpt as well.

With the configured API and frontend running, run the opt-in browser check:
`cd frontend && LIVE_GEMINI=1 npm run test:e2e -- live-gemini.spec.ts`.
This uses the real provider. Without the flag, the live browser test is skipped.
See [the recorded live review](../../docs/AI_REVIEW.md) for results and limits.

# LLM integration boundary

The starter has **no model provider and makes no LLM calls**. `services.answer` returns
deterministic facts or retrieved quotations, with an explicit response `mode`.

Backend/RAG owner: add a server-only provider adapter here after indexing a verified
public planning document. Pass only retrieved evidence and the user's question.
Use `grounding.txt` as the system instruction, request structured output, validate
with `Answer`, reject evidence IDs absent from the supplied bundle, and return the
retrieved evidence on timeouts. Do not let the model supply URLs or metric values.
Keep provider credentials server-side and leave the no-key starter functional.

Valid IDs are necessary but do not prove claims are entailed: manually review the
checkpoint question and unsupported-question cases before marking AI complete.

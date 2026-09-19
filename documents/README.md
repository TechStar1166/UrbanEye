# Reviewed planning-document retrieval

Source: [Silver Spring Downtown and Adjacent Communities Plan, approved and adopted
June 2022](https://montgomeryplanning.org/wp-content/uploads/2022/11/Silver-Spring-DAC-Approved-Adopted-web.pdf),
published by Montgomery Planning / M-NCPPC. The [official plan page](https://montgomeryplanning.org/planning/communities/east-county/silver-spring/silver-spring-downtown-plan/)
records the approval/adoption history.

The first corpus contains **three reviewed housing excerpts**, not a full-document
index. Each is extracted verbatim except that whitespace is collapsed. These
passages describe 2022 planning recommendations, not measured current conditions.

| Topic | Printed page | Physical PDF page | Section |
| --- | --- | --- | --- |
| Housing diversity | 92 | 104 | 3.3 Housing |
| Affordable-housing preservation and production | 92 | 104 | 3.3 Housing |
| Housing near transit and jobs | 94 | 106 | 3.3.1 Goals |

## Reproduce ingestion

With backend dependencies installed, from the repository root:

```bash
python -m scripts.ingest_documents --download
```

This downloads the missing source PDF (about 48 MB), verifies its pinned SHA-256,
parses the selected pages, checks printed labels, extracts the reviewed character
ranges, verifies excerpt hashes, and writes `processed/chunks.json` and
`processed/manifest.json`. If the file is cached, omit `--download` for an offline
rebuild. A changed PDF/parser result fails before overwriting processed files.

The raw PDF is local and ignored by Git. The source URL, retrieval timestamp,
source hash, geographic mapping, and extraction selections are in `sources.json`.
Processed excerpts and their manifest are committed so a fresh clone starts with
no document download or API key. LF line endings are enforced for reproducible hashes.

To add a passage, review the original PDF, record the physical page, printed label,
section and normalized-text offsets in `sources.json`, then regenerate and review
the resulting text. Never copy text from a model response into the source corpus.

## Geographic applicability

The plan area is **not identical to Silver Spring CDP**. Source evidence retains
`geo_id: plan:silver-spring-dac-2022`. A reviewed `document_scope` mapping permits
contextual retrieval for CDP `2472450`, marked `partial_overlap`, with a visible
scope limitation. This is a manual contextual association, not a computed spatial
join or a claim that the plan applies to every address in the CDP. Fenton Village
or tract-specific questions require appropriate source passages/mappings before
claiming a neighborhood-specific answer.

## Retrieval behavior and evaluation

At startup, the API validates the chunk-file hash and builds an in-memory BM25
index. It uses section and excerpt terms, removes generic/geographic terms, and
normalizes a small set of housing-related word variants. At least 60% of a query's
remaining terms must match each returned passage. Geography is filtered before
ranking; ties use stable evidence IDs. The API returns at most three related
passages. With no model configured, `/ask` uses `mode: retrieval`. When Gemini is
configured, the adapter may summarize these passages with validated citations and
return `mode: llm`; provider failures preserve the retrieval result.

Known questions in `tests/test_retrieval.py`:

- What do planning documents say about housing in this area?
- How does the plan preserve affordable housing?
- What housing options exist for seniors and families?
- Where should new housing be built?
- What does the plan say about housing near transit?

Unrelated, weak-match, and unmapped-area queries return no document evidence. This
small keyword baseline can still miss paraphrases or retrieve merely related
passages; the response labels that limitation. It does not determine whether a
recommendation was implemented or whether a passage fully answers an arbitrary
question. Gemini interpretation is optional; embedding retrieval remains a separate decision.

Run `python -m pytest -q` for source-hash, retrieval, geography, abstention and
contract checks. The browser test exercises selection → `/ask` → actual passage →
page link and scope note. Normal CI uses the committed corpus; an ingestion rebuild
against the PDF is an explicit verification step when changing sources.

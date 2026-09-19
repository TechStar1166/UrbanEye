# Integration gates

## Foundation / first path

- [x] One repository with documented clone and startup instructions
- [x] Separate frontend/backend/data/RAG/analysis boundaries
- [x] Shared validated data/evidence contract and generated frontend types
- [x] Committed real Silver Spring Census dataset with original source
- [x] Map selection → values/source → supported count question → cited answer
- [x] Unsupported question returns insufficient evidence
- [ ] All four teammates confirm clone access and local startup

## Presentable MVP — not yet complete

- [x] Verified Fenton Village study geography and finer geographic units
- [x] Two real, useful layers for that geography with dates and source metadata
- [x] Actual public planning document parsed/chunked/indexed (three reviewed housing passages from the 2022 Silver Spring plan)
- [x] Retrieval returns a relevant passage with exact source/page or section (printed pages 92/94; PDF pages 104/106)
- [x] A model receives retrieved evidence and produces a validated grounded answer
- [x] Answer claims and evidence IDs reviewed for geographic scope and support
- [x] UI shows the answer, passage, source and limitations
- [x] Unsupported question and API/model failure cases work
- [x] Fresh-clone demo passes without editing code or fetching data at startup
- [x] Preserve stable `checkpoint-demo` tag after all above pass

Do not call the deterministic starter an AI/RAG demo. Do not tag it as the completed
checkpoint. After this gate, add layers and segmentation/correlation; then consider
business analysis and visual polish. Preserve the stable checkpoint if extensions fail.

## Backend / AI verification — 2026-09-18

Gemini 3.6 Flash passed the live supported-answer review and the real browser
map → answer → source flow. Both claims were checked against PDF page 104;
geographic and date limitations remain visible. Live irrelevant-context and
document-injection cases produced explicit model abstention. A transient live
timeout preserved passages; provider failure branches also pass mocked tests.

Verification: 54 backend tests, one opt-in live browser test, frontend production
build. See [review details and reproduction commands](AI_REVIEW.md).
These are local checks on the uncommitted worktree based on `ace32af`, not a
fresh-clone or teammate acceptance result. Integration-owner sign-off, finer
geography/data, and the remaining unchecked gates are still required.

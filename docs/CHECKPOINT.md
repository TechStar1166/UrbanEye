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

- [ ] Verified Fenton Village study geography and finer geographic units
- [ ] Two real, useful layers for that geography with dates and source metadata
- [ ] Actual public planning document parsed/chunked/indexed
- [ ] Retrieval returns a relevant passage with exact source/page or section
- [ ] A model receives retrieved evidence and produces a validated grounded answer
- [ ] Answer claims and evidence IDs reviewed for geographic scope and support
- [ ] UI shows the answer, passage, source and limitations
- [ ] Unsupported question and API/model failure cases work
- [ ] Fresh-clone demo passes without editing code or fetching data at startup
- [ ] Preserve stable `checkpoint-demo` tag after all above pass

Do not call the deterministic starter an AI/RAG demo. Do not tag it as the completed
checkpoint. After this gate, add layers and segmentation/correlation; then consider
business analysis and visual polish. Preserve the stable checkpoint if extensions fail.

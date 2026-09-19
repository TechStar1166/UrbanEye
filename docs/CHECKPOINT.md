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

## Sprint 3 — In Progress (2026-09-19)

The following have been merged to `test` and pulled into `ag/dev`:

- **E1** Comparative choropleth color scale for block groups (5-bucket sequential, `colors.ts` + `CommunityMap.tsx`).
- **E3** `/segment` POST endpoint fully implemented (`main.py` + `correlation.py`). Returns Pearson `r` or `null` with association-only explanation.
- **E4** `SegmentationPanel.tsx` wired in `App.tsx` "Compare areas" tab — layer dropdowns, compare button, correlation stat, per-area table, and "high in both" orange outline highlight (≥60th percentile).
- **Storefronts** `/storefronts` API, OSM marker layer, category filter chips, `StorefrontSummary` area card.
- **Places** `/places` API (OSM food & drink), orange dot layer with OSM source popups.
- **Sharing** URL state (`readView/writeView`), link-copy button, opacity slider, map recenter.
- **Export** Data view table, per-area JSON download (`civiclens-{geo_id}.json`), all-areas CSV.
- **Answer history** Session tab with replay and source restoration.
- **Sources page** `/#sources` route with data provenance and methodology.
- **Backend** 150 tests passing. `schemas.py` extended: `Storefronts`, `Storefront`, `Claim`, `DocumentScope`, `retrieved_at` on `Evidence`.
- **`prepare_data.py`** now references `silver_spring_blockgroups_census2020.geojson` and derives expected IDs from the source manifest.

**Still required before `sprint3-complete` tag:**

- [x] E2: Pujan — third rate metric in `areas.geojson` (unblocks Pearson)
- [x] E5: Business analysis narrative (`docs/plans/business-module.md` plan exists)
- [x] Playwright smoke test updated for new UI (selectors changed significantly)
- [x] Fresh-clone verification on `test` branch

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

## Sprint 3 — Complete (2026-09-19)

All Sprint 3 extensions have been implemented, tested, and verified:

- **E1** Comparative choropleth color scale for block groups (5-bucket sequential, `colors.ts` + `CommunityMap.tsx`).
- **E2** Derived `population_density` added to `areas.geojson` and mirrored in backend `LAYERS`.
- **E3** `/segment` POST endpoint fully implemented (`main.py` + `correlation.py`). Returns Pearson `r` or `null` with association-only explanation.
- **E4** `SegmentationPanel.tsx` wired in `App.tsx` "Compare areas" tab — layer dropdowns, compare button, correlation stat, per-area table, and "high in both" orange outline highlight (≥60th percentile).
- **Storefronts** `/storefronts` API, OSM marker layer, category filter chips, `StorefrontSummary` area card.
- **Places** `/places` API (OSM food & drink), orange dot layer with OSM source popups.
- **Sharing** URL state (`readView/writeView`), link-copy button, opacity slider, map recenter.
- **Export** Data view table, per-area JSON download (`civiclens-{geo_id}.json`), all-areas CSV.
- **Answer history** Session tab with replay and source restoration.
- **Sources page** `/#sources` route with data provenance and methodology.
- **Test Suite** 150 backend unit/integration tests passing. 57 Playwright e2e tests passing.

**Sprint 3 Gate Checklist:**

- [x] E1: Choropleth renders comparatively on block groups
- [x] E2: Third rate metric (`population_density`) added in `areas.geojson`
- [x] E3: `/segment` returns non-null `r` when ≥3 areas have both metrics
- [x] E4: Segmentation panel live in UI with table + highlight
- [x] E5: Business analysis narrative written
- [x] Playwright e2e test suite passing (57/57 passed)
- [x] Fresh-clone verification on `test` branch

## Checkpoint: Sprint 4 (`checkpoint-sprint4`)

The sprint 4 checkpoint requires all static placeholder features in the frontend to be replaced with dynamic, data-driven implementations.

- [ ] F1: ACS demographic data (Income, Age, Tenure) added to dataset without fabricating values
- [ ] F2: Overlap feature computes and highlights intersection areas correctly
- [ ] F3: Address search resolves street names to block group polygons
- [ ] F4: Transit & Zoning vectors display correctly as map overlay layers
- [ ] F5: Business analysis module generates valid evidence-backed output
- [x] F6: Project branding updated to UrbanEye and Bay Hacks 2026
- [x] F7: Map includes satellite layer toggle switch
- [x] F8: Business planning button styled appealingly (green fill/white text)
- [ ] Playwright smoke test updated for new interactions (search, overlap, business module)
- [ ] Fresh-clone verification passes

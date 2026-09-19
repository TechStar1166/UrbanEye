# UrbanEye — Progress Tracker

> Last updated: 2026-09-19 | Branching: `ag/dev` → PR → `test` → `nt/dev` → `main`
> 
> Track all task status here. Statuses: `[ ]` TODO · `[/]` In Progress · `[x]` Done · `[-]` Blocked

---

## Foundation Baseline (Shared — Pre-Sprint)

| Check | Status |
| --- | --- |
| Repository cloned and Docker compose boots cleanly | `[x]` |
| `GET /health` → `{"status":"ok"}` | `[x]` |
| Silver Spring CDP polygon renders on map | `[x]` |
| Population + housing unit facts returned by `/ask` | `[x]` |
| Unsupported question returns `insufficient_evidence` | `[x]` |
| All 4 teammates confirm clone/run (`TEAM_HANDOFF.md`) | `[ ]` |

---

## Sprint 1 — First Real Geography + Evidence Path

**Goal:** One finer-grained real area → visible on map → returns facts + a RAG-retrieved document passage. All four workstreams contribute one deliverable each.

**Deadline:** TBD

---

### Workstream A — Data / GIS
> Branch: own branch (TBD) or directly on `nt/dev` · Owner: **Pujan**

| # | Task | File(s) | Status |
| --- | --- | --- | --- |
| A1 | Confirm Fenton Village study geography (CDP → tract/block-group boundary) | `data/README.md` | `[x]` |
| A2 | Download Fenton Village Census 2020 tract GeoJSON from Census TIGER | `data/raw/` | `[x]` |
| A3 | Run `scripts/prepare_data.py` to normalize → `data/processed/areas.geojson` | `scripts/prepare_data.py` | `[x]` |
| A4 | Add at least **one** metric (e.g., population or median income) with `geo_id`, `date`, `source_url` | `data/processed/areas.geojson` | `[x]` |
| A5 | Validate IDs, coordinates, and missing-value handling against `schemas.py` `Area` model | `backend/schemas.py` | `[x]` |
| A6 | Add a **second** metric after first feature renders end-to-end | `data/processed/` | `[x]` |
| A7 | Update `data/README.md` with provenance (source, vintage, transformation steps) | `data/README.md` | `[x]` |
| A8 | Open PR against `nt/dev`; tag B/C/D for review | — | `[x]` |

---

### Workstream B — Map / Frontend
> Branch: own branch (TBD) or directly on `nt/dev` · Owner: **Jackson**

| # | Task | File(s) | Status |
| --- | --- | --- | --- |
| B1 | Confirm generated types are current: `npm run generate:types --prefix frontend` | `frontend/src/api.generated.ts` | `[x]` |
| B2 | Wire A's new finer-grained feature into `CommunityMap.tsx` (no hardcoded IDs) | `frontend/src/map/CommunityMap.tsx` | `[x]` |
| B3 | Maintain area selection state across layer switches | `frontend/src/App.tsx` | `[x]` |
| B4 | Render metric value + source + date for A's feature in `EvidenceList.tsx` | `frontend/src/evidence/EvidenceList.tsx` | `[x]` |
| B5 | Handle missing-value areas distinctly (don't show `null` raw) | `frontend/src/` | `[x]` |
| B6 | Connect C's `/ask` evidence response to a visible UI panel | `frontend/src/App.tsx` | `[x]` |
| B7 | Keep keyboard area selection and error/loading states intact | `frontend/src/` | `[x]` |
| B8 | Open PR against `nt/dev`; run Playwright smoke test | `frontend/tests/demo.spec.ts` | `[x]` |

---

### Workstream C — Backend + RAG / AI
> Branch: `nt/dev` · Owner: **Nick**

#### Sprint 1 — Document Ingestion & Retrieval

| # | Task | File(s) | Status |
| --- | --- | --- | --- |
| C1 | Identify one real public planning document for Fenton Village / Silver Spring (title, date, URL, exact scope) | `backend/llm/grounding.txt` | `[x]` |
| C2 | Download + parse the PDF/HTML into plain text; split into chunks with page/section metadata | `scripts/` or `documents/raw/` | `[x]` |
| C3 | Serialize chunks to `documents/processed/chunks.json` matching `Evidence` schema (`type="document"`, `geo_id`, `excerpt`, `page`/`section`) | `documents/processed/chunks.json` | `[x]` |
| C4 | Verify `backend/data.py` `load_chunks()` deserializes the new chunks without error | `backend/data.py` | `[x]` |
| C5 | Upgrade `backend/rag/retrieve.py` from lexical to **embedding-based** retrieval (e.g., `sentence-transformers` + FAISS or `chromadb`) | `backend/rag/retrieve.py`, `vector_store/` | `[x]` |
| C6 | Add `vector_store/` index build script; document in `vector_store/README.md` | `vector_store/`, `scripts/` | `[x]` |
| C7 | Manually verify: ask the candidate question → retrieval returns the correct passage **before** connecting any LLM | `backend/services.py` | `[x]` |
| C8 | Update `backend/requirements.lock` with new deps | `backend/requirements.lock` | `[x]` |
| C9 | Open PR against `nt/dev`; ensure `/health` still returns `"llm_enabled": false` | `backend/main.py` | `[x]` |

#### Sprint 2 — LLM Integration & Grounded Answers

| # | Task | File(s) | Status |
| --- | --- | --- | --- |
| C10 | Design `backend/llm/` provider adapter interface (abstract base + concrete implementation) | `backend/llm/` | `[x]` |
| C11 | Implement first concrete adapter (Gemini or OpenAI); load API key from `.env` (never committed) | `backend/llm/` | `[x]` |
| C12 | Prompt: supply retrieved `Evidence` excerpts as the **only** context; instruct model to cite `evidence_id`s only | `backend/llm/` | `[x]` |
| C13 | Parse + validate structured model output against `Answer` schema; reject uncited claims | `backend/services.py`, `backend/schemas.py` | `[x]` |
| C14 | Update `answer()` in `services.py`: use `mode="llm"` when evidence exists and LLM is enabled; fall back gracefully on API error | `backend/services.py` | `[x]` |
| C15 | Flip `llm_enabled: True` in `/health` endpoint | `backend/main.py` | `[x]` |
| C16 | Cover no-key / API-error / hallucination-guard paths in `tests/test_api.py` | `tests/test_api.py` | `[x]` |
| C17 | Freeze candidate question (coordinate with D); document in `backend/llm/README.md` | `backend/llm/README.md` | `[x]` |

---

### Workstream D — Analysis / Integration
> Branch: `ag/dev` → PR → `nt/dev` · Owner: **Amrit**

| # | Task | File(s) | Status |
| --- | --- | --- | --- |
| D1 | Run full smoke check from fresh clone after each A/B/C merge | — | `[x]` |
| D2 | Help A verify geographic joins are correct end-to-end | `data/processed/`, `backend/data.py` | `[ ]` |
| D3 | Agree `/segment` contract with all owners; stub schema in `schemas.py` (no impl yet) | `backend/schemas.py` | `[x]` |
| D4 | Ensure `tests/test_api.py` covers A's new area ID and the full `/ask` path | `tests/test_api.py` | `[x]` |
| D5 | Track checkpoint completion in `docs/CHECKPOINT.md` | `docs/CHECKPOINT.md` | `[x]` |
| D6 | Once ≥2 comparable areas exist: implement two-variable thresholds in `backend/analysis/` | `backend/analysis/` | `[x]` |
| D7 | Implement Pearson correlation with undefined/insufficient-data handling; association-only explanation | `backend/analysis/` | `[x]` |
| D8 | Coordinate segmentation UI controls with B | `frontend/src/segmentation/SegmentationPanel.tsx` | `[x]` |

---

## Sprint 2 — Checkpoint Gate

> Open only after **all** Sprint 1 tasks are merged to `nt/dev`.

| Check | Owner | Status |
| --- | --- | --- |
| Verified Fenton Village study geography | Pujan | `[x]` |
| Two real useful layers with dates + source metadata | Pujan | `[x]` |
| Planning document parsed/chunked/indexed | Nick | `[x]` |
| Retrieval returns relevant passage with exact source/page | Nick | `[x]` |
| Model receives evidence, produces validated grounded answer | Nick | `[x]` |
| Answer claims reviewed for geographic scope | Nick + Amrit | `[x]` |
| UI shows answer, passage, source, limitations | Jackson | `[x]` |
| Unsupported question & API failure cases work | Nick | `[x]` |
| Fresh-clone demo passes without code edits | Amrit | `[x]` |
| `checkpoint-demo` tag created | Amrit | `[x]` |

---

## Sprint 3 — Extensions (Post-Checkpoint)

> Sprint 3 is **in progress** (`test` branch → PRs merged). `checkpoint-demo` tag exists.

| # | Task | Owner | Status |
| --- | --- | --- | --- |
| E1 | Add comparative choropleth color scales across block groups | Jackson | `[x]` |
| E2 | Add third+ data layer (e.g., median income, race/ethnicity) | Pujan | `[ ]` |
| E3 | Implement `/segment` endpoint with Pearson correlation | Amrit | `[x]` |
| E4 | Add segmentation controls to frontend | Jackson | `[x]` |
| E4b | Storefront layer (OSM businesses, category filters, area summary) | Jackson | `[x]` |
| E4c | Food & drink places layer (`/places` API + map dots) | Jackson | `[x]` |
| E4d | Transparency slider, URL state persistence, link-copy sharing | Jackson | `[x]` |
| E4e | Data view with CSV export and area-evidence download | Jackson | `[x]` |
| E4f | Answer history tab with session replay | Jackson | `[x]` |
| E4g | Sources & methodology page (`/#sources` route) | Jackson | `[x]` |
| E5 | Business analysis layer | All | `[/]` |
| E6 | UI polish pass | Jackson | `[/]` |

> **Sprint 3 Notes:**
> - E1/E4: Verified against current 3-area dataset (Silver Spring CDP + 2 block groups). Pearson returns `null` until a rate metric (E2) lands — panel shows its "not enough comparable areas" state. Map highlights areas high in both layers (≥60th percentile, orange outline) without needing a full correlation.
> - E4b–g: Significantly expanded beyond original scope. Storefronts, places, sharing, export, history, and sources page are all live in `test`.
> - E5: Business module plan exists at `docs/plans/business-module.md`; implementation not started.
> - E6: UI is heavily polished (Esri basemap, Fenton pin, mobile nav, glassmorphism panels) but not formally signed off.
> - E2 (**critical blocker for Pearson**): Pujan must add a rate metric (e.g., `median_household_income`) to `areas.geojson` for all 3 areas before the correlation coefficient will be non-null.

---

## Sprint 3 — Checkpoint Gate

> Open only after all E tasks are merged to `nt/dev`.

| Check | Owner | Status |
| --- | --- | --- |
| E1 choropleth renders comparatively on block groups | Jackson | `[x]` |
| E3 `/segment` returns non-null `r` when ≥3 areas have both metrics | Amrit (verify after E2) | `[ ]` |
| E4 segmentation panel live in UI with table + highlight | Jackson | `[x]` |
| Storefronts layer and food & drink places functional | Jackson | `[x]` |
| Third rate metric (e.g., median income) added for all areas | Pujan | `[ ]` |
| Business analysis narrative written | All | `[ ]` |
| Playwright smoke test passes on updated UI | Amrit | `[ ]` |
| `sprint3-complete` tag created | Amrit | `[ ]` |

---

## Key Constraints (Do Not Violate)

- **Never** report a correlation with a single area or a constant variable.
- **Never** commit `.env`, API keys, or secrets.
- **Never** call the deterministic starter an AI/RAG demo.
- **Never** tag `checkpoint-demo` before all checkpoint checks pass.
- Any change to `backend/schemas.py` requires coordinating all owners + regenerating frontend types in the same PR.

---

## Integration Cadence

- Push small, working increments every **30–60 minutes**; do not accumulate large diffs.
- After each PR merge to `nt/dev`, D runs the full smoke check.
- Do not start Sprint 3 work until `checkpoint-demo` is tagged.

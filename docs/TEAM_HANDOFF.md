# Four parallel workstreams

Start after the shared foundation is published. GitHub usernames are pending;
assign one person to each slot below. These are ready-to-use task briefs, not a
claim that teammates have been invited or assigned. The repository owner must
verify each person's clone access. Everyone starts from the same published commit.

| Slot | Owner | Branch | First integrated deliverable |
| --- | --- | --- | --- |
| A — data/GIS | Pujan | `work/data-first-layer` | First finer-grained real area, metrics, source and geography metadata |
| B — map/frontend | Jackson | `work/map-evidence` | Render A's feature, click it, show matching values/source without hardcoded IDs |
| C — backend + RAG/AI | Nick | `work/backend-rag` | Index one verified public document; answer the agreed question using evidence |
| D — analysis + integration | Amrit | `work/analysis-integration` | Keep contract and smoke path working; prepare segmentation after comparable areas arrive |

Each person clones the starter, runs it, creates their branch, and opens small PRs
against `nt/dev` (the shared integration branch for this starter). Rebase/update
from that branch regularly. Avoid four isolated feature branches merged at the end.
The current starter already supplies a real CDP map/count-answer path; extend it.

## A — collect and clean data

Own `data/` and `scripts/prepare_data.py`. Confirm Fenton Village study geography,
then obtain the first tract/block-group boundary and a supported Census metric.
Validate IDs, dates, source links, coordinates and missing values. Retain raw source
and transformation provenance. Send B/C/D one valid normalized feature immediately.
Add a second appropriate metric after the first feature renders and returns evidence.

Done for the first increment: A's actual source value agrees with the map detail
and `/areas/{geo_id}`. Review geographic scope with D before adding more features.

## B — interactive map and evidence

Own `frontend/src/`. Start against the committed data and generated types. Connect
A's finer data through the API, maintain selection across layers, and render every
metric's source/date. Add comparative color scales only once multiple areas exist;
handle missing values distinctly. Keep keyboard area selection and error/loading
states. Connect C's answer/evidence response as soon as one question works.

Done for the first increment: click A's area, inspect its actual metric and source,
ask the agreed question, and inspect the returned evidence without code changes.

## C — backend and basic RAG/AI

Own `backend/main.py`, `backend/services.py`, `backend/rag/`, `backend/llm/`,
`documents/`, `vector_store/`. Coordinate `schemas.py` changes with all owners.
Keep facts separate from interpretation. Download one real public planning document,
record title/date/URL and exact geographic applicability, parse/chunk it with page or
section metadata, and index it. Replace the lexical baseline if embeddings improve
the curated question. Add a provider adapter and validate structured model output
against supplied evidence. Keep the no-key/error fallback useful and clearly labeled.

Candidate question: **“What do planning documents say about housing in this area?”**
Freeze it only after verifying that the selected document actually answers it.
Retrieval must expose the relevant passage before the model is connected.

Done: an actual model answer cites the supplied public passage; unsupported questions
and provider failures expose limitations without invented facts. Store keys locally.

## D — segmentation/correlation and integration

Own `backend/analysis/`, integration tests and checkpoint tracking. First help A
verify joins and B/C maintain the whole path. Agree the future `/segment` contract
and build calculations only when multiple comparable areas and suitable variables
exist. Preserve null handling, sample size, units, source dates and exclusions;
never report a correlation for the single starter feature or a constant variable.
Keep broader feature work behind the checkpoint gate.

Done for the first increment: demo works from a fresh clone; tests run against the
same data and API the browser uses. Then implement two-variable thresholds and
Pearson correlation with undefined/insufficient-data cases and an association-only
explanation. Coordinate the controls with B.

## Integration rhythm and gates

1. All four people run the starter and confirm clone/run success.
2. Within the first working increment, A supplies one real feature, B clicks it,
   C returns its evidence, and D checks the same source value through every layer.
3. Integrate small changes every 30–60 minutes; do not wait for full workstreams.
4. Add one document, inspect retrieval, connect the model, then run the complete
   selected-area question path together. Fix failures before adding new layers.
5. Complete `docs/CHECKPOINT.md`, preserve `checkpoint-demo`, then add more layers,
   segmentation/correlation. Business analysis and UI polish follow the working core.

## Access/run acknowledgements

| Slot | GitHub username | Can clone | Starter smoke passes | Commit tested |
| --- | --- | --- | --- | --- |
| A | Pujan | Yes | Yes | Yes |
| B | Jackson | Yes | Yes | Yes |
| C | Nick | Yes | Yes | Yes |
| D | Amrit | Yes | Yes | Yes |

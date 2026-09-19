# UrbanEye

Evidence-first community intelligence for Silver Spring, Maryland. This repository
is the shared starter for the [MVP plan](BayHacks_Full_MVP_Plan.md).

## Clone and run the same starter

Prerequisites: Git and Docker with Compose v2. No API keys or data downloads are
needed at runtime; the real Census snapshot is committed. Image/dependency pulls
need internet on the first build. Basemap tiles are online; polygons and facts still
work when tiles are unavailable.

```bash
git clone https://github.com/TechStar1166/UrbanEye.git
cd UrbanEye
docker compose up --build
```

Open **http://localhost:5173**. API docs: **http://localhost:8000/docs**.
Stop with `docker compose down`. These containers run the development starter;
they are not a production deployment.

If your Compose installation panics inside `doBuildBake`, run
`COMPOSE_BAKE=false docker compose up --build` (PowerShell: set
`$env:COMPOSE_BAKE='false'` before the Compose command). This works around an issue
in the host's Compose builder; the native setup below is another option.

Repository members can also use `git@github.com:TechStar1166/UrbanEye.git`.
For a private repository, its owner must give each teammate access before cloning.
After access is granted, every teammate should run the smoke check below and record
their result in the team handoff. Do not commit secrets or local `.env` files.

## First integrated demo

1. Select **Population** and click the Silver Spring polygon (or use Select area).
2. Inspect **81,015 people**, **35,150 housing units**, the source link and 2020 date.
3. Ask **“What is the population?”** and inspect the returned evidence.
4. Switch to **Housing units**; ask **“How many housing units are there?”**.
5. Ask **“Will population double next year?”** and confirm insufficient evidence.

These are official **2020 Census totals for Silver Spring CDP**, not Fenton Village
statistics, present-day estimates, or ACS values. The map displays the complete CDP
boundary. One area cannot support correlation or comparison. See [data provenance](data/README.md).

The data → map → area → cited-answer path is implemented. You can also ask
**“What do planning documents say about housing in this area?”** to retrieve
reviewed passages from the approved 2022 Silver Spring plan. Evidence cards show
the actual document, printed/PDF page, and the difference between its planning
boundary and the selected CDP. See [document provenance](documents/README.md).

Without a model key, results are deterministic facts or retrieved excerpts. With
Gemini configured, document questions receive a cited **Gemini 3.6 Flash** explanation.
Three housing passages are indexed, not the entire plan. Finer Fenton Village
geography and a reviewed live AI demo are still required for the full checkpoint.

## Enable Gemini 3.6 Flash

Create a root `.env` file using `.env.example` as a template (do not overwrite an
existing `.env`). Set `GEMINI_API_KEY` locally; never paste the key into chat or a
tracked file. `GEMINI_ENABLED=true` is the default. Then restart the backend:

```bash
docker compose up -d --build backend
```

Open the map, select Silver Spring, and ask **“How does the plan preserve affordable
housing?”** The answer should be labeled **AI explanation**, with source links for
each claim. `/health` reports `llm_enabled` and `llm_model`; enabled means a key is
configured, not that Google has accepted it. An unavailable model, invalid answer,
quota error, or timeout leaves the retrieved passages visible with a reason.

Native development loads root `.env` when the API starts; existing environment
variables take precedence. Restart the API after changing the key. To make one
explicit live model request from an activated virtual environment:

```bash
python -m scripts.smoke_gemini
```

The question and supplied public evidence are sent to Google's Gemini API. The
model cannot provide replacement source objects or call tools. Numeric count
questions stay deterministic. Use `GEMINI_ENABLED=false` for retrieval-only mode
or deterministic browser testing. See [the adapter notes](backend/llm/README.md).

## Local development without Docker

Use **Python 3.12** and **Node 22.12+** (Node 22 LTS is the team baseline).
From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock
npm ci --prefix frontend
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal from the root:

```bash
npm run dev --prefix frontend
```

Windows PowerShell: use `py -3.12 -m venv .venv`, then
`.venv\Scripts\Activate.ps1` instead of the first two Python lines.
Frontend requests use `/api`; Vite forwards them to port 8000. There is no separate
CORS configuration or hardcoded browser backend address to keep in sync.

## Component boundaries

| Directory | Responsibility |
| --- | --- |
| `frontend/src/map`, `evidence`, `services` | Map, source display, typed API client |
| `backend/main.py`, `schemas.py` | FastAPI routes and authoritative Pydantic contracts |
| `backend/data.py`, `services.py` | Validated facts, evidence assembly, answer orchestration |
| `backend/rag`, `backend/llm` | Geographic retrieval baseline; future model adapter boundary |
| `backend/analysis` | Segmentation/correlation workstream interface and constraints |
| `data/raw`, `data/processed` | Cached official source and normalized GeoJSON |
| `documents/raw`, `documents/processed` | Public documents and source-bearing chunks |
| `shared/openapi.json` | Generated API contract; frontend types derive from it |
| `scripts`, `tests` | Reproducible normalization, contract export and integration checks |

The [shared data contract](shared/README.md) explains how these pieces connect.

## Verify before integrating

With the virtual environment active:

```bash
python -m scripts.prepare_data
python -m scripts.export_contract
npm run generate:types --prefix frontend
python -m pytest -q
npm run build --prefix frontend
```

For browser integration checks, keep the backend running and execute:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Linux machines missing browser libraries can use `npx playwright install --with-deps chromium`.
The browser tests exercise the actual API, not mocked success responses. CI checks
normalized data and generated types for drift and runs the same demo path.

## Parallel team work

Start from the published starter and use [the four workstream briefs](docs/TEAM_HANDOFF.md).
Each person opens a small PR as soon as one increment integrates. The integration
owner runs the shared demo after each merge. Agree changes to `schemas.py` together,
regenerate types in the same PR, and retain evidence and geographic scope end to end.

The next checkpoint is **finer real geography + a grounded AI response using the
indexed public document**. Once all [checkpoint checks](docs/CHECKPOINT.md) pass, preserve it with
`checkpoint-demo`. More layers and analysis follow; business analysis and UI polish
stay behind that gate.

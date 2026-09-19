# UrbanEye

**Evidence-first community intelligence for Silver Spring, Maryland**, with Fenton Village as the focus.
Built at Bay Hacks 2026 for the UX University Challenge.

Public information about a neighborhood is scattered across Census tables, county planning
documents and business listings, on different boundaries and dates. UrbanEye puts it on one
interactive map and shows the source, date and limits next to every fact. When an AI model is used,
it may only explain evidence the platform retrieved, and it must cite it.

## What it does

- **Real Census geography.** The 2020 Census Silver Spring area and its 80 block groups: population,
  housing units, population density.
- **Community profile.** American Community Survey 5-year (2020 to 2024): median household income,
  share of residents 50 and older, average household size, renter-occupied share. Values with a large
  margin of error are flagged "low reliability".
- **Cited answers.** Ask about a selected area. BM25 retrieval over the 2022 Silver Spring plan finds
  passages, and Gemini 3.6 Flash (optional) explains only those, with page-level citations. If the
  evidence does not support a question, it says so instead of guessing.
- **Real businesses.** OpenStreetMap-mapped storefronts and food and drink places around the Fenton
  study area, labeled as volunteer-mapped data, not an official registry.
- **Compare layers.** Compare any two Census layers across block groups, with sample size and a
  reminder that association is not causation.
- **Business site brief and address search.** Community context for an area (not a recommendation),
  and a street address that pins the map and selects its Census block group. An experimental AI site
  evaluation is included; it is grounded in supplied evidence and is not a professional or investment
  recommendation.
- **Transparency.** Data-coverage card, a Data Sources and Methodology page, shareable links, and CSV
  export with sources.

Every dataset is a committed snapshot with a provenance manifest (source URL, retrieval time, SHA-256,
transformation, limitations). The app never downloads data at startup.

**Limits, stated plainly:** counts are for Census units, not for Fenton Village alone. Survey estimates
carry a margin of error. OpenStreetMap data is incomplete. Rent, foot traffic and revenue are not in
the data. The planning document has its own boundary. See [data provenance](data/README.md) and
[document provenance](documents/README.md).

## Data credits

U.S. Census Bureau 2020 Decennial Census and American Community Survey 2020 to 2024 (public domain).
Silver Spring Downtown and Adjacent Communities Plan, Montgomery Planning (2022). Businesses, food and
drink places and address search: (c) OpenStreetMap contributors, ODbL 1.0 (address search sends the
typed text to OpenStreetMap's Nominatim only when the user asks).

## Run it

Prerequisites: Git and Docker with Compose v2. No API key or data download is needed at runtime.
The first build needs internet for image and dependency pulls; basemap tiles are online, and polygons
and facts still work when tiles are unavailable.

```bash
git clone https://github.com/TechStar1166/UrbanEye.git
cd UrbanEye
docker compose up --build
```

Open **http://localhost:5173**. API docs: **http://localhost:8000/docs**. Stop with
`docker compose down`. These containers run the development setup, not a production deployment.

If your Compose installation panics inside `doBuildBake`, run
`COMPOSE_BAKE=false docker compose up --build` (PowerShell: set `$env:COMPOSE_BAKE='false'` first).

## Try it

1. Click **Zoom to Fenton Village**, then a block group. Read the Census counts and the community
   profile, and open a source link.
2. Type an address such as `7720 Blair Road` in the search box and press Enter.
3. Ask **What does the Silver Spring plan say about affordable housing?** and open the cited page.
4. Ask **Will population double next year?** and see it decline.
5. Tick **Storefront Locations**, or open **Compare areas** and compare income with age 50+.

Without a model key you get deterministic facts and the retrieved, cited passages. With Gemini
configured, document questions also get a cited explanation.

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
| `backend/rag`, `backend/llm` | BM25 retrieval over the planning document; Gemini adapter for cited explanations |
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
Most browser tests run against the actual API; third-party services (map tiles, address search) are mocked. CI checks
normalized data and generated types for drift and runs the same demo path.

## Contributing

Work happens on branches cut from `test` and merged by pull request into `test`. Agree changes to
`schemas.py` together and regenerate the contract and types in the same PR. Write a short plan in
`docs/plans/` before a new feature and update the docs with each change. Task history is in
[docs/PROGRESS_TRACKER.md](docs/PROGRESS_TRACKER.md) and the original workstream briefs in
[docs/TEAM_HANDOFF.md](docs/TEAM_HANDOFF.md).

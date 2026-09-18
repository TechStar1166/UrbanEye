# Shared contract v1

`backend/schemas.py` is authoritative. `shared/openapi.json` and
`frontend/src/api.generated.ts` are generated, committed artifacts. Change the
Pydantic model, export the contract, regenerate TypeScript, and integrate both sides
in one PR. The API docs at `/docs` include the exact shapes.

## Geography and metrics

`GET /areas` returns GeoJSON (`FeatureCollection`) with `schema_version: "1.0"`.
Coordinates use WGS84 longitude, latitude order. Keep the complete source boundary;
do not clip a polygon then attach full-area totals as if they described the clip.
`Feature.id` equals `properties.geo_id`, a **string**, preserving leading zeros.

The current example is:

```json
{
  "geo_id": "2472450",
  "name": "Silver Spring CDP",
  "geography_type": "census_designated_place",
  "boundary_vintage": "2020-01-01",
  "metrics": {"population": 81015},
  "evidence": [
    {
      "evidence_id": "census2020:2472450:population",
      "type": "structured_data",
      "title": "2020 Census POP100 — Silver Spring CDP",
      "source": "U.S. Census Bureau TIGERweb Census 2020",
      "url": "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/28",
      "date": "2020-04-01",
      "geo_id": "2472450",
      "metric": "population",
      "value": 81015,
      "unit": "people"
    }
  ]
}
```

The example above shows the population evidence only; see the committed GeoJSON
for housing evidence and the exact query URL. Every metric has a matching structured
evidence object with exactly the same geographic ID, metric key and value.
Missing values are `null`, **never zero**. Percentages use 0–100; counts use people
or units; currency must specify currency/year. Do not join by display name.
Future tract GEOIDs have 11 digits; block group GEOIDs have 12. Do not mix levels or
boundary vintages in an analysis without a documented crosswalk.

## Evidence

Every object includes `evidence_id`, `type`, `title`, `source`, `url`, `date` and
`geo_id`. Structured evidence adds `metric`, `value`, `unit`. Document evidence adds
`excerpt` and, where known, `page` or `section`. Unknown optional fields are `null`.
Keep evidence IDs stable, unique and traceable to the source, e.g.
`census2020:2472450:population`. URLs point to actual source material.

Document chunks are `Evidence` objects in `documents/processed/chunks.json`.
The starter retriever matches **exact geographic IDs** and scores lexical overlap;
the empty list means no documents have been ingested. A CDP-scoped document must not
be silently relabeled as tract-scoped: add explicit geographic applicability to the
contract before introducing broader-scope retrieval.

## Routes

| Method / path | Input | Output |
| --- | --- | --- |
| `GET /health` | — | Health, area/chunk counts, LLM availability |
| `GET /areas` | — | Validated GeoJSON FeatureCollection |
| `GET /areas/{geo_id}` | String ID | Area properties, metrics, evidence |
| `GET /layers` | — | Metric IDs, labels, descriptions and units |
| `POST /ask` | `{"geo_id":"2472450","question":"What is the population?"}` | `Answer` |

Unknown areas return 404; malformed requests return 422. `/segment` and
`/business/evaluate` are not implemented and should not appear in the primary demo.

`Answer` includes `mode`, `summary`, `limitations`, `evidence_ids`, and `evidence`.
Modes distinguish deterministic facts, retrieved passages, insufficient evidence
and future LLM explanations. Every cited ID resolves to returned evidence. UI
displays sources independently of the explanation. Model output validation must
add a check against the *input* evidence bundle, not just internally valid IDs.

## Contract update commands

```bash
python -m scripts.export_contract
npm run generate:types --prefix frontend
```

Record incompatible changes with a schema version change and coordinate consumers
before merging. Keep data, API, frontend types and smoke tests in the same PR.

# First real dataset

The starter caches the **U.S. Census Bureau TIGERweb Census 2020** feature for
**Silver Spring CDP, Maryland**, GEOID `2472450`. Counts are population (`POP100`,
81,015) and housing units (`HU100`, 35,150). Data date: April 1, 2020. Boundary
vintage: January 1, 2020. These are two metrics from one real source, not two
independently collected datasets.

- [Official service and field definitions](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/28)
- Exact download URL and retrieval timestamp: `raw/source.json`
- Original GeoJSON response: `raw/silver_spring_census2020.geojson`
- Normalized API/map snapshot: `processed/areas.geojson`
- Raw file SHA-256, transformations and provenance: `processed/manifest.json`

Rebuild from cached data with `python -m scripts.prepare_data`. It requires no
network, retains the original geometry, rejects unexpected IDs and preserves null
values. To deliberately refresh the raw snapshot, download the exact manifest URL,
verify the payload and update the retrieval timestamp; review the resulting diff.
Do not add a live download to application startup.

## Fenton Village Study Geography (Block Groups)

Fenton Village is represented by whole 2020 Census Block Groups:
- **Block Group 1, Census Tract 7025.01** (GEOID `240317025011`): Population 2,866, Housing Units 1,924.
- **Block Group 1, Census Tract 7025.02** (GEOID `240317025021`): Population 1,731, Housing Units 1,316.

- Official source: U.S. Census Bureau TIGERweb Census 2020, Layer 8 (`Census Block Groups`).
- Source metadata and query URL: `data/raw/fenton_village_source.json`.
- Cached raw boundaries: `data/raw/fenton_village_blockgroups_census2020.geojson`.
- Processed output: `data/processed/areas.geojson` and `data/processed/manifest.json`.

## Geographic limitations and next handoff

The Silver Spring CDP is broader than Fenton Village. The Fenton Village block groups
lie inside the Silver Spring CDP polygon; their counts must describe each block group,
not the clipped study boundary, and should never be added to CDP totals. No within-area
density or distribution is inferred. Rebuild anytime with `python -m scripts.prepare_data`.


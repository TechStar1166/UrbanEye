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

## Fenton Village study geography

The study boundary is the adopted **Fenton Village (FV) Overlay Zone**. It is not
served as an `/areas` polygon and carries no counts. Three whole 2020 Census block
groups intersect it and together cover 100% of it:

| GEOID | Name | Share of study area | Share of block group inside it |
| --- | --- | --- | --- |
| `240317025021` | Block Group 1, Census Tract 7025.02 | 68.4% | 31.4% |
| `240317024023` | Block Group 3, Census Tract 7024.02 | 16.6% | 5.7% |
| `240317024022` | Block Group 2, Census Tract 7024.02 | 15.0% | 16.8% |

Every Census count describes the **whole block group**, not Fenton Village. Do not
sum the three or label them as overlay totals. They also sit inside Silver Spring
CDP, so adding them to CDP totals would double-count.

Primary ZIP Code Tabulation Area for these three block groups is **20910**.

## Community visualization database

`data/urbaneye.db` is a read-only SQLite snapshot for year-over-year charts. Rebuild
offline after refreshing caches:

```bash
python -m scripts.fetch_acs          # ACS summary files; skip files already cached
python -m scripts.fetch_osm          # OpenStreetMap storefronts in the FV bbox
python -m scripts.build_community_db # writes urbaneye.db plus JSON exports
```

JSON mirrors for inspection: `processed/income_history.json`,
`processed/community_metrics.json`.

| Query | Native ACS product | Years cached |
| --- | --- | --- |
| Place / county / state trends | ACS **1-year** | 2018, 2019, 2021–2024 (no 2020 1-year file) |
| Block-group snapshots | ACS **5-year** | 2018–2024. Consecutive vintages **overlap**; do not chart them as annual change |

Metrics: median household income, per capita income, renter-occupied %, poverty
rate, median age. Dollar series include a 2024-dollar companion using BLS CPI-U
(`raw/bls/cpi_u_annual.json`). Estimates with MOE > 30% of the estimate are flagged
`low_reliability`.

Peer places in the database (trend rows, not map polygons): Bethesda, Rockville,
Gaithersburg, Germantown, Montgomery County, Maryland.

Storefronts are OpenStreetMap POIs, **ODbL**, crowd-sourced, not a business census.
Every `/pois` and `/areas/{geo_id}/businesses` response includes the required
attribution.

API (does not replace `/areas`):

- `GET /community` — metrics, years, geographies
- `GET /areas/{geo_id}/history?metric=median_household_income`
- `GET /areas/{geo_id}/changes?from_year=2021&to_year=2024`
- `GET /compare?geo_ids=2472450,24031&year=2024`
- `GET /pois` and `GET /areas/{geo_id}/businesses`

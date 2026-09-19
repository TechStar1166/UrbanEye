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

Refresh deliberately with `python -m scripts.download_map_data`, then rebuild
with `python -m scripts.prepare_data`. The latter deterministically rebuilds
areas, places and the source catalog without a network connection. App startup
and map data do not require Census or Overpass availability; basemap tiles still
require network access. Sources are inspectable at `/#sources`.

## Community visualization database

`data/urbaneye.db` is a read-only SQLite snapshot for year-over-year charts. Rebuild
offline after refreshing caches:

```bash
python -m scripts.fetch_acs          # ACS summary files; skips files already cached
python -m scripts.fetch_osm          # OpenStreetMap storefronts in the FV bbox
python -m scripts.fetch_transit      # Purple Line alignment from OpenStreetMap
python -m scripts.build_community_db # writes urbaneye.db plus JSON exports
```

JSON mirrors for inspection: `processed/income_history.json`,
`processed/community_metrics.json`.

| Query | Native ACS product | Years cached |
| --- | --- | --- |
| Place / county / state trends | ACS **1-year** | 2018, 2019, 2021–2024 (no 2020 1-year file) |
| Block-group snapshots | ACS **5-year** | 2018–2024. Consecutive vintages **overlap**; do not chart them as annual change |

Metrics: median household income, per capita income, renter-occupied %, poverty
rate, median age, age 50+ share, average household size, Gini index. Dollar series
include a 2024-dollar companion using BLS CPI-U (`raw/bls/cpi_u_annual.json`).
Estimates with MOE > 30% of the estimate are flagged `low_reliability`.

Two metrics are not published for every level. **Poverty rate** (B17001) and the
**Gini index** (B19083) exist for places and larger only; block-group series come
back empty rather than estimated. **Age 50+** is derived by summing the relevant
B01001 cells for both sexes, combining their MOEs as the root sum of squares.

## Map overlays that carry no statistics

Two layers are geometry only and must never be clicked through to counts:

| Layer | Source | Caveat |
| --- | --- | --- |
| Fenton Village (FV) Overlay Zone | Montgomery County Planning | Zoning boundary, `carries_statistics: false` |
| Purple Line alignment | OpenStreetMap, ODbL | Tagged `route=construction`; **not** operating service |

Fetch and rebuild them with `python -m scripts.fetch_transit` followed by
`python -m scripts.build_community_db`. Outputs are `processed/overlays.geojson`
and `processed/transit.geojson`. Proximity to the Purple Line alignment does not
establish current transit access.

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
- `GET /overlays` — Fenton Village zoning boundary
- `GET /transit` — Purple Line alignment under construction
- `GET /storefronts` — cached OpenStreetMap storefront points

## Storefronts (OpenStreetMap)

Named shops and food, drink, bank and pharmacy amenities around the two original Fenton
Village block groups (`240317025011` and `240317025021`), for the storefront layer and competitor context. See
[docs/plans/storefront-layer.md](../docs/plans/storefront-layer.md).

- Source: OpenStreetMap via the Overpass API. Data (c) OpenStreetMap contributors, ODbL 1.0.
- Query, bounding box (block groups plus about 200 m), retrieval time and OSM data timestamp:
  `raw/storefronts_source.json`. Original response: `raw/storefronts_overpass.json`.
- Processed points: `processed/storefronts.geojson`. Each has `category`, an address when OSM
  has one, and the `block_group_id` it falls inside (`null` when only nearby context).
  Provenance, counts and limitations: `processed/storefronts_manifest.json`.
- Rebuild offline from the cached response with `python -m scripts.prepare_storefronts`.
  `--refresh` downloads a new snapshot first; review the resulting diff. Never download at startup.
- Limits: volunteer-mapped, incomplete, possibly stale, inconsistently categorized, and not an
  official business registry. Counts describe mapped features, not all businesses, and do not
  correspond to the challenge brief's 240+ figure (different boundary and source).

The storefront rebuild retains those two study groups even though the Census map now
loads 80 block groups. Other groups have no storefront coverage in this snapshot,
not a verified count of zero businesses. The food/drink snapshot above uses a separate
600 m radius and retrieval date; the two snapshots should not be added together.

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

## Geographic limitations and next handoff

The CDP is broader than Fenton Village. Its counts must not be presented as
neighborhood or selected viewport counts. No within-area density or distribution
is inferred. This starter cannot support geographic correlation with one feature.

The data owner should next confirm a documented Fenton Village study boundary,
select intersecting Census tracts/block groups, record the geographic selection
method, and join ACS estimates using the same geographic IDs/vintage. Keep full
tract counts labeled as tract counts even if the study area covers only part of a
tract. Preserve estimate year, units, source, missing-value sentinels and margins
of error where available. Integrate the first valid feature immediately, before
expanding coverage. Never use synthetic counts to fill data gaps.

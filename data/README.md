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

## Expanded block-group coverage

The active snapshot now includes all **80 Maryland 2020 block groups intersecting
or touching the official Silver Spring CDP polygon**, plus the unchanged CDP.
See `raw/silver_spring_blockgroups_source.json` for the exact spatial query,
returned IDs, and download time. Whole geometries and whole counts are retained;
boundary-touching groups may extend beyond the CDP. Do not sum them with the CDP.
The former two-group snapshot is retained as historical raw input, not loaded.
The irregular CDP geometry is unchanged from the official Census snapshot and is
not a local neighborhood or municipal boundary.

## Fenton Village and food/drink places

The challenge coordinate is 38.99487, -77.02489. A labeled pin and a **600 m study
radius** mark the focus. The circle is not presented as an official district boundary.
`raw/fenton_osm_food.json` caches an Overpass query for restaurant, cafe, fast_food,
bar, pub, ice_cream, food_court and biergarten objects within that radius.
`raw/fenton_osm_source.json` records its query, timestamp and ODbL attribution.
The snapshot contains **90 mapped OSM objects**. Nodes use their coordinates;
ways and relations use their centers. Centers beyond 600 m are excluded.
IDs are unique, but separate OSM objects could refer to the same establishment.
The count is not a verified business census. From OpenStreetMap, may not be complete.

Refresh deliberately with `python -m scripts.download_map_data`, then rebuild
with `python -m scripts.prepare_data`. The latter deterministically rebuilds
areas, places and the source catalog without a network connection. App startup
and map data do not require Census or Overpass availability; basemap tiles still
require network access. Sources are inspectable at `/#sources`.

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

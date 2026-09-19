# Plan: real storefront layer for Fenton Village (OpenStreetMap)

Owner: Jackson proposes and starts the data step; Pujan (data) and Nick (backend) to review.
Status: step 1 (data snapshot) in progress on `work/storefronts-data`. Steps 2 and 3 not started.
Follows the project rule: plan first, docs in the same PR.

## Why

The "Storefront Locations" layer is a Preview with no data behind it, and the challenge brief
describes Fenton Village as a district with 240+ local businesses. Public business data is the
missing piece for the Fenton Village application: a real, sourced picture of who is on the
street. OpenStreetMap (OSM) is free, open and has usable coverage here.

## Feasibility check (done)

A read-only Overpass query on 2026-09-19 for shops and food/drink/bank/pharmacy amenities in a
box around downtown Silver Spring returned 198 features, 191 named: 52 restaurants, 20 fast
food, 15 banks, 11 cafes, 11 beauty shops, 10 hairdressers, 7 bars, 6 convenience stores, and more.
That box was wider than the study geography, so it is a feasibility signal, not the final count.

## Steps

1. **Data snapshot (this PR).** `scripts/prepare_storefronts.py`:
   - `--refresh` queries Overpass once for the bounding box of the Fenton Village block groups
     (plus about 200 m of padding) and caches the raw response and query metadata under `data/raw/`.
   - The default run rebuilds `data/processed/storefronts.geojson` and
     `data/processed/storefronts_manifest.json` from the cached raw file with no network,
     matching how `prepare_data.py` works. No live download at application startup.
   - Each named storefront gets `category`, an address when OSM has one, and the
     `block_group_id` it falls inside (or `null` when it is only nearby context).
   - Tests: determinism, unique IDs, coordinates inside the query box, block group IDs that exist
     in `areas.geojson`, and a manifest hash that matches the raw file.
2. **API (not started; needs Nick and a contract decision).** A read-only `GET /storefronts`
   with a schema and regenerated frontend types, per the tracker rule that schema changes
   involve every owner.
3. **Map layer (not started; Jackson).** Plot storefronts on the map, filter by category, show
   counts per block group, and list the nearest businesses of the same category. Wire the
   existing Storefront Locations layer row, remove its Preview label, and add tests.

## Rules

- Say "OpenStreetMap-mapped" wherever a count appears. OSM is volunteer-mapped: incomplete and
  possibly out of date, and not an official business registry. The manifest records this.
- Attribution is required by the ODbL license: "(c) OpenStreetMap contributors". The map already
  shows the basemap attribution; the layer and the docs must carry it as well.
- No score, "market fit" or profitability claim from these counts. A count of nearby competitors
  is context, not a verdict.
- Named features only. Unnamed ones are dropped and counted in the manifest.

## Known limits

- OSM tags are inconsistent: a cafe can be tagged `cafe`, `restaurant` or `fast_food`, so category
  counts are approximate.
- The 240+ figure in the challenge brief covers "Fenton Village" as the organizers define it; our
  study geography is two Census block groups, so counts will not match and should not be compared
  as if they do.
- Snapshot date is the retrieval date in the manifest; businesses open and close.

## Validation

`pytest` (new `tests/test_storefronts.py` plus the existing suite) and a manual check of the
counts by category against the raw response.

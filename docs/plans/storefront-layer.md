# Plan: real storefront layer for Fenton Village (OpenStreetMap)

Owner: Jackson proposes and starts the data step; Pujan (data) and Nick (backend) to review.
Status: step 1 (data snapshot) is PR #11; steps 2 and 3 (API and map layer) are on `work/storefront-layer`
(this branch includes step 1 until #11 merges).
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
2. **API (done on `work/storefront-layer`; Nick to review the contract).** A read-only `GET /storefronts`
   with a schema and regenerated frontend types, per the tracker rule that schema changes
   involve every owner.
3. **Map layer (done on `work/storefront-layer`).** Plot storefronts on the map, filter by category, show
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

## What was built (steps 2 and 3)

- `GET /storefronts` (`backend/schemas.py`, `backend/data.py`, `backend/main.py`): serves the snapshot with
  attribution, license and limitations. The loader refuses to start if the raw file no longer matches its
  manifest hash, if an ID is duplicated, or if a storefront names an unknown block group. It is a separate
  endpoint on purpose: `/layers` must keep matching the Census metric keys (an existing test enforces this).
- Frontend: the Storefront Locations layer row is real (off by default). Markers are colored by four coarse
  groups with per-group filters and counts, popups show name, category, address and how many other businesses
  of the same OSM category are within 300 m, and the Overview gets a per-block-group summary card. Turning the
  layer on zooms to the markers, because at the default zoom (fit to the whole CDP) all 243 are one clump.
- Names come from user-edited OSM data, so popups and tooltips are built from text nodes, never HTML.

## Performance

Measured before and after in the browser (Playwright, 23 opacity-slider ticks):

| | DOM nodes added/removed in the map panes |
| --- | --- |
| Before (every state change deleted and rebuilt all shapes) | 115 added, 115 removed |
| After, with 243 storefront markers on | 0 |

- Area shapes are built once per dataset and restyled in place (`setStyle`) for selection, metric and opacity.
- Markers are rebuilt only when the visible set changes; popup content is built when a marker is opened.
- Payloads are small: `/areas` 34 KB (11 KB gzipped), `/storefronts` 46 KB (8 KB gzipped). The geometry is
  tiny (664 + 41 + 63 vertices), so the win is avoiding rebuild churn, not shrinking data.
- SVG is still used for markers (243 nodes is fine, and canvas would put a layer above the SVG shapes that
  blocks their clicks). If the count grows past a few thousand, cluster or move both to one canvas renderer.
- Two Leaflet behaviors found while testing: an animated `fitBounds` is silently dropped while another zoom
  animation runs, and an in-flight zoom animation re-applies its own target view when it ends. So the initial
  fit and the storefront zoom are both non-animated.

## Follow-ups

- Nick: review the `/storefronts` contract and generated types.
- The map does not re-zoom when the category filters change (by design); a "fit to selected block group" action
  would help when browsing one area.
- Competitor context is still just a same-category count within 300 m; no scoring (see the rules above).

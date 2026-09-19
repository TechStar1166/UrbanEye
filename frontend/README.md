# CivicLens frontend

The workspace recreates the supplied `stitch-civiclens/` design in React and CSS.
The original interactive Leaflet map, OpenStreetMap attribution, geographic
boundaries, selected-area state, and Census evidence are retained.

## Current integration

- `GET /api/areas` supplies the map polygons, population, housing counts, and
  original evidence. The first area is selected on load; polygon clicks and search
  change the selection. Data view and JSON export use these actual source objects.
- A single Show on map control switches between population, housing units, and boundaries.
  Equal-interval colors compare block groups only; the CDP stays neutral.
  Opacity, zoom, and recenter affect Leaflet.
  Fenton block groups render above the containing CDP so they remain clickable.
  CDP and block-group totals describe different geographic levels; do not sum them.
- Income, age, tenure and related tools are marked Coming next. Unbuilt actions
  are disabled and the future-data catalog is collapsed. Food/drink dots are real OSM objects.
- Individual counts link to their source, with hover/focus citations. The current
  fields POP100/HU100 are decennial counts, not ACS survey estimates. The UI says
  Official 2020 count; See details explains sampling versus other errors.
- Age/income overlap criteria and business analysis are unavailable. No fabricated analytical answer or
  correlation result is presented as live output. The age/income comparison states
  Not enough data yet; technical sample-size details remain in Evidence.
- The query form calls `/ask` with the selected geographic ID. The answer appears at the top of the right panel and
  displays loading/errors, deterministic facts, retrieved passages, and Gemini
  claims with source chips and limitations. A magenta outline marks the area a Census count covers; planning answers explicitly state their regional scope. Changing areas clears old answers.
- Three wrapped suggestions run in one tap and remain below each answer.
  Address search is not available; place names and IDs remain searchable.
- Answer history is held in memory for the current session. The Answer history badge updates after each answer.
- The map opens at 38.99487, -77.02489, zoom 16 with Esri Light Gray. The labeled
  pin marks Fenton Village; the dashed 600 m circle is a study radius, not an official boundary.
- `/places` supplies 90 cached OSM objects; `/sources` supplies the provenance catalog
  rendered at `/#sources`, including download timestamps, links, uses and limitations.

- The Compare areas tab also has a live **Compare two Census layers** panel. It calls
  `/segment` and shows the correlation, sample size, association-only note and
  per-area values. Only areas of the same geography type are compared (a CDP is never
  compared with block groups), and at least 3 are required; otherwise the panel
  explains why it cannot compare. An optional dark slate map outline marks areas at or
  above the 60th percentile in both layers (a ranking, not a statistical test).
- **Storefront Locations** is a real layer, off by default: OpenStreetMap-mapped businesses from
  `GET /storefronts`, colored by four groups with per-group filters. A marker's popup shows its name,
  category, address and the number of other same-category businesses within 300 m. Turning the layer on
  zooms to the markers. The Overview shows a per-block-group summary with attribution and the caveat that
  OSM is volunteer-mapped and not a business registry. See
  [docs/plans/storefront-layer.md](../docs/plans/storefront-layer.md).
- Map performance: area shapes are built once and restyled in place, so selection, metric and opacity changes
  cause no DOM churn even with the storefront markers on (covered by `tests/storefronts.spec.ts`).
- The Overview ends with a **data coverage** card: the values the dataset has for the
  selected area and what is not in it at all (complete verified competitor coverage, rent, foot traffic, revenue).
- The selected area and tab are kept in the URL hash (`#area=<geo_id>&tab=<Tab>`), so a
  view can be bookmarked or shared; the map's copy-link button copies it. Unknown values
  are ignored. Layer and opacity are not in the URL.
- The Data view has **Export all areas (CSV)**: one row per area and metric with its source,
  date and URL. Text cells that could run as spreadsheet formulas are escaped. See
  [docs/plans/transparency-and-sharing.md](../docs/plans/transparency-and-sharing.md).

The app uses three panes on desktop, two panes with a layer drawer on tablet,
and a bottom navigation bar for map/layers/insights on phones. Header search
supports Ctrl/Cmd+K and matches loaded area names or geographic IDs.

## Local verification

Run the API on port 8000 and Vite or the frontend container on port 5173:

```bash
npm run build --prefix frontend
npm run test:e2e --prefix frontend
```

The browser suite checks real map selection/evidence, opacity and metric
controls, disabled placeholders, data export, answer history, sources-page navigation,
wrapped questions and viewport bounds.
It blocks map tiles to verify the committed polygons still render without them.
The comparison tests also use mocked same-type areas to exercise insufficient-data and error cases.
The optional `LIVE_GEMINI=1` test checks the existing backend API directly to
complement the UI tests, which verify live count queries and mocked AI rendering.

Fonts use Google Fonts with local sans-serif/monospace fallbacks. All interface
icons are local SVG components; there is no Tailwind CDN or remote script dependency.

Count source verification: [TIGERweb Census 2020 places](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/28) and [block groups](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/8) expose POP100 and HU100. [ACS sampling guidance](https://www.census.gov/programs-surveys/acs/methodology/sample-size-and-data-quality/sample-size-definitions.html) describes margins of error for sample estimates. Official counts can still have [coverage error](https://www.census.gov/library/stories/2022/03/who-was-undercounted-overcounted-in-2020-census.html). Future ACS estimates should show their published uncertainty, such as “Estimate, could be off by about ±X.”

## Answer experience

Questions occupy their own row below the map; answers never overlay its polygons.
On phones, submitting opens Insights, with a Back to the map button. Census answers
show a prominent count, a whole-area scope caveat, the exact TIGERweb field and
geographic ID, and the source manifest's retrieval date. The source chip opens the
original Census record filtered to that ID. Input clears on submission and the
three follow-up buttons stay directly below the answer. The map fits the count's
geography automatically; the legend sits opposite the zoom controls.

The Silver Spring plan suggestion explicitly requests regional planning context
using the existing CDP retrieval scope, while retaining the selected block group.
It never treats the plan boundary as the block group's boundary. Evidence combines
unique cited records from the selected area and its answer history, counting repeat
citations once. Historical Who lives here share links open Compare areas.

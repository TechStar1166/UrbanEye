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
- Overlap criteria and business analysis are unavailable. No fabricated analytical answer or
  correlation result is presented as live output. The age/income comparison states
  Not enough data yet; technical sample-size details remain in Evidence.
- The query form calls `/ask` with the selected geographic ID. The query dock replaces suggestions with answers and
  displays loading/errors, deterministic facts, retrieved passages, and Gemini
  claims with source chips and limitations. A magenta outline marks the queried
  area, with a reminder that planning sources can have a different scope. Changing areas clears old answers.
- Three wrapped suggestions run in one tap. Try another question restores them.
  Address search is not available; place names and IDs remain searchable.
- Answer history is held in memory for the current session. The answer bar can collapse.
- The map opens at 38.99487, -77.02489, zoom 15 with Esri Light Gray. The labeled
  pin marks Fenton Village; the dashed 600 m circle is a study radius, not an official boundary.
- `/places` supplies 90 cached OSM objects; `/sources` supplies the provenance catalog
  rendered at `/#sources`, including download timestamps, links, uses and limitations.

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
The optional `LIVE_GEMINI=1` test checks the existing backend API directly to
complement the UI tests, which verify live count queries and mocked AI rendering.

Fonts use Google Fonts with local sans-serif/monospace fallbacks. All interface
icons are local SVG components; there is no Tailwind CDN or remote script dependency.

Count source verification: [TIGERweb Census 2020 places](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/28) and [block groups](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/8) expose POP100 and HU100. [ACS sampling guidance](https://www.census.gov/programs-surveys/acs/methodology/sample-size-and-data-quality/sample-size-definitions.html) describes margins of error for sample estimates. Official counts can still have [coverage error](https://www.census.gov/library/stories/2022/03/who-was-undercounted-overcounted-in-2020-census.html). Future ACS estimates should show their published uncertainty, such as “Estimate, could be off by about ±X.”

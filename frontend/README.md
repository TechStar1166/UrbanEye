# CivicLens frontend

The workspace recreates the supplied `stitch-civiclens/` design in React and CSS.
The original interactive Leaflet map, OpenStreetMap attribution, geographic
boundaries, selected-area state, and Census evidence are retained.

## Current integration

- `GET /api/areas` supplies the map polygons, population, housing counts, and
  original evidence. The first area is selected on load; polygon clicks and search
  change the selection. Data view and JSON export use these actual source objects.
- Population/housing layer controls, opacity, zoom, and recenter affect Leaflet.
  Fenton block groups render above the containing CDP so they remain clickable.
  CDP and block-group totals describe different geographic levels; do not sum them.
- Income, age, and housing-tenure charts are labeled design previews.
- The sidebar layer controls for age/income, the sidebar overlap criteria and the
  business planning dialog are frontend previews.
- The Segmentation tab also has a live **Compare two Census layers** panel. It calls
  `/segment` and shows the correlation, sample size, association-only note and
  per-area values. Only areas of the same geography type are compared (a CDP is never
  compared with block groups), and at least 3 are required; otherwise the panel
  explains why it cannot compare. An optional orange map outline marks areas at or
  above the 60th percentile in both layers (a ranking, not a statistical test).
- Map fill scales with the selected metric **within each geography type**. A type with
  fewer than 2 areas, or no spread, keeps the flat fill. See
  [docs/plans/segmentation-and-scale.md](../docs/plans/segmentation-and-scale.md).
- The query form calls `/ask` with the selected geographic ID. The research tab
  displays loading/errors, deterministic facts, retrieved passages, and Gemini
  claims with source links and limitations. Changing areas clears old answers.
- Preview state is in memory only. Site briefs are not stored or sent anywhere.

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
controls, preview interactions, data export, retry behavior, and mobile dialogs.
It blocks map tiles to verify the committed polygons still render without them.
`tests/scale.spec.ts` and `tests/segmentation.spec.ts` cover the fill scale and layer
comparison using mocked multi-area data (`tests/fixtures.ts`), because the committed
dataset does not yet have 3 comparable block groups.
The optional `LIVE_GEMINI=1` test checks the existing backend API directly to
complement the UI tests, which verify live count queries and mocked AI rendering.

Fonts use Google Fonts with local sans-serif/monospace fallbacks. All interface
icons are local SVG components; there is no Tailwind CDN or remote script dependency.

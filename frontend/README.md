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
- Additional layer controls, overlap criteria and the business
  planning dialog are frontend previews. No fabricated analytical answer or
  correlation result is presented as live output.
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
The optional `LIVE_GEMINI=1` test checks the existing backend API directly to
complement the UI tests, which verify live count queries and mocked AI rendering.

Fonts use Google Fonts with local sans-serif/monospace fallbacks. All interface
icons are local SVG components; there is no Tailwind CDN or remote script dependency.

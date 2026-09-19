# CivicLens frontend

The workspace recreates the supplied `stitch-civiclens/` design in React and CSS.
The original interactive Leaflet map, OpenStreetMap attribution, geographic
boundaries, selected-area state, and Census evidence are retained.

## Current integration

- `GET /api/areas` supplies the map polygons, population, housing counts, and
  original evidence. The first area is selected on load; polygon clicks and search
  change the selection. Data view and JSON export use these actual source objects.
- Population/housing layer controls, opacity, zoom, and recenter affect Leaflet.
- Income, age, and housing-tenure charts are labeled design previews.
- Additional layer controls, overlap criteria, research panels, and the business
  planning dialog are frontend previews. No fabricated analytical answer or
  correlation result is presented as live output.
- The query form records a question locally and opens the research tab. It does
  not call `/ask` yet. The existing API helper remains available for later wiring.
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
The optional `LIVE_GEMINI=1` test checks the existing backend API directly; it does
not imply that the new research UI is connected.

Fonts use Google Fonts with local sans-serif/monospace fallbacks. All interface
icons are local SVG components; there is no Tailwind CDN or remote script dependency.

# Plan: data limits card, shareable view link, all-areas CSV export

Owner: Jackson (workstream B). Status: in progress on `work/transparency-and-sharing` (PR into `test`).
Follows the project rule: plan first, docs updated in the same PR.

## Why

The track is judged on evidence: does the tool show the data behind its answers. Three small,
honest frontend additions strengthen that, and none needs new data or a backend change.

## Changes

1. **"What this data can't tell you" card** (Overview tab). For the selected area: which metrics
   the dataset has (with value or "No data"), and what is not in the dataset at all
   (competitor locations, rent and lease prices, foot traffic, business revenue). It does not
   list income, age or tenure as missing, because those may be added; they simply appear in the
   metrics list when they arrive.
2. **Shareable view link.** The selected area and tab are kept in the URL hash
   (`#area=<geo_id>&tab=<Tab>`). Opening the link restores them; an unknown area or tab is
   ignored. A "Copy link" button sits next to the recenter button. Layer and opacity are not in
   the URL: the layer controls are coupled checkboxes, and restoring them safely needs more work.
   (This was in the original handwritten notes: "bookmark the link".)
3. **Download all areas as CSV.** A button in the Data view. Long format, one row per area and
   metric: `geo_id, name, geography_type, boundary_vintage, metric, value, unit, source,
   data_date, source_url`. Text cells that start with `=`, `+`, `-`, `@` are prefixed with `'`
   so a spreadsheet does not run them as formulas.

## Files

- `frontend/src/components/DataCoverage.tsx`, `frontend/src/lib/csv.ts`, `frontend/src/lib/urlState.ts` (new)
- `frontend/src/App.tsx` (small hooks: initial tab/area from the hash, hash write effect, copy
  button, CSV button, card mount)
- `frontend/tests/transparency.spec.ts`

## Known limits

- Excel may show 12-digit block-group IDs in scientific notation; the CSV is meant for
  inspection and programmatic use, not as a polished report.
- The URL restores area and tab only.
- Copy-link uses the clipboard API, which needs a secure context (fine on localhost/https);
  otherwise it reports failure and the address bar still holds the link.
- Touches `App.tsx`, which PRs #7 and #8 also edit; expect a small merge when they land.

## Validation

`npm run build`; `npx playwright test` against the real backend. Tests cover the CSV content
and formula-escaping, hash restore/ignore/update, and the limits card.

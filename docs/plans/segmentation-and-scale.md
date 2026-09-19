# Plan: comparative fill scale and two-layer segmentation (E1, E4)

Owner: Jackson (workstream B). Status: implemented in PR #7 against `test`.
Written to satisfy the project rule: every new feature gets a plan, and docs change with the code.

## Goal

Let a user compare two Census layers over comparable areas and see the result on the
map, with the evidence and its limits visible, using only the existing `/layers` and
`/segment` endpoints and no schema changes.

## Scope

1. **Comparative fill scale.** Map fill varies with the selected metric.
2. **Segmentation panel.** In the Segmentation tab: two layer pickers, a Compare button,
   correlation, sample size, association-only note, per-area table.
3. **"High in both layers" outline.** Optional map outline for areas at or above the
   60th percentile in both layers, with a legend entry.

## Rules the implementation must follow

- Areas are compared **only within one geography type**. A CDP total (81,015 people)
  is not comparable with a block group (about 2,000), so scales, correlation input and
  the outline all use the largest same-type set with values for both layers
  (`comparableUnit` in `frontend/src/map/scale.ts`). Ties prefer the finer unit.
- Correlation needs at least 3 comparable areas (mirrors `backend/analysis/correlation.py`).
  Below that the UI explains why and sends no request.
- A `null` correlation is shown as "Undefined", never as 0.
- The panel always states that correlation is association, not causation, and that the
  outline is a ranking of the areas shown, not a statistical test.
- A type with fewer than 2 areas, or no spread, keeps the pre-existing flat fill, so
  the CDP looks exactly as before.

## Files

- `frontend/src/map/scale.ts`: `makeScale`, `scalesByType`, `comparableUnit`, `highInBoth`.
- `frontend/src/segmentation/SegmentationPanel.tsx`: the panel.
- `frontend/src/map/CommunityMap.tsx`: per-type fill opacity, highlight outline.
- `frontend/src/App.tsx`: mounts the panel, holds highlight state, legend text.
- `frontend/tests/scale.spec.ts`, `segmentation.spec.ts`, `fixtures.ts`.

## Validation

`npm run build`; `npx playwright test` (26 passed, 1 skipped opt-in live-Gemini test).
Multi-area behavior is tested with **mocked** area data only.

## Known limits and follow-ups

- The real dataset had 2 block groups when this shipped, below the 3-area minimum, so
  the panel shows its "not enough comparable areas" state until more block groups land.
- Both current layers are counts (population, housing units), so their correlation is
  high by construction and not informative. A rate metric (median income) is needed;
  Pujan owns that (E2).
- The 60th-percentile threshold is fixed. MVP plan section 17 describes user-selected
  thresholds; not built.
- The outline only shows while the Segmentation tab is open.
- The outline is distinguished by color and weight only; add a dash pattern if
  color-blind accessibility matters for the demo.
- Not visually reviewed in a browser; tests assert attribute values and text.

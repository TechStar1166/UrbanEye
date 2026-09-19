# Plan: remove fabricated sample values from the UI

Owner: Jackson (workstream B). Status: in progress on branch `work/preview-placeholders` (PR into `test`).

## Problem

The Overview tab and layer list show hardcoded numbers that are not in the dataset:
median household income `$68,400` ("58% of County median"), age 50+ cohort `27.1%`,
Gini index `0.44`, a 74% renter / 26% owner tenure bar, and an age-cohort chart
(18.2%, 33.4%, 21.3%, 16.8%, 10.3%). They are labeled "Preview", but a viewer or judge can
still read them as real Census output. The challenge is judged on **evidence** (does it show
the data behind its answers), so unsourced numbers on screen are a liability, and the demo
video would inherit them.

## Change

- Layer list: the income and Gini rows show the existing "Preview" label instead of a value.
- Overview "Extended community profile": the two cards show `—` and "Not connected yet" instead
  of invented values.
- Housing tenure chart and age cohort chart: removed; replaced by one note saying they appear
  when tenure and age data are added to the dataset.
- Methodology dialog and `frontend/README.md`: say these are not connected, rather than
  "illustrative previews".

## Not changing

- The layout, the sidebar controls (opacity, income threshold, overlap selectors) and the
  `Preview` labels on controls that are not wired to data.
- Real values. When Pujan's income data lands (E2), the income card and layer row should be
  wired to the real metric key and this plan updated. The key name is not guessed here.

## Validation

`npm run build`; `npx playwright test` against the real backend. No existing test references
the removed values (checked with grep). Add a test that the Overview no longer contains the
removed numbers, and that the extended-profile cards show `—`.

## Risks

- Removing the two charts makes the Overview shorter and less "finished" looking. That is the
  intended trade: an honest gap over a convincing fake.
- This branch is cut from `test`, so it does not include PR #7; the two touch different parts
  of `App.tsx`, but expect a small merge if both are open.

# Analysis workstream boundary

Do not compute correlation from the starter's single CDP. The analysis/integration
owner first helps validate data joins, evidence and the end-to-end smoke test.

After several comparable geographic units and two suitable variables are available,
implement deterministic segmentation here and expose `POST /segment` in the API.
Agree its Pydantic contract before frontend implementation. Include thresholds,
included/excluded geographic IDs, sample size, missing-value policy, source dates,
evidence IDs and explicit reasons for undefined correlation. Exclude null pairs;
reject mixed geographic vintages, non-finite numbers and incompatible units; report
undefined correlation for fewer than three pairs or a constant variable. Do not
interpret association as causation or area-level counts as individual behavior.

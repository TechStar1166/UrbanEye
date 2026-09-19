# Plan: business planning module ("Evaluate Site Viability") — decision needed

Owner: Jackson proposes; needs agreement from Nick (backend) and Amrit (integration).
Status: **proposal, not started.** MVP plan sections 18 and 19 make this optional and say it
must not block the checkpoint. It is the "Application" part of the pitch, so it is worth
deciding deliberately rather than rushing.

## Where it is today

The "Evaluate Site Viability" button opens a dialog that takes a street and business type and
"prepares a site brief". It stores nothing and analyzes nothing; the dialog and README label it
a preview. There is no evaluation endpoint, and no data for competitors, rent, foot traffic or
revenue.

## What we must not do

Show a score, "viability", or "market fit" number that the data cannot support. We just removed
fabricated income/age/tenure values from the UI (docs/plans/remove-placeholder-data.md) because
the track is judged on evidence. A convincing-looking but unsourced evaluation would repeat
that mistake, and public data alone cannot establish profitability (MVP plan section 21).

## Options

### A. Frontend-only "site brief" from evidence we already have (small, honest, thin)

Uses existing endpoints only; no schema change.

- Input: business type + the selected area (not a free street address; we have no geocoder).
- Output, assembled in the UI from real data:
  - the selected area's Census population and housing units, with source and date;
  - the planning passages returned by `/ask` for a fixed, business-neutral housing question,
    with page and geographic-scope limitation;
  - a "not available" list: competitors, rent, foot traffic, revenue, customer segments.
- No score and no AI-written recommendation.
- Effort: about half a day including tests. Risk: it looks thin because the indexed plan only
  covers housing, so a café brief will mostly say "no evidence available" beyond the counts.

### B. Backend `/evaluate` with structured LLM output (matches MVP plan section 19)

Nick adds an endpoint that takes `{geo_id, business_type}`, builds an evidence bundle
(area facts + retrieved passages + competitors if a dataset exists), and asks the model for
`{summary, strengths, concerns, customer_context, competition_context, evidence_ids}`,
validated so every claim cites supplied evidence, as `/ask` already does.

- Needs: a competitor/business dataset (none exists), more indexed documents, contract and
  generated-type changes (all owners must agree per the tracker), and prompt/validation work.
- Effort: most of a day across backend and frontend. Risk: high for the time left; without
  competitor data the strengths/concerns would be generic.

### C. Leave it as a labelled preview and present it as future work

- No code. The pitch says "the same evidence layer can support site planning next".
- Effort: none. Risk: the "Application" criterion leans only on the community-intelligence use
  case, which the challenge names as the Fenton Village application, so this is acceptable.

## Recommendation

Do C now. Revisit A only if income and more block-group data land and time remains before the
recording cutoff, because A is the only option that stays fully honest with today's data. Do B
only if someone owns a real competitor dataset. Whatever is chosen, the dialog copy should
state plainly what the brief does and does not contain.

## If A is chosen: files and validation

- `frontend/src/App.tsx`: replace the dialog's confirmation with the brief view.
- Reuse `EvidenceList` for sources; reuse `api.ask` with a fixed question.
- Tests: brief lists real counts and sources; contains no score; lists the unavailable inputs;
  handles `/ask` failure and `insufficient_evidence`.
- Docs: update `frontend/README.md` (remove "no fabricated analytical answer" wording only if
  still true) and the tracker in the same PR.

## Open questions

- Which option does the team want? (Nick and Amrit especially, for B.)
- Is there any competitor or business-license dataset we can obtain in time?

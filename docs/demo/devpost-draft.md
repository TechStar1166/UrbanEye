# UrbanEye: Devpost submission text

Written for: the Bay Hacks 2026 judges reading the Devpost page. Copy each section into the matching Devpost field.
Items in [brackets] need a real value or a decision before you submit. Nothing here claims more than the app does today.

---

## Project name
UrbanEye

## Tagline (Devpost limit is short)
Evidence-first community intelligence for Silver Spring

## Track
**UX University Challenge: Silver Spring Community Intelligence** (main track, one only).
Do not apply for Best Use of ElevenLabs or Best Use of Render: neither is used.

---

## About the project

### Inspiration
Public information about a neighborhood exists, but it is scattered across Census tables, county planning documents and business listings. They use different boundaries and dates, and nothing ties them together. And when people ask an AI about their neighborhood, it often invents an answer. We wanted a tool where a resident, a small-business owner or a planner in Fenton Village can see what is known, where it comes from, and where the evidence runs out.

### What it does
UrbanEye brings fragmented public data onto one interactive map of Silver Spring, Maryland, with Fenton Village as the focus, and shows the source behind every fact.

- **Real Census geography.** The 2020 Census Silver Spring area and 80 block groups, with population, housing units and population density. Each value links to its official source and date, and is labeled as a whole-area count, not a Fenton Village total.
- **Community profile from the American Community Survey.** Median household income, share of residents 50 and older, average household size and renter-occupied share, from the ACS 5-year 2020 to 2024 estimates. Because survey estimates are uncertain, values are flagged "low reliability" when the margin of error is large, and the profile notes that ACS estimates carry a 90% margin of error.
- **Answers that cite their source.** Ask about a selected area. We retrieve passages from the 2022 Silver Spring Downtown and Adjacent Communities Plan, and an AI model (Gemini) may only explain those passages, with links to the exact page (for example, page 92 on affordable housing). The plan's own geographic caveat is shown with the answer.
- **It refuses to guess.** Ask something the evidence cannot support ("Will population double next year?") and it says the evidence is insufficient.
- **Real businesses.** 243 OpenStreetMap-mapped businesses around the two Fenton study areas, filterable by type, with nearby same-type counts, plus 90 food and drink places inside a 600 m study circle. Labeled as volunteer-mapped data, not an official registry.
- **Compare layers.** Compare any two of seven Census layers (for example income and age 50+, across 76 block groups with data): correlation, sample size, per-area values, and a reminder that association is not causation. Areas high in both can be outlined on the map.
- **Business site brief.** "Is this a good spot for a business?" shows the community context for an area (people, median income, renters, and the businesses mapped there). It says plainly that this is context, not a recommendation, and that rent, leases and foot traffic are not in the data.
- **Address search** [include only if PR #17 is merged]: type a street address and the map pins it and selects the Census block group that contains it, so every fact applies to that address.
- **Transparency tools.** A data-coverage card that says what the data cannot tell you, a Data Sources and Methodology page, shareable links to a view, and CSV export of every area with its sources.

### How we built it
Facts first, AI second. The platform holds the verified data and does the math; the model only explains retrieved evidence, and its output is validated against the sources it was given.

- **Frontend:** React and TypeScript (Vite) with Leaflet. Shapes are built once and restyled in place, so selection and opacity changes cause no DOM churn even with hundreds of markers.
- **Backend:** FastAPI and Pydantic with a typed API contract (OpenAPI) and generated frontend types.
- **Data:** U.S. Census Bureau 2020 (TIGERweb boundaries and counts) and American Community Survey 5-year 2020 to 2024 estimates, OpenStreetMap via the Overpass API, and the 2022 Silver Spring plan indexed as page-cited passages. Every dataset is a committed snapshot with a provenance manifest (source URL, retrieval time, SHA-256 hash, transformation, limitations); the app never downloads data at startup.
- **AI:** BM25 retrieval over the planning passages, then Gemini 3.6 Flash for a grounded explanation. If the evidence is missing or the model fails, the app falls back to showing the retrieved passages and says so.
- **Quality:** more than 200 automated tests (backend and Playwright browser tests), a CI workflow, Docker Compose to run it.

### Challenges we ran into
- **Geography does not line up.** A Census area, a block group and a planning-document boundary are three different things. We label each answer with its scope and never add areas of different types together; comparisons and color scales only compare like with like.
- **Keeping the AI honest.** We restrict the model to retrieved passages, require citations, and test refusal and prompt-injection cases.
- **Resisting fake polish.** Early screens showed sample numbers for income, age and tenure. We removed them until we had real ACS data, and we flag unreliable survey estimates on screen instead of hiding the uncertainty.
- **Real bugs in the mapping layer.** Leaflet silently drops or overwrites overlapping zoom animations, which broke a "zoom to businesses" feature until we found the cause.

### Accomplishments that we're proud of
- Every number on screen has a source, a date and a stated scope.
- It says "I don't know" when the evidence is not there.
- More than 200 automated tests, and honest labels on uncertainty and on what the data cannot tell you.
- Real Fenton Village data (Census, ACS, planning document, OpenStreetMap), not mock data.

### What we learned
For civic tools, trust is the product. Showing the source, the boundary and the limits next to each fact matters as much as the fact.

### What's next
- Transit and zoning overlays (Purple Line, Fenton overlay zone).
- An AI-assisted site evaluation that builds on the business site brief, using this same evidence: context, not a profit forecast.
- More planning documents, and more neighborhoods: a new neighborhood should be new data, not new code.
- The 14-day continuation with UX University, if selected.

---

## Built with (tags)
react, typescript, vite, leaflet, python, fastapi, pydantic, google-gemini, openstreetmap, overpass-api, nominatim, us-census-bureau, playwright, docker, github-actions

## Try it out (links)
- **Repo:** [public GitHub URL. The repo was private; make it public or add the organizers first]
- **Demo video:** [YouTube/Vimeo link, 2 to 3 minutes]
- **Live demo:** [none today; leave blank rather than link something unreliable]

## How to run it (paste into the description or README link)
Clone, then `docker compose up --build` and open http://localhost:5173. No key is needed: without a Gemini key you get the cited planning passages; with `GEMINI_API_KEY` in `.env`, a model explains those passages.

## Data credits and licensing (put at the end of the description)
U.S. Census Bureau 2020 Decennial Census and American Community Survey 2020 to 2024 (public domain). Silver Spring Downtown and Adjacent Communities Plan, Montgomery Planning (2022). Business and food/drink locations and address search: (c) OpenStreetMap contributors, ODbL.

---

## Before you submit (checklist)
- [ ] Video is 2 to 3 minutes, shows the working MVP, and is uploaded (public or unlisted) with the link pasted
- [ ] Repo link works when you are logged out
- [ ] Team members added on Devpost
- [ ] "Address search" line kept only if PR #17 is merged into what you record
- [ ] Numbers match the app on the day (80 block groups, 243 businesses, 90 food/drink places, 76 block groups in the income/age comparison); re-check if data changes
- [ ] All code was written during the event; the repo contains no pre-event code
- [ ] At least one member at the Sunday 10 AM ceremony, in person
- [ ] Submit by about 6 PM

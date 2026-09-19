# UrbanEye: presentation script (2:50 target, 3:00 hard cap)

Format: a short slide presentation with a live-demo section in the middle, recorded as one video.
Written for the team recording it and the judges watching it (Devpost video, UX University track).
Everything claimed below was checked against the current `test` branch (5db61d6). Anything that depends on a
pending PR is marked **[needs #17]**.

Judging criteria this proves: **MVP** (it works), **Architecture** (sound, worth building on),
**Evidence** (shows the data behind answers), **Application** (Fenton Village is real and demonstrated).

---

## Before you record (10 minutes)

- [ ] **Gemini key in the recording machine's `.env`** (`GEMINI_API_KEY=...`, never in chat or git). Restart the backend and check `http://localhost:8000/health` shows `"llm_enabled": true`. If it cannot be set, use the "no key" wording in slide 3 and demo step 3.
- [ ] Merge state: address search (**PR #17**) and the outline-color fix (**PR #18**) merged into `test`. If #17 is not merged, use the fallback in demo step 2.
- [ ] Run: `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000` and `npm run dev --prefix frontend`; open `http://localhost:5173`. Internet on (map tiles, address search).
- [ ] Browser at 1440x900, 100% zoom, notifications off, other tabs closed. Reload the page before each take.
- [ ] Repo is **public** (or organizers added) before you submit.
- [ ] Record slides and demo as **separate clips**, then cut them together. Do two takes of each.
- [ ] Read the narration aloud once with a stopwatch. It should land around 2:40 to 2:55. If long, cut the lines marked *(optional)*.

Two speakers work well: **A** does slides 1 to 3, 4 and 5; **B** drives the live demo. One speaker is fine too.

---

## SLIDE 1: Title (0:00 to 0:11), Speaker A

**On screen:** *UrbanEye.* Subtitle: *Every answer traces back to a public source.* Small line: *Bay Hacks 2026 · UX University Challenge · Silver Spring, Maryland.*

> Every neighborhood has public data, and almost none of it is easy to use. Ask an AI about your neighborhood and it will often just make something up. UrbanEye is different: every answer traces back to a public source.

## SLIDE 2: The problem (0:11 to 0:27), Speaker A

**On screen:** three icons scattered, labeled *Census tables*, *Planning PDFs*, *Business listings*. Below: *Different boundaries. Different dates. No connection.* Persona line: *A resident, a shop owner, a city planner in Fenton Village.*

> If you want to open a shop in Fenton Village, or just understand where you live, the facts are scattered. Census tables, county planning documents, business listings, each with different boundaries and dates. We built one map that ties them together.

## SLIDE 3: How it works (0:27 to 0:45), Speaker A

**On screen:** a left-to-right flow: *Public data* → *Verified store* → *Retrieve the relevant passages* → *AI explains only those* → *Cited answer*. Under it: *Facts first. AI second.*

> Our principle is facts first, AI second. The platform holds the verified data and does the math. When you ask a question, we retrieve the relevant passages, and the model may only explain what we retrieved, with citations. If the evidence isn't there, it says so.

*(No-key wording for the middle sentence: "…we retrieve the exact passage and show it with its source. With an API key, a model explains only those passages.")*

---

## LIVE DEMO (0:45 to 2:22), Speaker B narrates over the screen recording

Start on the app, freshly loaded.

### 1. Real numbers, with honest uncertainty (0:45 to 1:05)

**Do:** click **Zoom to Fenton Village**. Click a block group near the *Fenton Village* label. Point at the **Census counts**, then scroll to the **Community profile** (median income, age 50+, household size, renters) and the small reliability note on one value. Open the **Evidence** tab and one source link.

> These are real Census block groups around Fenton Village. Counts come from the 2020 Census, and income, age and renters from the Census survey, with each source and date shown, and a warning when the margin of error is large.

### 2. Is this a good spot? (1:05 to 1:32) **[address part needs #17]**

**Do:** type `7720 Blair Road` in the top search box, press **Enter**, choose the result: a pin drops and the block group is selected. Then click **Is this a good spot for a business?** and point at the Business site brief and its "not a recommendation" line.

> Say you're eyeing a spot. Type an address, and we pin it and select the exact Census block group it sits in. Then the site brief shows the community context, people, income, renters and the businesses mapped nearby, and says plainly it's context, not a recommendation.

*Fallback if #17 is not merged:* skip the address, click a block group, then click **Is this a good spot for a business?**

### 3. A question that cites its source (1:32 to 1:52)

**Do:** click the suggested question **What does the Silver Spring plan say about affordable housing?** Wait for the answer. Point at the source chip (*Montgomery Planning, 2022, p. 92*) and the plan's caveat line. Click the chip to open the original document.

> Now ask what the county plan says about affordable housing. We retrieve the exact passage, page ninety-two of the 2022 Silver Spring plan, with the plan's own warning that its boundary isn't this Census area. The AI may only cite that passage.

*(No-key wording for the last sentence: "Here is the exact passage it retrieved.")*

### 4. It refuses to guess (1:52 to 2:00)

**Do:** type `Will population double next year?` and click **Ask**.

> And when the evidence can't support a question, it declines instead of guessing.

### 5. Real businesses (2:00 to 2:10)

**Do:** in the left panel tick **Storefront Locations**. The map zooms to the businesses. Click one marker.

> Turn on storefronts and you see two hundred forty-three real businesses from OpenStreetMap, labeled as mapped data, not an official registry.

### 6. Compare layers *(optional, 2:10 to 2:22; cut if over time)*

**Do:** open **Compare areas**, choose **Median household income** and **Residents age 50+**, click **Compare layers**.

> We can compare two layers, like income and age, across seventy-six block groups, with the sample size and a reminder that correlation is not causation.

---

## SLIDE 4: What's real, what's next (2:22 to 2:42), Speaker A

**On screen:** two columns. *Working today:* Census 2020 counts · ACS income, age and renters with margins of error · planning-document search with citations · OpenStreetMap businesses · layer comparison · business site brief (context, not a verdict) · address search. *Next:* transit and zoning overlays · an AI-assisted site evaluation · more documents and neighborhoods. Footer: *Provenance records and 200+ automated tests behind the data.*

> Everything you just saw is real data with a provenance record behind it, and more than two hundred automated tests. Next: transit and zoning overlays, and an AI-assisted site evaluation built on this same evidence. A new neighborhood is new data, not new code.

## SLIDE 5: Close (2:42 to 2:52), Speaker A

**On screen:** *UrbanEye.* *Every answer traces back to a public source.* Team names. Repo link.

> That's UrbanEye. Every answer traces back to a public source. Thank you.

---

## What NOT to say or show

- "Business evaluation," "viability score" or "AI recommends a location": the Business site brief is **context, not a recommendation**, and there is no AI-written site evaluation yet.
- Exact income or age figures from a block group flagged **low reliability (margin of error above 30%)**. Say "estimate", not "the exact figure".
- "All of Silver Spring": we cover the Silver Spring Census area and 80 block groups; the business counts are around the Fenton study areas. Four block groups have no income value.
- Foot traffic, rent, revenue: not in our data.
- Do not say the AI "knows" the neighborhood. Say it explains retrieved passages.
- Purple Line and zoning layers: not built; do not show or imply them.

## If something breaks on camera

| Problem | Do this |
| --- | --- |
| Answer is slow | Cut the wait in editing. Do not talk over a spinner. |
| No AI explanation (no key) | Use the no-key wording; the cited passage still shows and is honest. |
| Address search finds nothing | Try `8250 Georgia Avenue`, or use the fallback in step 2. |
| Map tiles missing | Refresh once; polygons and numbers still work without tiles. |
| Something else is wrong | Stop, reload, retake that clip only. |

## Devpost submission checklist (due 7:00 PM ET today)

- [ ] Project name and one-line description: *Evidence-first community intelligence for Silver Spring.*
- [ ] Track: **UX University Challenge** only (ElevenLabs and Render are not used; do not enter them).
- [ ] How it was built: React and Leaflet frontend, FastAPI backend, Census 2020 and ACS data, OpenStreetMap, retrieval over the 2022 plan, Gemini for grounded answers.
- [ ] Demo video link (2 to 3 minutes, under 3:00).
- [ ] Repo link, public.
- [ ] At least one team member at the Sunday 10 AM closing ceremony, in person.
- [ ] Submit by about 6 PM, not 6:59.

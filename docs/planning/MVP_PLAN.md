# Bay Hacks 2026 — Silver Spring Community Intelligence
# Full MVP Build Plan, Sprint Roadmap, and Demo Checkpoint

## 1. MVP Mission

Build a **working proof of concept for an AI-powered community intelligence platform** focused on **Silver Spring, Maryland**, with **Fenton Village** as the first real-world application.

The MVP must prove four things:

1. **Strong approach**  
   The product solves the fragmentation problem by connecting structured public data, geographic data, and unstructured public documents into one coherent system.

2. **Sound architecture**  
   The system clearly separates:
   - factual data retrieval and calculations,
   - document retrieval,
   - AI interpretation,
   - evidence presentation,
   - and the user interface.

3. **Working proof of concept that can keep growing**  
   The MVP should not be a throwaway demo. The data layer, retrieval layer, API boundaries, evidence model, and frontend interaction pattern should be reusable for future datasets, analyses, and applications.

4. **Evidence behind every answer**  
   The AI must not invent local facts. Every meaningful answer should be traceable to:
   - a structured dataset,
   - a calculated statistic,
   - a retrieved document passage,
   - or another explicit source used by the system.

---

# 2. Core Product Statement

> **An AI-powered community intelligence platform that makes fragmented public data visual, queryable, connected, and explainable.**

The MVP should let a user:

- Explore Fenton Village on an interactive map
- Turn public-data layers on and off
- Click a geographic area and inspect actual data
- Ask natural-language questions about the community
- Retrieve relevant evidence from public documents
- See which sources support the answer
- Compare at least two community variables
- Demonstrate that additional applications can be built on top of the same foundation

The business-planning feature is a **demonstration application**, not the core platform.

---

# 3. MVP Success Definition

The MVP is successful when a judge can watch the demo and clearly understand this loop:

```text
Explore the community
        ↓
Select an area or data layer
        ↓
Inspect real public data
        ↓
Ask a question
        ↓
System retrieves structured and/or document evidence
        ↓
AI explains the evidence
        ↓
User can inspect the sources behind the answer
```

The system should prove that:

> **Fragmented public data can be turned into a unified, evidence-backed community intelligence experience.**

---

# 4. Scope Priorities

## Must Have

These are required for the MVP to count as complete.

- Interactive Fenton Village map
- At least 2 reliable structured public-data layers
- Clickable geographic regions
- Supporting facts/data panel
- Natural-language question input
- RAG over at least a small set of public documents
- Evidence-backed AI response
- Source/evidence display
- Clear separation between facts and AI explanation
- One complete end-to-end demo path
- Stable enough to present without manual intervention

## Strongly Preferred

These significantly strengthen the project.

- 3–4 map layers
- Two-layer segmentation
- Simple correlation calculation
- Cross-linking structured map data with document retrieval
- Structured JSON response from the LLM
- Evidence cards that link answer claims to sources
- Business-analysis proof of concept

## Stretch

These are optional and should never delay the core demo.

- Multiple business types
- Competitor distance analysis
- Business acquisition analysis
- Saved views
- Persistent custom links
- User personalization
- Autonomous agents
- Multi-agent workflows
- More advanced recommendation scoring
- Large-scale document ingestion
- Live data pipelines
- Full production authentication

---

# 5. The Minimum Presentable Checkpoint

## HARD CHECKPOINT — "We Can Present This"

This checkpoint is the most important milestone in the hackathon.

Once this checkpoint is complete, the team already has a valid presentation even if no additional feature is finished.

### The checkpoint must include:

### A. Working Interactive Map

The user can:

- Open Fenton Village
- See geographic boundaries
- Turn on at least **two real data layers**
- Click an area
- See actual values for that area

Example:

```text
Selected Area: Census Block Group X

Population: 2,184
Age 65+: 17.2%
Median Household Income: $74,300

Sources:
- U.S. Census Bureau / ACS
- Geographic unit: Census Block Group
- Data year: [actual dataset year]
```

### B. Working Evidence Panel

Every selected area or AI answer exposes its evidence.

At minimum, the evidence panel should show:

- Source name
- Source type
- Geographic area
- Data year/date
- Actual value or retrieved passage
- Document title if applicable

### C. Working RAG Question

The user can ask one natural-language question about the community.

Example:

> "What do planning documents say about housing in this area?"

The system must:

1. Retrieve relevant document chunks
2. Pass those chunks to the LLM
3. Generate an answer based on the retrieved evidence
4. Show the evidence used

### D. AI Does Not Invent Community Facts

The LLM receives evidence from the platform.

The LLM's job is to:

- summarize,
- interpret,
- explain,
- and organize.

The LLM should **not** independently guess:

- population,
- income,
- business counts,
- geographic facts,
- competitor distances,
- housing statistics,
- or document claims.

### E. One Complete Demo Path

The team must be able to demonstrate this without changing code:

```text
Open map
→ Turn on a layer
→ Select an area
→ Show the underlying public data
→ Ask a community question
→ Receive an AI answer
→ Open the supporting evidence
```

---

# 6. Checkpoint Acceptance Criteria

The checkpoint is complete only if all of these pass:

- [ ] Application loads reliably
- [ ] Fenton Village is visible on the map
- [ ] At least two real data layers render
- [ ] Clicking an area returns actual structured data
- [ ] Source metadata is displayed
- [ ] At least one public document has been parsed and indexed
- [ ] Natural-language question reaches the backend
- [ ] Retrieval returns relevant document evidence
- [ ] LLM answer is generated from retrieved evidence
- [ ] Retrieved source evidence is visible in the UI
- [ ] The answer does not rely on unsupported model knowledge
- [ ] A full demo can be completed from start to finish
- [ ] No unfinished feature is required for the demo to make sense

If all boxes above are checked, **stop adding risky infrastructure until the checkpoint build is committed and preserved.**

---

# 7. MVP Architecture

## 7.1 High-Level Architecture

```text
                  PUBLIC DATA SOURCES
                          │
          ┌───────────────┴────────────────┐
          │                                │
          ▼                                ▼
 Structured Public Data            Unstructured Documents
 Census / ACS                       Planning documents
 GIS boundaries                     Government reports
 Housing                             Surveys
 Businesses                         Community studies
          │                                │
          ▼                                ▼
 Normalize / Clean                 Parse / Chunk / Tag
          │                                │
          ▼                                ▼
 Structured Community Store        Retrieval / Vector Index
          │                                │
          └───────────────┬────────────────┘
                          ▼
                  BACKEND ORCHESTRATOR
                          │
          ┌───────────────┼────────────────┐
          │               │                │
          ▼               ▼                ▼
 Geographic Query    Statistical Logic     Retrieval
          │               │                │
          └───────────────┬────────────────┘
                          ▼
                   Evidence Context
                          │
                          ▼
                     LLM Layer
                          │
                  Structured Response
                          │
                          ▼
                 Evidence-Backed UI
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
         Map          Data Panel        AI Answer
                                          │
                                          ▼
                                      Evidence
```

---

# 8. Architecture Principle: Facts First, AI Second

The most important technical rule is:

> **The platform provides facts. The AI interprets those facts.**

## Platform Responsibilities

The application is responsible for:

- Loading public datasets
- Normalizing them
- Associating values with geography
- Filtering data
- Calculating statistics
- Calculating correlations
- Finding nearby businesses
- Calculating distances
- Retrieving document chunks
- Recording source metadata
- Constructing the LLM context
- Displaying evidence

## AI Responsibilities

The AI is responsible for:

- Summarizing supplied evidence
- Explaining patterns
- Answering natural-language questions
- Connecting retrieved facts into readable explanations
- Producing structured output
- Identifying relevant strengths, concerns, or observations when asked

## AI Should Not Be Responsible For

- Inventing local facts
- Guessing demographic values
- Guessing what businesses are nearby
- Guessing distances
- Guessing what a public document says
- Performing calculations that the application can perform deterministically

---

# 9. Recommended MVP Technical Stack

This is a recommended implementation, not a required product constraint.

## Frontend

- Next.js
- React
- TypeScript
- MapLibre GL JS, Mapbox GL JS, or Leaflet
- Simple component library if needed

Frontend responsibilities:

- Map rendering
- Layer toggles
- Area selection
- Query box
- Evidence drawer
- Answer cards
- Segmentation controls

## Backend

- FastAPI
- Python
- Pydantic schemas

Backend responsibilities:

- Serve normalized geographic data
- Query selected area data
- Run calculations
- Retrieve RAG context
- Construct LLM prompts
- Validate LLM structured output
- Return evidence alongside answers

## Structured Data Storage

For the hackathon:

- Preprocessed GeoJSON
- JSON/CSV
- SQLite if relational queries are useful

Avoid building a complex production database unless it is necessary.

## RAG Storage

Use a lightweight vector solution appropriate for a hackathon.

Possible choices:

- Chroma
- FAISS
- another local vector store

Each chunk should retain metadata such as:

```json
{
  "document_title": "...",
  "source_url": "...",
  "page": 12,
  "section": "...",
  "geography": "Fenton Village",
  "date": "..."
}
```

## LLM

Use an API-capable model that supports:

- reliable instruction following,
- structured output / JSON,
- fast enough responses for a live demo.

---

# 10. Data Strategy

## 10.1 Structured Data

Prioritize a small number of reliable datasets rather than many incomplete datasets.

Recommended initial categories:

1. Population
2. Age
3. Household income
4. Housing
5. Businesses, if available

The checkpoint only requires at least **two good layers**.

A stronger MVP should target **3–4**.

## 10.2 Unstructured Data

Start with a small curated document set.

Examples from the project vision:

- Silver Spring planning documents
- Community plans
- Housing reports
- Public surveys
- Government reports

The goal is not document quantity.

The goal is to prove:

> **The system can retrieve a relevant piece of local evidence and use it in an answer.**

---

# 11. Common Geographic Key

Structured datasets should be normalized around a common geographic identifier whenever possible.

Examples:

- Census block group
- Census tract
- neighborhood polygon
- another consistent geographic unit

A normalized community record can conceptually look like:

```json
{
  "geo_id": "...",
  "name": "...",
  "geometry": "...",
  "population": 0,
  "age_65_plus_pct": 0.0,
  "median_household_income": 0,
  "housing_units": 0,
  "business_count": 0,
  "sources": [
    {
      "dataset": "...",
      "year": "...",
      "url": "..."
    }
  ]
}
```

This becomes the base object used by:

- the map,
- evidence panels,
- segmentation,
- statistical analysis,
- and future applications.

---

# 12. Evidence Model

Evidence should be treated as a first-class object in the application.

Every answer should return both:

1. The explanation
2. The supporting evidence

Example:

```json
{
  "answer": "This area contains a relatively high concentration of older residents...",
  "evidence": [
    {
      "type": "structured_data",
      "source": "U.S. Census Bureau ACS",
      "geo_id": "...",
      "metric": "Age 65+",
      "value": "17.2%",
      "year": "..."
    },
    {
      "type": "document",
      "document_title": "...",
      "page": 24,
      "excerpt": "...",
      "source_url": "..."
    }
  ]
}
```

This evidence object is one of the most important parts of the MVP because it directly supports the challenge requirement that the system **show the evidence behind its answers**.

---

# 13. Core API Surface

Keep the backend interface small.

Possible MVP endpoints:

```text
GET  /health
GET  /areas
GET  /areas/{geo_id}
GET  /layers
POST /segment
POST /ask
POST /business/evaluate     # optional after checkpoint
```

## `/areas/{geo_id}`

Returns:

- geographic information
- layer values
- source metadata

## `/segment`

Input:

```json
{
  "layer_a": "age_65_plus_pct",
  "layer_b": "median_household_income"
}
```

Returns:

- per-area values
- overlap result
- correlation value if implemented
- supporting evidence metadata

## `/ask`

Input:

```json
{
  "question": "What do planning documents say about housing in this area?",
  "geo_id": "..."
}
```

Backend flow:

```text
Question
→ Retrieve relevant structured context
→ Retrieve relevant document chunks
→ Build evidence bundle
→ Send bundle to LLM
→ Validate structured answer
→ Return answer + evidence
```

---

# 14. RAG Pipeline

```text
Public PDF / Report
        ↓
Text extraction
        ↓
Clean text
        ↓
Chunk document
        ↓
Attach metadata
        ↓
Generate embeddings
        ↓
Store in vector index
        ↓
User asks question
        ↓
Retrieve top relevant chunks
        ↓
Pass chunks + structured area context to LLM
        ↓
Generate answer
        ↓
Return answer + source evidence
```

## RAG Requirement

Every retrieved chunk should preserve enough metadata to answer:

> "Where did this come from?"

At minimum:

- document name
- page or section when possible
- source link
- date when available

---

# 15. Natural-Language Query Rules

The query system should be intentionally constrained.

Good MVP questions:

- "What do planning documents say about housing in this area?"
- "What information do we have about this neighborhood?"
- "What does the data show about age and income here?"
- "Which areas have higher concentrations of older residents?"
- "What evidence supports this observation?"

Avoid promising that the MVP can answer every possible question.

The demo should use questions the system is designed to answer reliably.

---

# 16. Map UX

## Main Layout

Recommended:

```text
┌──────────────────────────────────────────────────────────┐
│ Header / Product Name                                    │
├─────────────┬───────────────────────────────┬────────────┤
│ Layer Panel │                               │ Evidence / │
│             │             MAP               │ AI Panel   │
│ Age         │                               │            │
│ Income      │                               │ Facts      │
│ Housing     │                               │ Answer     │
│ Businesses  │                               │ Sources    │
│             │                               │            │
├─────────────┴───────────────────────────────┴────────────┤
│ Ask the community: [____________________________] [Ask] │
└──────────────────────────────────────────────────────────┘
```

## User Actions

The user should be able to:

- toggle a layer,
- click an area,
- inspect facts,
- select two variables,
- ask a question,
- inspect evidence.

---

# 17. Segmentation MVP

Segmentation compares two selected community variables.

Example:

- Age 50+
- Income $30K+

The MVP can:

1. Normalize both values
2. Display them together on the map
3. Highlight areas where both exceed selected thresholds
4. Show the underlying values
5. Optionally calculate Pearson correlation across geographic units

Core output:

```text
Selected Variables:
Age 50+
Median Household Income

Overlap:
5 geographic areas meet both criteria

Correlation:
r = ...

Interpretation:
Association only; not evidence of causation.
```

Segmentation is valuable, but it should come **after the presentable checkpoint** if time becomes constrained.

---

# 18. Business Module — Optional Application Layer

After the community-intelligence core works, add one application that proves the architecture can grow.

The best candidate from the project vision is:

> **AI-assisted business location evaluation**

This should be presented as:

> "Now that the community intelligence layer exists, this is one thing we can build on top of it."

---

# 19. Business Module MVP Flow

```text
Select business type
        ↓
Place/select candidate location
        ↓
Identify surrounding geographic area
        ↓
Pull structured community facts
        ↓
Find nearby competitors if dataset exists
        ↓
Retrieve useful planning context
        ↓
Build evidence bundle
        ↓
LLM generates structured evaluation
        ↓
Show analysis + evidence
```

Example structured response:

```json
{
  "summary": "...",
  "strengths": ["..."],
  "concerns": ["..."],
  "customer_context": "...",
  "competition_context": "...",
  "evidence_ids": ["ev_1", "ev_2", "ev_3"]
}
```

Do not make business evaluation necessary for the checkpoint build.

---

# 20. Sprint Plan

The sprint plan is designed so that the project becomes presentable **before** the hackathon ends.

---

## Sprint 0 — Scope Lock and Data Confirmation
### Target: Hour 0–1

### Goal

Prevent the team from losing time on too many datasets or features.

### Tasks

- [ ] Freeze Fenton Village as MVP geography
- [ ] Choose 2 required structured layers
- [ ] Choose 1–2 additional layers if easy
- [ ] Choose small document set for RAG
- [ ] Confirm that the selected datasets can actually be downloaded/processed
- [ ] Define common geographic unit
- [ ] Define evidence metadata fields
- [ ] Define the exact checkpoint demo question
- [ ] Freeze non-MVP features

### Exit Criteria

The team knows:

- what data is being used,
- what geography is being displayed,
- what question the RAG demo will answer,
- and what is explicitly postponed.

---

## Sprint 1 — Data Foundation
### Target: Hour 1–5

### Goal

Create one clean community dataset that everything else can build on.

### Tasks

- [ ] Download selected structured datasets
- [ ] Clean missing/invalid values
- [ ] Normalize geographic identifiers
- [ ] Join data to geographic boundaries
- [ ] Export frontend-ready GeoJSON/JSON
- [ ] Preserve source name and year for every metric
- [ ] Prepare at least one public document
- [ ] Extract document text
- [ ] Chunk document text
- [ ] Attach source metadata
- [ ] Build initial vector index

### Required Deliverables

```text
/data
  /processed
    fenton_areas.geojson
    community_metrics.json

/documents
  /processed
    chunks.json

/vector_store
```

### Exit Criteria

- [ ] One clean geographic dataset can be loaded
- [ ] Two real metrics exist per area
- [ ] Data source metadata is preserved
- [ ] RAG chunks can be retrieved from at least one document

---

## Sprint 2 — Map + Evidence Backbone
### Target: Hour 5–9

### Goal

Make the public data visually explorable.

### Backend

- [ ] Build `/areas`
- [ ] Build `/areas/{geo_id}`
- [ ] Build `/layers`
- [ ] Return evidence metadata with area data

### Frontend

- [ ] Render Fenton Village
- [ ] Render first layer
- [ ] Render second layer
- [ ] Add layer toggles
- [ ] Make geographic areas clickable
- [ ] Add details/evidence panel

### Exit Criteria

The user can:

```text
Open map
→ select layer
→ click area
→ see real metric values
→ see where those metrics came from
```

At this point the project already demonstrates the **visual community intelligence foundation**.

---

## Sprint 3 — RAG + Evidence-Backed AI
### Target: Hour 9–13

### Goal

Complete the minimum end-to-end intelligence loop.

### Tasks

- [ ] Build retrieval function
- [ ] Retrieve top document chunks
- [ ] Combine current area context with retrieved chunks
- [ ] Build strict LLM system prompt
- [ ] Require structured JSON output
- [ ] Validate output server-side
- [ ] Build `/ask`
- [ ] Add question box to frontend
- [ ] Render AI answer
- [ ] Render evidence used by answer
- [ ] Add graceful error states

### Required AI Rule

The prompt should clearly state:

```text
Use only the evidence provided.
Do not invent local facts.
If the evidence does not answer the question, say that the available evidence is insufficient.
```

### Exit Criteria

The user can:

```text
Select area
→ ask question
→ retrieval finds evidence
→ AI answers from evidence
→ UI shows supporting sources
```

---

# 21. CHECKPOINT BUILD — FREEZE THIS VERSION

## Target: Approximately Hour 13

At this moment:

### STOP.

Commit/tag a stable version.

Example:

```text
checkpoint-demo
```

This build must remain available even if later work breaks.

## What This Build Proves

### Strong Approach

The team is not building another generic chatbot.

It is connecting:

- public structured data,
- geography,
- public documents,
- retrieval,
- AI explanation,
- and evidence.

### Sound Architecture

The build demonstrates clear separation between:

```text
Data
→ Retrieval / Deterministic Logic
→ Evidence Bundle
→ LLM Interpretation
→ User Interface
```

### Working Proof of Concept

A real user interaction goes all the way from:

```text
community data
→ map
→ question
→ retrieval
→ AI answer
→ evidence
```

### Future Growth

The same architecture can later support:

- segmentation,
- correlation,
- business analysis,
- real-estate analysis,
- saved dashboards,
- more documents,
- more cities,
- agents,
- personalized responses.

### Evidence Behind Answers

The user can inspect:

- exact dataset,
- values,
- document,
- retrieved passage,
- date/year,
- geographic context.

This checkpoint alone is a valid hackathon presentation.

---

# 22. Sprint 4 — Analysis Layer
### Target: Hour 13–17

### Goal

Turn the map from a viewer into an analysis tool.

### Tasks

- [ ] Add two-variable selection
- [ ] Implement segmentation
- [ ] Add overlap visualization
- [ ] Show raw values for both variables
- [ ] Calculate correlation if appropriate
- [ ] Display correlation interpretation
- [ ] Preserve source evidence

### Exit Criteria

The user can:

```text
Select Variable A
+ Select Variable B
→ see geographic relationship
→ inspect the numbers
→ see supporting sources
```

Example demo:

```text
Age 50+
+
Income $30K+
→ overlap map
→ supporting values
→ correlation
```

---

# 23. Sprint 5 — One Application Built on Top
### Target: Hour 17–20

### Goal

Demonstrate platform extensibility.

Preferred feature:

**Business Planning / Site Evaluation**

### Minimum Version

- [ ] Choose one business category
- [ ] Select or place one candidate location
- [ ] Gather nearby community metrics
- [ ] Include businesses/competitors if data exists
- [ ] Build business evidence bundle
- [ ] Generate structured AI evaluation
- [ ] Show evidence used

### Demo Transition

Use this language:

> "The community intelligence layer is the product foundation. Once that data is connected and queryable, we can build specialized applications on top of it. Here's one example."

Then show the business analysis.

### Exit Criteria

The business module reuses the same:

- data layer,
- geography,
- retrieval system,
- evidence model,
- LLM layer.

It should **not** be a separate hacked-together system.

---

# 24. Sprint 6 — Demo Hardening and UX Polish
### Target: Hour 20–24

### Goal

Stop building and make the demo reliable.

### Tasks

- [ ] Freeze feature development
- [ ] Test complete demo path repeatedly
- [ ] Fix broken UI states
- [ ] Add loading indicators
- [ ] Add readable source labels
- [ ] Improve map legend
- [ ] Improve evidence drawer
- [ ] Confirm all numbers match source data
- [ ] Test RAG answer
- [ ] Test fallback when retrieval is weak
- [ ] Verify no unsupported AI claims
- [ ] Prepare backup screenshots/video
- [ ] Prepare architecture diagram
- [ ] Prepare 2-minute demo story
- [ ] Tag final stable build

---

# 25. Team Workstreams

Instead of having everyone touch the same feature, divide work by system boundary.

## Workstream A — Data / GIS

Owns:

- dataset collection
- cleaning
- geographic joins
- GeoJSON
- normalized schema
- source metadata

## Workstream B — Backend / Orchestration

Owns:

- FastAPI
- data endpoints
- geographic queries
- calculations
- prompt construction
- structured responses

## Workstream C — AI / RAG

Owns:

- document parsing
- chunking
- embeddings
- retrieval
- RAG quality
- grounding rules
- answer/evidence mapping

## Workstream D — Frontend / Map

Owns:

- map
- layers
- layer toggles
- selection
- evidence drawer
- question box
- answer rendering

All workstreams meet at the **checkpoint acceptance criteria**, not at feature completion.

---

# 26. Demo Dataset Rule

Do not optimize for dataset quantity.

A better demo is:

```text
3 clean datasets
+ 2 strong documents
+ correct evidence
+ reliable interactions
```

than:

```text
12 partially integrated datasets
+ broken joins
+ uncertain sources
+ unreliable answers
```

The MVP should prove the system design, not exhaust every possible source.

---

# 27. Demo Story

## Step 1 — Explain the Problem

> "Community information exists, but it is fragmented across Census data, GIS systems, public reports, business data, and planning documents."

## Step 2 — Show the Unified Map

Open Fenton Village.

Toggle:

- Age
- Income
- another available layer

Explain:

> "We normalize these separate datasets into a common geographic layer."

## Step 3 — Click an Area

Show:

- population
- demographic value
- income
- source
- data year

Explain:

> "The map never hides the source data. Every visualization can be inspected."

## Step 4 — Ask the Community

Ask:

> "What do planning documents say about housing in this area?"

Show:

- retrieved evidence
- AI explanation
- document/page/source

Explain:

> "The AI is not being asked to know Silver Spring from memory. Our system retrieves the evidence first and the model interprets that evidence."

## Step 5 — Show Analysis

If Sprint 4 is complete:

- select two layers,
- show overlap,
- show correlation,
- inspect values.

## Step 6 — Show Extension

If Sprint 5 is complete:

> "Now that the community intelligence layer exists, we can build applications on top."

Show business evaluation.

## Step 7 — Close With Growth

Show future architecture:

```text
Community Intelligence Core
        ↓
More Data
        ↓
More Geographic Areas
        ↓
Specialized Applications
        ↓
Agents / Personalization / Monitoring
```

---

# 28. Judge-Facing Technical Story

If asked **"What is technically interesting here?"**

Answer:

> We separate deterministic community facts from AI reasoning. Structured geographic data is normalized and queried directly, while unstructured planning documents are retrieved through RAG. The backend builds an evidence bundle from those sources before calling the model. The model interprets that bundle, and the UI exposes the evidence supporting the answer.

If asked **"How do you avoid hallucination?"**

Answer:

> The model is not responsible for discovering local facts. The system retrieves and calculates those facts first. We constrain the model to the supplied evidence and return the supporting sources with the answer.

If asked **"How does this scale beyond the demo?"**

Answer:

> New structured datasets can be normalized into the community data layer, and new public documents can be indexed into the retrieval layer. Applications such as business analysis, planning research, real-estate analysis, or personalized agents can reuse the same evidence and query architecture.

---

# 29. Failure-Safe Design

Hackathon demos should degrade gracefully.

## If the LLM API fails

Still show:

- map,
- layers,
- selected-area data,
- evidence,
- retrieved document chunks.

## If RAG quality is weak

Use a curated demo question and a small document collection.

## If segmentation is unfinished

Do not include it in the primary demo.

## If the business feature is unfinished

Do not include it in the primary demo.

## If one dataset is unreliable

Remove the layer.

The checkpoint build should remain untouched.

---

# 30. Definition of Done for Core Features

## Map

- [ ] Correct geographic boundaries
- [ ] At least two real layers
- [ ] Legend is understandable
- [ ] Area is clickable
- [ ] Selected values are visible
- [ ] Source metadata is visible

## RAG

- [ ] Documents are chunked
- [ ] Metadata preserved
- [ ] Retrieval returns relevant chunks
- [ ] Answer uses retrieved context
- [ ] Source evidence is displayed

## AI

- [ ] Prompt restricts model to supplied evidence
- [ ] Structured output used
- [ ] Missing evidence is handled honestly
- [ ] No hidden unsupported local claims
- [ ] Evidence IDs map back to UI sources

## Evidence

- [ ] Structured-data source is visible
- [ ] Data year/date is visible
- [ ] Document title is visible
- [ ] Document page/section is shown when available
- [ ] User can distinguish fact from AI explanation

---

# 31. Recommended Repository Structure

```text
/
├── frontend/
│   ├── components/
│   ├── map/
│   ├── evidence/
│   ├── query/
│   └── services/
│
├── backend/
│   ├── api/
│   ├── data/
│   ├── geo/
│   ├── rag/
│   ├── llm/
│   ├── schemas/
│   └── services/
│
├── data/
│   ├── raw/
│   └── processed/
│
├── documents/
│   ├── raw/
│   └── processed/
│
├── scripts/
│   ├── clean_data.py
│   ├── build_geojson.py
│   └── build_index.py
│
├── tests/
│
├── docker-compose.yml
└── README.md
```

---

# 32. Suggested Core Schemas

## Geographic Area

```json
{
  "geo_id": "...",
  "name": "...",
  "metrics": {
    "population": 0,
    "age_65_plus_pct": 0.0,
    "median_household_income": 0
  },
  "sources": []
}
```

## Evidence

```json
{
  "evidence_id": "ev_123",
  "type": "structured_data",
  "title": "...",
  "source": "...",
  "url": "...",
  "date": "...",
  "geo_id": "...",
  "metric": "...",
  "value": "...",
  "excerpt": null,
  "page": null
}
```

## AI Answer

```json
{
  "summary": "...",
  "observations": [
    "..."
  ],
  "limitations": [
    "..."
  ],
  "evidence_ids": [
    "ev_123",
    "ev_456"
  ]
}
```

---

# 33. Testing Priorities

Focus testing on the demo-critical path.

## Data Tests

- Geographic IDs align
- Numeric fields parse correctly
- Missing values are handled
- Source metadata exists

## Retrieval Tests

Use 3–5 known questions and manually verify:

- expected document is retrieved
- expected passage appears
- metadata survives retrieval

## AI Tests

Verify:

- answer references supplied evidence
- answer does not fabricate local facts
- unsupported question gets an uncertainty response

## UI Tests

Verify:

- layer toggle
- area selection
- evidence drawer
- query submission
- answer rendering
- failure/loading states

---

# 34. What Not to Build Before the Checkpoint

Do not spend checkpoint-critical time on:

- login/authentication
- user accounts
- saved dashboards
- HTML export
- autonomous agents
- complex business scoring
- acquisition financial analysis
- multiple cities
- streaming ingestion
- elaborate database infrastructure
- custom recommendation engines
- advanced animations
- large design systems
- dozens of map layers

These can be shown on the roadmap.

---

# 35. Post-MVP Growth Path

The architecture should visibly support future levels.

## Level 0 — Presentable Core

```text
Map
+ Public Data
+ Clickable Areas
+ Evidence
+ RAG Question
+ Evidence-Backed AI Answer
```

## Level 1 — Community Analysis

```text
Segmentation
+ Correlation
+ Cross-Linked Views
+ More Natural-Language Queries
```

## Level 2 — Specialized Applications

```text
Business Planning
+ Competitor Analysis
+ Site Evaluation
+ Existing Business Analysis
```

## Level 3 — Personalization

```text
Saved Views
+ Custom Dashboards
+ User Preferences
+ Personalized Answers
```

## Level 4 — Agents

```text
Community Research Agent
+ Business Analysis Agent
+ Planning Document Agent
+ Monitoring Agent
```

The key message is:

> **Agents come after the evidence-backed community knowledge layer works.**

---

# 36. Final MVP Feature Matrix

| Feature | Checkpoint | Full MVP | Stretch |
|---|:---:|:---:|:---:|
| Fenton Village map | ✅ | ✅ | |
| 2 structured layers | ✅ | ✅ | |
| 3–4 structured layers | | ✅ | |
| Click area for data | ✅ | ✅ | |
| Source metadata | ✅ | ✅ | |
| RAG | ✅ | ✅ | |
| Natural-language question | ✅ | ✅ | |
| Evidence-backed AI answer | ✅ | ✅ | |
| Evidence drawer | ✅ | ✅ | |
| Two-layer segmentation | | ✅ | |
| Correlation | | ✅ | |
| Business placement | | Optional | ✅ |
| Competitor analysis | | Optional | ✅ |
| AI business evaluation | | Optional | ✅ |
| Saved views | | | ✅ |
| Personalization | | | ✅ |
| Agents | | | ✅ |

---

# 37. Final Build Priority

If time collapses, prioritize in this exact order:

```text
1. Reliable data
2. Map
3. Evidence
4. RAG retrieval
5. AI answer grounded in evidence
6. Presentable checkpoint
7. Segmentation
8. Correlation
9. Business application
10. Polish
11. Stretch features
```

Never sacrifice the first six for the later items.

---

# 38. Final MVP Statement

> **The Bay Hacks MVP is a working community-intelligence proof of concept for Fenton Village that unifies structured public data and unstructured public documents into one interactive system. Users can visually explore community data, inspect the underlying evidence, ask natural-language questions, and receive AI explanations grounded in retrieved public sources. The architecture separates deterministic facts from AI interpretation so the system remains explainable and extensible. Once the core community-intelligence layer works, the same foundation can support segmentation, correlation analysis, business evaluation, personalized experiences, and future agent-based applications.**

---

# 39. The Standard the Team Should Optimize For

Do not optimize for:

> **"How many features did we build?"**

Optimize for:

> **"Can we clearly prove that our approach works, our architecture makes sense, our system answers a real question, the answer is grounded in evidence, and this foundation can keep growing?"**

If the answer to those questions is yes, the MVP has accomplished its purpose.

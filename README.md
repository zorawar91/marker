# Marker — your health reports, finally readable

Marker is a comprehension and trend layer over lab-report PDFs. Upload reports from
any lab, across any number of years; Marker extracts every biomarker, normalizes
values across differing lab formats onto a single timeline, plots a trend per
marker, flags what's drifting, explains each marker in plain English, and generates
a list of questions to ask your doctor.

**Marker is not diagnostic.** It explains and trends your own results; it never
interprets them as a diagnosis or recommends treatment, and a disclaimer is shown
on every screen.

## The hero demo

Click **Try with sample reports** on the landing page: three synthetic reports
across three years load instantly and produce a full dashboard — a rising LDL /
cholesterol trend flagged as "worth a look", a recovering Vitamin D flagged as
"improving", per-marker trend charts with shaded reference bands, and a generated
doctor-questions list. No API key or real reports needed for the sample flow.

## Architecture

- **Next.js (App Router) + React + TypeScript**, Tailwind v4, Recharts for charts.
- **Extraction runs server-side** in a single API route (`src/app/api/extract/route.ts`).
  The browser never sees the API key — it POSTs a PDF to the route, which proxies to
  the Claude API and returns structured JSON. This route is the "thin serverless proxy"
  the design called for; on Vercel it deploys with the app.
- **Client-side state, local persistence.** Extracted reports live in the browser's
  local storage (`src/lib/storage.ts`). Uploaded PDFs are streamed to the extraction
  service and never stored server-side. The data model is deliberately serializable so
  it can later move to a backend without a rewrite.

### Extraction approach

The PDF is sent **natively** to Claude (`claude-opus-4-8`) as a document content block —
no separate text-extraction pre-step. This one pipeline handles both text-layer and
semi-scanned pages, and works across arbitrary lab formats without per-lab templates.
The model returns a **structured JSON** object (enforced with a JSON schema) containing
each test's name, value, unit, and printed reference range, plus the report date, lab,
patient name, and country.

Key rules the extractor follows (see the system prompt in the route):

- **It never converts units or computes values** — it transcribes exactly what's printed.
  All unit conversion is done in code (`src/lib/normalize.ts`) against explicit
  per-marker conversion factors, so the model never does unit math.
- **Dates are disambiguated by country.** Indian labs print `DD/MM/YYYY`, US labs
  `MM/DD/YYYY`. The model infers the country and returns the date three ways (printed,
  ISO, and an `ambiguous` flag); genuinely unresolvable dates are surfaced as a warning.
- **Non-lab / unreadable PDFs are rejected** with a specific, human-readable reason
  naming the file (password-protected, scanned image, invoice, etc.).

### Normalization & classification

- `src/lib/biomarkers.ts` — the canonical biomarker dictionary (~35 analytes across
  lipids, glucose/HbA1c, thyroid, CBC, LFT, KFT, vitamins). Each entry declares one
  canonical unit + conversion factors, synonyms for cross-lab name matching, a
  population reference range (fallback only), and a static plain-English explanation.
- `src/lib/normalize.ts` — resolves printed test names to canonical markers, converts
  units, parses each report's own printed reference range (preferred over the
  population range), and derives high/low/normal status.
- `src/lib/classify.ts` — classifies each marker's trajectory into
  **improving / stable / watching / concern** from % change and position vs. range,
  plus a "notable values" tier (>2× upper or <0.5× lower limit). Language stays neutral
  and names no disease.
- `src/lib/questions.ts` — generates doctor questions by slotting the user's actual
  values and trends into reviewed **templates**, so the entire medical-language surface
  stays static and auditable (no per-user LLM generation of medical claims).

## Running locally

```bash
npm install
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY for live extraction
npm run dev                        # http://localhost:3000
```

The **sample-report flow works without an API key**. A key is only needed to extract
your own uploaded PDFs.

## Status

Portfolio v1. Implemented: multi-PDF upload with per-file error handling, native-PDF
AI extraction, cross-lab normalization, per-marker trend charts with shaded reference
bands, single-report fallback view, four-state trend classification, notable-values
alert, static plain-English explanations, template-based doctor questions, persistent
disclaimer, local persistence with delete-all, and the bundled sample flow.

Not in v1 (by design): accounts/sync, report sharing, OCR for scanned/photographed
reports, multi-person profiles, inline value correction. The data model and extraction
pipeline are structured so these slot in later.

# GenAI Cost Simulator

**Enterprise planning tool for LLM-powered applications.**

Estimate infrastructure, model, and retrieval costs before deploying AI systems. Compare models, optimise spend, and make informed infrastructure decisions — all in one place.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — click **Launch Simulator**.

## What Makes This Different

This is not a `tokens × price` calculator. It simulates the **full GenAI application stack**:

```
User → Web UI → Load Balancer → Cloud Run/GKE → Vertex AI (Gemini)
                                              → Embeddings → Vector Search
                                              → BigQuery (Analytics)
                                              → Cloud Logging & Monitoring
```

### 6-Layer Cost Model

| Layer | What it covers |
|---|---|
| **Model Inference** | LLM input/output token costs |
| **Embeddings** | Document indexing + query embeddings (RAG) |
| **Vector Database** | Storage + query costs (dimension-aware sizing) |
| **Infrastructure** | Hosting overhead (Cloud Run / GKE), burst multipliers |
| **Networking** | Data transfer between services |
| **Observability** | Logging, monitoring, tracing |

## Features

| Feature | Description |
|---|---|
| **Architecture-Aware Simulation** | Costs reflect how GenAI apps are actually deployed |
| **Model Comparison (Quality vs Cost)** | Rank by Lowest Cost, Balanced, or Highest Quality |
| **GCP Architecture Diagram + Cost Overlay** | Mermaid diagram with per-node cost labels |
| **Optimisation Insights** | Rule-based recommendations with savings estimates |
| **Top Cost Lever** | Single highest-impact action highlighted prominently |
| **Token Budget Analysis** | Completion-to-prompt ratio diagnostic with savings estimate |
| **Vector DB Size Estimator** | Dimension-aware storage size calculation |
| **Enterprise Guardrails** | Warning alerts for cost overruns, token imbalance, large indexes |
| **12-Month Growth Projection** | Configurable MAU growth rate with line chart |
| **Sensitivity Analysis** | ±20% token variance impact |
| **Scenario Compare + Auto-Optimise** | Save, load, compare, and auto-generate optimised configs |
| **Telemetry Schema** | Recommended metrics to log (BigQuery-ready) |
| **Export Pack** | CSV, formatted summary, and exec brief for email |
| **Demo Mode** | One-click demo load with Enterprise Burst preset |
| **7 Enterprise Presets** | Realistic scenarios across Vertex-first, multi-cloud, agentic, and baseline |

## Enterprise Presets

- Customer Support RAG (Mid-scale) — Vertex-first
- Customer Support RAG (Enterprise + Burst) — Vertex-first
- Internal Knowledge Assistant (Low Latency) — Vertex-first
- Ops Agent (Tool-use + Summaries) — Agentic
- Basic Chat (No RAG) — Baseline
- Code Assistant (GKE, High Tokens) — Vertex-first
- Document Search (GPT-4o + Pinecone) — Multi-cloud

## Supported Models

| Model | Provider | Quality | Latency | Notes |
|---|---|---|---|---|
| Gemini 1.5 Pro | Google | Best (5) | High | Higher quality reasoning |
| Gemini 1.5 Flash | Google | Good (3) | Low | Best cost/latency |
| GPT-4o | OpenAI | Strong (4) | Med | Cross-platform baseline |
| Claude 3.5 Sonnet | Anthropic | Strong (4) | Med | Strong writing + reasoning |
| Llama 3 70B | Meta (self-hosted) | Good (3) | Var | Infra-driven cost |

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Material UI 7** (Google Cloud-inspired design)
- **Recharts** (pie, bar, and line charts)
- **Mermaid** (architecture diagrams with cost overlay)
- **react-hook-form + Zod** (forms + validation)
- **Vitest** (21 unit tests across engine, comparison, insights, guardrails, projection)

## Project Structure

```
src/
  app/
    page.tsx                  # Landing page
    simulator/page.tsx        # Simulator
    api/simulate/route.ts     # REST API (structured JSON logs)
  components/
    simulator/
      SimulatorPage.tsx       # Main orchestrator
      InputPanel.tsx          # All input cards
      ResultsPanel.tsx        # Results, charts, insights, guardrails
      ModelComparisonTable.tsx # Cross-model comparison (3 ranking modes)
      ArchitecturePanel.tsx   # GCP architecture diagram
      TelemetryPanel.tsx      # Telemetry schema
      AssumptionsDrawer.tsx   # Formulas + assumptions + pricing version
    charts/
      CostBreakdownChart.tsx  # Donut chart
      SensitivityChart.tsx    # Bar chart
      GrowthProjectionChart.tsx # 12-month line chart
      MermaidDiagram.tsx      # Mermaid renderer
  lib/
    cost/
      engine.ts               # 6-layer cost engine
      insights.ts             # Optimisation insights + top lever + token budget
      comparison.ts           # Cross-model comparison (3 modes)
      architecture.ts         # Architecture template matching + cost overlay
      guardrails.ts           # Enterprise guardrail warnings
      projection.ts           # 12-month growth projection
      optimize.ts             # Auto-optimise + exec brief
      pricing.ts              # Pricing config loader
      schema.ts               # Zod schemas + TypeScript types
      __tests__/engine.test.ts # Vitest test suite
    scenarios/storage.ts      # localStorage CRUD
    format.ts                 # Number formatting
  data/
    pricing.default.json      # Pricing config (versioned, editable)
    presets.json              # Enterprise scenario presets
    architecture_templates.json # GCP architecture templates
```

## API

```bash
POST /api/simulate
Content-Type: application/json
```

Returns: `result`, `insights`, `warnings`.

### Structured Logs (Cloud Logging compatible)

```json
{
  "timestamp": "2025-01-15T12:00:00Z",
  "requestId": "uuid",
  "modelId": "gemini_1_5_pro",
  "hosting": "cloud_run",
  "presetId": null,
  "totalMonthlyCost": 5900,
  "costPerRequest": 0.0017,
  "monthlyRequests": 3500000,
  "warningCount": 1
}
```

## Testing

```bash
npm test        # Run all tests (21 tests)
npm run test:watch  # Watch mode
```

Covers: engine, comparison (3 modes), insights, token budget, guardrails, growth projection, and optimiser.

## Docker

```bash
docker build -t genai-cost-simulator .
docker run -p 3000:3000 genai-cost-simulator
```

## Deploy to Cloud Run

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/genai-cost-simulator

# Deploy
gcloud run deploy genai-cost-simulator \
  --image gcr.io/PROJECT_ID/genai-cost-simulator \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1

# Get URL
gcloud run services describe genai-cost-simulator --region us-central1 --format 'value(status.url)'
```

## Demo Script (2 minutes)

1. Click **Demo** button (loads Enterprise + Burst preset automatically)
2. Show: cost breakdown + top lever + guardrail warnings
3. Scroll to **Model Comparison** — toggle between Lowest Cost / Balanced / Highest Quality
4. Expand **Token Budget Analysis** — note completion ratio diagnostic
5. Toggle: cache 25% → 40%, switch Pro → Flash
6. Click **Auto-Optimise** → compare Baseline vs Optimised
7. Open **12-Month Growth Projection** — adjust growth slider
8. Expand **Architecture** — note cost overlay on diagram nodes
9. Click **Exec Brief** → paste into email

## Updating Pricing

Edit `src/data/pricing.default.json`. Versioned with `meta.version` and `meta.updatedAt`. Labelled as default/mock — update from official sources for production.

## MVP Completion Checklist

- [x] Zod validation + guardrail warnings in UI
- [x] Unit tests for engine modules (21 tests)
- [x] Pricing banner + versioned config
- [x] Token budget analysis
- [x] Vector DB size estimator
- [x] Quality vs Cost optimisation modes
- [x] 12-month growth projection
- [x] Architecture diagram with cost overlay
- [x] Enterprise guardrails (7 rules)
- [x] Exec brief formatted + bounded length
- [x] Demo mode button
- [x] Dockerfile + Cloud Run deploy instructions
- [x] Structured JSON logs in API
- [x] README demo script covers all features

---

## Author

**Created & developed by [Phani Marupaka](https://linkedin.com/in/phani-marupaka)**

© 2026 Phani Marupaka. All rights reserved.

Unauthorized reproduction, distribution, or modification of this software, in whole or in part, is strictly prohibited under applicable trademark and copyright laws including but not limited to the Digital Millennium Copyright Act (DMCA), the Lanham Act (15 U.S.C. § 1051 et seq.), and equivalent international intellectual property statutes. This software contains embedded provenance markers and attribution watermarks that are protected under 17 U.S.C. § 1202 (integrity of copyright management information). Removal or alteration of such markers constitutes a violation of federal law.

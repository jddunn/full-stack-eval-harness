# Fullstack Evals Harness

A lightweight evaluation harness for testing AI outputs. Run datasets through candidates, grade the results, compare performance.

**Frontend**: http://localhost:3020 | **Backend**: http://localhost:3021 | **API Docs**: http://localhost:3021/api/docs

---

## How It Works

Everything flows through a single pipeline:

```
Datasets (test cases)
    ↓
Candidates (produce output for each test case)
    ↓
Graders (evaluate each output)
    ↓
Experiments (orchestrate the full run)
    ↓
Stats (aggregate pass rates, scores, comparisons)
```

All entities are stored in SQLite and managed through the UI or REST API. Every entity type has presets you can load with one click, or seed all at once.

### The Core Loop

1. A **Dataset** contains test cases: `{input, expectedOutput, context, metadata}`
2. A **Candidate** defines how to produce output: either an LLM prompt template or an HTTP endpoint
3. A **Grader** defines how to evaluate: exact match, LLM judge, semantic similarity, faithfulness, etc.
4. An **Experiment** = `dataset × candidates × graders` — runs each test case through each candidate, then grades every output with every grader
5. **Stats** show pass rates, scores, and deltas per grader and per candidate

Without candidates, experiments fall back to grading `expectedOutput` directly (useful for testing grader behavior).

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm

### Install & Run

```bash
cd packages/fullstack-evals-harness-example

# Backend
cd backend && pnpm install && npx nest build
DATABASE_PATH=./data/evals.sqlite node dist/src/main.js

# Frontend (separate terminal)
cd frontend && pnpm install && npx next build && npx next start -p 3020
```

Or with PM2:

```bash
pm2 start dist/src/main.js --name evals-backend --cwd backend
pm2 start "npx next start -p 3020" --name evals-frontend --cwd frontend
```

### First Run: Seed Data

Hit the seed endpoint to load all presets at once:

```bash
curl -X POST http://localhost:3021/api/presets/seed
```

This creates:
- 4 datasets (math, geography, RAG context, sentiment classification)
- 14 graders (exact match, LLM judges, semantic similarity, faithfulness, regex, JSON schema, etc.)

Then load candidate presets individually:

```bash
# Load all 6 candidate presets
for id in qa-basic qa-rag json-extractor classifier summarizer http-api; do
  curl -X POST http://localhost:3021/api/presets/candidates/$id/load
done
```

Or use the UI: go to each tab and click "Load Preset" dropdown.

---

## Detailed Usage

### Step 1: Configure LLM Settings

Go to **Settings** tab. Set your LLM provider and API key:

| Setting | Description | Example |
|---------|-------------|---------|
| Provider | `openai`, `anthropic`, or `ollama` | `anthropic` |
| Model | Model ID | `claude-sonnet-4-5-20250929` |
| API Key | Your API key | `sk-ant-...` |
| Ollama Base URL | Local Ollama endpoint | `http://localhost:11434` |
| Temperature | Sampling temperature (0-2) | `0.7` |
| Max Tokens | Output length limit | `1024` |

Settings are stored in the database — no `.env` file needed. Changes take effect immediately.

**For local testing without API keys**: Use Ollama with a local model. Set Provider=`ollama`, Base URL=`http://localhost:11434`, Model=`llama3:8b`.

### Step 2: Create or Load Datasets

Go to **Datasets** tab. You can:

**Load a preset:**
- `Basic Math` — 5 arithmetic questions with exact answers
- `Geography Facts` — 5 capital city / geography questions
- `RAG with Context` — 3 questions with provided context (for faithfulness testing)
- `Sentiment Classification` — 5 text snippets with positive/negative/neutral labels

**Create manually:**
1. Click "New Dataset"
2. Name it and add a description
3. Add test cases with:
   - **Input**: The prompt or question
   - **Expected Output**: Ground truth answer (optional — not needed if you're just generating and grading)
   - **Context**: Reference text for faithfulness/RAG testing (optional)
   - **Metadata**: JSON object with custom fields (optional — e.g. `{"difficulty": "hard", "topic": "math"}`)

**Import data:**
- JSON import: `POST /api/datasets/:id/import` with array of test cases
- Export: Download as JSON or CSV from the dataset detail page

**Synthetic generation:**
Use the API to generate test cases with an LLM:

```bash
curl -X POST http://localhost:3021/api/presets/synthetic/dataset \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Physics Questions",
    "topic": "basic physics",
    "style": "factual",
    "count": 10
  }'
```

### Step 3: Create or Load Graders

Go to **Graders** tab. 14 presets available:

**Deterministic graders (no LLM needed):**
- `Exact Match (Strict)` — case-sensitive string comparison
- `Exact Match (Flexible)` — case-insensitive
- `Contains All Keywords` — output must include all specified terms
- `Contains Any Keyword` — output must include at least one
- `Regex Pattern Match` — output matches a regex (e.g. `\d{4}-\d{2}-\d{2}` for dates)
- `JSON Schema Validation` — output must be valid JSON matching a schema

**LLM-powered graders (require configured LLM):**
- `Helpfulness Judge` — LLM evaluates if response is helpful and accurate
- `Safety Judge` — LLM checks for harmful/inappropriate content
- `Semantic Match (High)` — embedding cosine similarity > 85%
- `Semantic Match (Moderate)` — embedding cosine similarity > 70%
- `Faithfulness (Strict)` — RAGAS-inspired, 90%+ claims must be context-supported
- `Faithfulness (Moderate)` — 70%+ claims supported
- `Answer Relevancy` — checks if answer is on-topic
- `Context Relevancy` — checks if retrieved context is relevant

**Custom graders:**
Create your own with any type. For LLM Judge, write a custom rubric describing pass/fail criteria.

### Step 4: Create or Load Candidates

Go to **Candidates** tab. A candidate defines **how to produce output** for each test case.

**Two runner types:**

**LLM Prompt** (`llm_prompt`):
- System prompt: instructions for the model
- User prompt template: supports variable substitution:
  - `{{input}}` — test case input
  - `{{context}}` — test case context
  - `{{expected}}` — expected output (useful for few-shot examples)
  - `{{metadata.field}}` — dot-notation access to metadata JSON fields
- Model config overrides: per-candidate provider, model, temperature, maxTokens

**HTTP Endpoint** (`http_endpoint`):
- Endpoint URL: the API to call
- Method: GET or POST
- Headers: JSON object of custom headers
- Body template: JSON with `{{variable}}` substitution
- Response parsing: auto-extracts `output`, `response`, `text`, or `result` from JSON response

**6 presets available:**

| Preset | Type | Template | Best For |
|--------|------|----------|----------|
| `Q&A Basic` | llm_prompt | `{{input}}` | General knowledge |
| `Q&A with Context (RAG)` | llm_prompt | `Context:\n{{context}}\n\nQuestion: {{input}}` | RAG pipelines |
| `JSON Extractor` | llm_prompt | `{{input}}` (temp=0) | Structured extraction |
| `Text Classifier` | llm_prompt | `{{input}}` (temp=0) | Classification tasks |
| `Text Summarizer` | llm_prompt | `{{input}}` | Summarization quality |
| `HTTP API Endpoint` | http_endpoint | POST to localhost:8080 | Testing real APIs |

**Testing candidates inline:**
Each candidate has a "Test" button. Enter sample input, click play, see the output and latency. This lets you verify a candidate works before committing to a full experiment run.

**Variant lineage:**
Create a variant of an existing candidate to track prompt iteration. The variant gets a `parentId` linking back to the original, and a `variantLabel` describing what changed (e.g. "added chain-of-thought", "lowered temperature to 0").

### Step 5: Run an Experiment

Go to **Experiments** tab.

1. **Select a dataset** from the dropdown
2. **Select candidates** (optional — multi-select). If no candidates selected, graders evaluate `expectedOutput` directly
3. **Select graders** (multi-select)
4. **Click Run**

**What happens:**
1. For each test case in the dataset:
   - For each candidate: generate output (LLM call or HTTP request)
   - For each grader: evaluate the generated output
2. Results stream in real-time via SSE — you see pass/fail as each eval completes
3. Progress bar shows `current / total` evaluations

**Total evaluations** = `testCases × candidates × graders`. A dataset with 5 cases, 2 candidates, and 3 graders = 30 evaluations.

**Results table** shows a matrix:
- Rows: test cases
- Columns: one column per `candidate × grader` combination
- Cells: Pass/Fail badge. Hover to see score (0-1), reason, generated output, and latency (ms)

### Step 6: Compare Candidates

After running an experiment with multiple candidates, compare them:

**Via API:**
```bash
curl "http://localhost:3021/api/experiments/EXPERIMENT_ID/compare?baseline=CANDIDATE_A_ID&challenger=CANDIDATE_B_ID"
```

**Response:**
```json
{
  "summary": {
    "baselinePassRate": 0.8,
    "challengerPassRate": 0.9,
    "deltaPassRate": 0.1,
    "improved": 3,
    "regressed": 1,
    "same": 6,
    "total": 10
  },
  "comparisons": [
    {
      "testCaseId": "...",
      "graderId": "...",
      "baseline": {"pass": false, "score": 0.6},
      "challenger": {"pass": true, "score": 0.85},
      "delta": "improved"
    }
  ]
}
```

### Step 7: View Stats

Go to **Stats** tab for aggregate metrics across experiments:
- Overall pass rate
- Pass rate by grader
- Pass rate by candidate
- Score distributions

### Step 8: Export Results

```bash
# JSON export
curl http://localhost:3021/api/experiments/EXPERIMENT_ID/export/json -o results.json

# CSV export
curl http://localhost:3021/api/experiments/EXPERIMENT_ID/export/csv -o results.csv
```

---

## Presets System

Presets are JSON objects hardcoded in `backend/src/presets/presets.ts`. When loaded, they create real entities in SQLite.

### Loading Presets

**Seed all at once** (graders + datasets):
```bash
POST /api/presets/seed
```

**Load individually:**
```bash
# List available presets
GET /api/presets/graders
GET /api/presets/datasets
GET /api/presets/candidates

# Load a specific preset
POST /api/presets/graders/exact-match-strict/load
POST /api/presets/datasets/math-basic/load
POST /api/presets/candidates/qa-basic/load
```

### Available Presets

**Dataset Presets** (4):
- `math-basic` — 5 arithmetic questions
- `factual-geography` — 5 geography questions
- `rag-context` — 3 questions with context
- `sentiment-classification` — 5 sentiment examples

**Grader Presets** (14):
- `exact-match-strict`, `exact-match-flexible`
- `llm-judge-helpful`, `llm-judge-safety`
- `semantic-high` (85%), `semantic-moderate` (70%)
- `faithfulness-strict` (90%), `faithfulness-moderate` (70%)
- `contains-all`, `contains-any`
- `regex-pattern`
- `json-schema-basic`
- `answer-relevancy-default`
- `context-relevancy-default`

**Candidate Presets** (6):
- `qa-basic`, `qa-rag`, `json-extractor`, `classifier`, `summarizer`, `http-api`

---

## API Reference

Base URL: `http://localhost:3021/api`

Interactive Swagger docs: `http://localhost:3021/api/docs`

### Datasets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/datasets` | List all datasets |
| GET | `/datasets/:id` | Get dataset with test cases |
| POST | `/datasets` | Create dataset `{name, description}` |
| PUT | `/datasets/:id` | Update dataset |
| DELETE | `/datasets/:id` | Delete dataset and test cases |
| POST | `/datasets/:id/cases` | Add test case `{input, expectedOutput, context, metadata}` |
| PUT | `/datasets/:id/cases/:caseId` | Update test case |
| DELETE | `/datasets/:id/cases/:caseId` | Delete test case |
| GET | `/datasets/:id/export/json` | Export as JSON |
| GET | `/datasets/:id/export/csv` | Export as CSV |
| POST | `/datasets/:id/import` | Import test cases |

### Graders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/graders` | List all graders |
| GET | `/graders/:id` | Get grader |
| POST | `/graders` | Create grader `{name, type, rubric, config}` |
| PUT | `/graders/:id` | Update grader |
| DELETE | `/graders/:id` | Delete grader |

### Candidates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/candidates` | List all candidates |
| GET | `/candidates/:id` | Get candidate |
| POST | `/candidates` | Create candidate (see body below) |
| PUT | `/candidates/:id` | Update candidate |
| DELETE | `/candidates/:id` | Delete candidate |
| GET | `/candidates/:id/variants` | Get variant lineage |
| POST | `/candidates/:id/test` | Test with `{input, context?, metadata?}` |

**Create candidate body (LLM):**
```json
{
  "name": "My Prompt",
  "runnerType": "llm_prompt",
  "systemPrompt": "You are helpful.",
  "userPromptTemplate": "{{input}}",
  "modelConfig": {"temperature": 0.5}
}
```

**Create candidate body (HTTP):**
```json
{
  "name": "My API",
  "runnerType": "http_endpoint",
  "endpointUrl": "https://my-api.com/predict",
  "endpointMethod": "POST",
  "endpointBodyTemplate": "{\"input\": \"{{input}}\"}"
}
```

### Experiments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/experiments` | List all experiments |
| GET | `/experiments/:id` | Get experiment with results |
| POST | `/experiments` | Create and run `{datasetId, graderIds[], candidateIds?[]}` |
| GET | `/experiments/:id/stats` | Aggregate statistics |
| GET | `/experiments/:id/stream` | SSE progress stream |
| GET | `/experiments/:id/compare?baseline=X&challenger=Y` | A/B compare |
| GET | `/experiments/:id/export/json` | Export JSON |
| GET | `/experiments/:id/export/csv` | Export CSV |

### Presets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/presets/graders` | List grader presets |
| GET | `/presets/datasets` | List dataset presets |
| GET | `/presets/candidates` | List candidate presets |
| POST | `/presets/graders/:id/load` | Create grader from preset |
| POST | `/presets/datasets/:id/load` | Create dataset + cases from preset |
| POST | `/presets/candidates/:id/load` | Create candidate from preset |
| POST | `/presets/seed` | Load all grader + dataset presets |
| POST | `/presets/synthetic/generate` | Generate test cases with LLM |
| POST | `/presets/synthetic/dataset` | Generate full synthetic dataset |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | List all settings |
| GET | `/settings/llm` | Get LLM configuration |
| PUT | `/settings/llm` | Update LLM config `{provider, model, apiKey, ...}` |
| POST | `/settings/llm/test` | Test LLM connection |
| POST | `/settings/reset` | Reset to defaults |

---

## Example Workflows

### Workflow 1: Test a RAG Pipeline

```bash
# 1. Load RAG dataset and graders
curl -X POST localhost:3021/api/presets/datasets/rag-context/load
curl -X POST localhost:3021/api/presets/graders/faithfulness-strict/load

# 2. Create a RAG candidate
curl -X POST localhost:3021/api/presets/candidates/qa-rag/load

# 3. Run experiment
curl -X POST localhost:3021/api/experiments \
  -H "Content-Type: application/json" \
  -d '{"datasetId":"DATASET_ID","candidateIds":["CANDIDATE_ID"],"graderIds":["GRADER_ID"]}'
```

### Workflow 2: Compare Two Prompt Variants

1. Create candidate A: "Answer concisely"
2. Create candidate B (variant of A): "Answer with step-by-step reasoning"
3. Run experiment with both candidates and multiple graders
4. Compare: `GET /experiments/:id/compare?baseline=A&challenger=B`

### Workflow 3: Test Your Own API

1. Create an HTTP endpoint candidate pointing to your API
2. Load a dataset (or create your own)
3. Load exact-match + semantic similarity graders
4. Run experiment — the harness will call your API for each test case

---

## Tech Stack

| Layer | Tech | Port |
|-------|------|------|
| Frontend | Next.js 15 | 3020 |
| Backend | NestJS | 3021 |
| Database | SQLite (via Drizzle ORM, adapter pattern for Postgres) | — |
| LLM | OpenAI, Anthropic, Ollama | — |
| Docs | Swagger/OpenAPI | 3021/api/docs |

---

## Project Structure

```
├── frontend/                    # Next.js 15 app
│   └── src/
│       ├── app/
│       │   ├── datasets/        # Dataset + test case CRUD
│       │   ├── graders/         # Grader CRUD + presets
│       │   ├── candidates/      # Candidate CRUD + test panel
│       │   ├── experiments/     # Run experiments + results
│       │   ├── stats/           # Aggregate metrics
│       │   ├── settings/        # Runtime LLM config
│       │   └── about/           # Docs and references
│       ├── components/          # Navigation, ThemeProvider
│       └── lib/                 # API client, types
├── backend/                     # NestJS API
│   └── src/
│       ├── database/            # IDbAdapter interface + SQLite implementation
│       ├── candidates/          # CRUD + CandidateRunnerService
│       ├── experiments/         # Experiment orchestrator + SSE
│       ├── eval-engine/         # Grader implementations
│       ├── graders/             # Grader CRUD
│       ├── llm/                 # Provider-agnostic LLM layer
│       ├── presets/             # Seed data + synthetic generation
│       ├── settings/            # Runtime configuration
│       └── main.ts              # App bootstrap, CORS, Swagger
├── ARCHITECTURE.md              # Design decisions + references
└── README.md                    # This file
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design rationale and diagrams.

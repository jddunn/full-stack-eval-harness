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
Experiment analytics (pass rates, weighted scores, comparisons)
```

Datasets are **CSV files** in `backend/datasets/` — portable, git-trackable, and editable in any spreadsheet app. Candidates are **markdown files** in `backend/prompts/`. Graders and experiment results live in SQLite.

### The Core Loop

1. A **Dataset** contains test cases: `{input, expectedOutput, context, metadata}`
2. A **Candidate** is a markdown prompt file in `backend/prompts/` defining how to produce output (LLM prompt or HTTP endpoint)
3. A **Grader** defines how to evaluate: exact match, LLM judge, semantic similarity, faithfulness, etc.
4. An **Experiment** = `dataset × candidates × graders` — runs each test case through each candidate, then grades every output with every grader
5. **Experiment stats** show pass rates, weighted scores, and deltas per grader and per candidate

### Weighted Grader Scoring

Each prompt file specifies recommended graders with weights:

```
recommended_graders: faithfulness-strict:0.4, extraction-completeness:0.3, llm-judge-helpful:0.3
grader_rationale: Faithfulness is highest — the full format must stay grounded.
```

The experiment stats endpoint computes both `avgScore` (equal-weight) and `weightedScore` (using the prompt's configured weights) per candidate. Without explicit weights, all graders default to `1.0` (equal weighting).

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
DATABASE_PATH=./data/evals.sqlite node dist/main.js

# Frontend (separate terminal)
cd frontend && pnpm install && npx next build && npx next start -p 3020
```

Or with PM2:

```bash
pm2 start dist/main.js --name evals-backend --cwd backend
pm2 start "npx next start -p 3020" --name evals-frontend --cwd frontend
```

### First Run: Seed Data

Hit the seed endpoint to load all presets at once:

```bash
curl -X POST http://localhost:3021/api/presets/seed
```

This creates:
- 7 graders (faithfulness, LLM judge, semantic similarity, JSON schema, extraction completeness)

Datasets are loaded automatically from `backend/datasets/` on startup (2 included). Prompts are loaded from `backend/prompts/` (6 included). Or use the UI to load grader presets individually.

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

### Step 2: Datasets

Go to **Datasets** tab. Datasets are CSV files in `backend/datasets/`.

**2 included:**
- `context-qa.csv` — 3 questions with provided context (for faithfulness testing)
- `research-paper-extraction.csv` — 5 real AI paper abstracts for structured JSON extraction

**CSV format** — 4 columns:
```csv
input,expected_output,context,metadata
"What is 2+2?","4","","{"difficulty":"easy"}"
```

**Add a dataset:**
- Place a `.csv` file in `backend/datasets/` and click "Reload from Disk"
- Or use "Upload CSV" in the UI to import directly
- Or use "Generate" to create synthetic test cases with an LLM

**Optional sidecar** — `my-dataset.meta.json`:
```json
{"name": "My Dataset", "description": "Description of the dataset"}
```

Without a sidecar, the name is derived from the filename (hyphens → spaces, title case).

**Export:** Download as JSON or CSV from the dataset detail page.

### Step 3: Create or Load Graders

Go to **Graders** tab. Graders are loaded from `backend/graders/*.yaml` (13 included in this repo), and 7 quick-load templates are available under `/api/presets/graders`.

**LLM-powered graders (require configured LLM):**
- `Faithfulness (Strict)` — RAGAS-inspired, 90%+ claims must be context-supported
- `Faithfulness (Moderate)` — 70%+ claims supported
- `Helpfulness Judge` — LLM evaluates if response is helpful and accurate
- `Semantic Match (High)` — embedding cosine similarity > 85%
- `Semantic Match (Moderate)` — embedding cosine similarity > 70%
- `Extraction Completeness` — LLM evaluates extraction quality and grounding

**Deterministic grader:**
- `Paper Extraction Schema` — validates JSON output against the research paper schema

**Custom graders:**
Create your own with any type. For LLM Judge, write a custom rubric describing pass/fail criteria.

### Step 4: Prompt Files (Candidates)

Go to **Candidates** tab. Candidates are markdown files in `backend/prompts/` — editable from the prompt detail page or directly on disk.

**Prompt file format:**
```markdown
---
name: Full Structured Analyst
description: Comprehensive analysis with integrity rules
runner: llm_prompt
temperature: 0
user_template: "{{input}}"
recommended_graders: faithfulness-strict:0.4, extraction-completeness:0.3, llm-judge-helpful:0.3
recommended_datasets: research-paper-extraction, context-qa
grader_rationale: Faithfulness is highest — the full format must stay grounded.
notes: Compare against analyst-citations for structured vs citation-focused output.
---
You are a technical analyst...
```

**Template variables:** `{{input}}`, `{{context}}`, `{{expected}}`, `{{metadata.field}}`

**6 prompts included:**

| Prompt | Type | Purpose |
|--------|------|---------|
| `analyst-full` | Analysis | Full structured (7 output sections) |
| `analyst-citations` | Analysis | Citation-focused with bracket format |
| `summarizer` | Summarization | Concise text summarization |
| `json-extractor-strict` | Extraction | Grounded JSON extraction, temp 0 |
| `json-extractor-loose` | Extraction | Inferential extraction, temp 0.3 |
| `text-rewriter` | Rewriting | Style rewrite preserving meaning |

**To add a new prompt:** Create a `.md` file in `backend/prompts/` and click "Reload from Disk" in the UI. To edit, change the file and reload.

**Prompt variations:** In the Candidates tab, use `+` for a manual variant clone or `AI` to generate multiple variants at once. AI generation accepts per-run config (count/instructions/model params) and defaults to current Settings values when fields are left blank.

**Testing inline:** Each prompt has a "Test" button. Enter sample input, click play, see the output and latency.

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

### Step 7: Export Results

```bash
# JSON export
curl http://localhost:3021/api/experiments/EXPERIMENT_ID/export/json -o results.json

# CSV export
curl http://localhost:3021/api/experiments/EXPERIMENT_ID/export/csv -o results.csv
```

---

## Presets System

Grader presets are defined in `backend/src/presets/presets.ts`. When loaded, they create grader entities in SQLite.

### Loading Presets

**Seed all graders at once:**
```bash
POST /api/presets/seed
```

**Load individually:**
```bash
# List available grader presets
GET /api/presets/graders

# Load a specific grader
POST /api/presets/graders/faithfulness-strict/load
```

### Available Presets

**Grader Presets** (7):
- `faithfulness-strict` (90%), `faithfulness-moderate` (70%)
- `llm-judge-helpful`
- `semantic-high` (85%), `semantic-moderate` (70%)
- `json-extraction-schema` — validates paper extraction JSON
- `extraction-completeness` — LLM judge for extraction quality

**Dataset Files** (2 in `backend/datasets/`):
Loaded automatically on startup. Add more by placing CSV files in the directory.

**Prompt Files** (6 in `backend/prompts/`):
Loaded automatically on startup. See the Candidates tab or the `.md` files for details.

---

## API Reference

Base URL: `http://localhost:3021/api`

Interactive Swagger docs: `http://localhost:3021/api/docs`

### Datasets (file-based — loaded from CSV files, editable via `PUT /datasets/:id`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/datasets` | List all datasets |
| GET | `/datasets/:id` | Get dataset with test cases |
| PUT | `/datasets/:id` | Rewrite dataset rows/metadata to CSV on disk |
| POST | `/datasets/reload` | Re-read all CSV files from disk |
| POST | `/datasets/import` | Upload CSV `{filename, csv, name?, description?}` |
| GET | `/datasets/:id/export/json` | Export as JSON |
| GET | `/datasets/:id/export/csv` | Export as CSV |

### Graders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/graders` | List all graders |
| GET | `/graders/:id` | Get grader |
| POST | `/graders` | Create grader `{name, type, rubric, config}` |
| PUT | `/graders/:id` | Update grader |
| DELETE | `/graders/:id` | Delete grader |

### Prompts (Candidates — file-based, editable)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/prompts` | List all loaded prompts |
| GET | `/prompts/:id` | Get prompt by filename ID |
| PUT | `/prompts/:id` | Update prompt frontmatter/body on disk |
| POST | `/prompts/:id/test` | Test with `{input, context?, metadata?}` |
| POST | `/prompts/:id/variants/generate` | AI-generate variants `{count?, customInstructions?, provider?, model?, temperature?, maxTokens?}` |
| POST | `/prompts/reload` | Re-read all .md files from disk |

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
| POST | `/presets/graders/:id/load` | Create grader from preset |
| POST | `/presets/seed` | Load all grader presets |
| POST | `/presets/synthetic/generate` | Generate test cases with LLM |
| POST | `/presets/synthetic/dataset` | Generate and save as CSV |

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

### Workflow 1: Test Faithfulness with Provided Context

```bash
# 1. Datasets are loaded from CSV on startup — context-qa is included
# Load the faithfulness grader preset
curl -X POST localhost:3021/api/presets/graders/faithfulness-strict/load

# 2. Use the analyst-full candidate (already loaded from disk)
# Or reload prompts: curl -X POST localhost:3021/api/prompts/reload

# 3. Run experiment (dataset ID = CSV filename without extension)
curl -X POST localhost:3021/api/experiments \
  -H "Content-Type: application/json" \
  -d '{"datasetId":"context-qa","candidateIds":["analyst-full"],"graderIds":["GRADER_ID"]}'
```

> **Note:** Context is pre-loaded in test cases. Dynamic retrieval (RAG) is planned but not yet implemented.

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
│       │   ├── datasets/        # Read-only CSV dataset viewer + export
│       │   ├── graders/         # Grader CRUD + presets
│       │   ├── candidates/      # Read-only prompt viewer + test panel
│       │   ├── experiments/     # Run experiments + results + weighted scores
│       │   ├── settings/        # Runtime LLM config
│       │   └── about/           # Docs and references
│       ├── components/          # Navigation, ThemeProvider
│       └── lib/                 # API client, types
├── backend/
│   ├── datasets/                # CSV dataset files + optional .meta.json sidecars
│   ├── prompts/                 # 6 markdown prompt files (candidates)
│   └── src/
│       ├── database/            # IDbAdapter interface + SQLite implementation
│       ├── datasets/            # DatasetLoaderService (reads CSV files from disk)
│       ├── candidates/          # PromptLoaderService + CandidateRunnerService
│       ├── experiments/         # Experiment orchestrator + SSE + weighted stats
│       ├── eval-engine/         # Grader implementations (9 types)
│       ├── graders/             # Grader CRUD
│       ├── llm/                 # Provider-agnostic LLM layer
│       ├── presets/             # Seed graders + synthetic generation
│       ├── settings/            # Runtime configuration
│       └── main.ts              # App bootstrap, CORS, Swagger
└── README.md                    # This file
```

---

## Testing

```bash
cd backend
npm test                                      # All tests
npm test -- --testPathPattern=candidates       # Prompt loader + template utils
```

Tests cover:
- **template-utils**: variable substitution, dot notation, edge cases
- **prompt-loader**: file loading, weight parsing, rationale parsing, findMany

---

## FAQ

**How do I add a dataset?**
Place a `.csv` file in `backend/datasets/` with columns: `input`, `expected_output`, `context`, `metadata`. Click "Reload from Disk" in the Datasets tab. Or use "Upload CSV" in the UI.

**How do I add a new prompt?**
Create a `.md` file in `backend/prompts/` with frontmatter (see format above), then click "Reload from Disk" in the Candidates tab.

**How do I change a prompt?**
Edit the `.md` file directly and click "Reload from Disk". No database migration needed.

**What are grader weights?**
Weights control how much each grader contributes to a candidate's weighted aggregate score. Format: `grader-id:0.4`. Higher weight = more influence. Default weight is `1.0` if not specified.

**How does the weighted score work?**
`weightedScore = sum(graderAvgScore * graderWeight) / sum(graderWeights)`. When all weights are equal, `weightedScore == avgScore`.

**Can I use Ollama / local models?**
Yes. Go to Settings, set provider to "ollama", set the base URL (default `http://localhost:11434`), and select your model.

**How do I run an A/B test?**
Create an experiment with 2+ candidates, same dataset and graders. After completion, use the compare endpoint: `GET /api/experiments/:id/compare?baseline=X&challenger=Y`

**What grader should I use?**
Each prompt file includes `recommended_graders` with weights and a `grader_rationale` explaining why. Start there.

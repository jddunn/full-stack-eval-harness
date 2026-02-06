# Full-Stack Eval Harness

A lightweight evaluation harness for testing LLM prompts against datasets with configurable graders. Define prompts as markdown files, load datasets from CSV, grade with YAML-configured graders, run experiments, and compare results.

**Frontend**: http://localhost:3020 | **Backend**: http://localhost:3021 | **API Docs**: http://localhost:3021/api/docs

---

## Quick Start

```bash
# Install
npm install && npm --prefix backend install && npm --prefix frontend install

# Dev (both services, hot reload)
npm run dev

# Production
npm run build-all && npm run start-all
```

Or with PM2:

```bash
npm run build-all
pm2 start dist/src/main.js --name evals-backend --cwd backend
pm2 start "npx next start -p 3020" --name evals-frontend --cwd frontend
```

### Scripts

| Command                | What it does                    |
| ---------------------- | ------------------------------- |
| `npm run dev`          | Both services, hot reload (dev) |
| `npm run build-all`    | Build backend + frontend        |
| `npm run start-all`    | Both services, production mode  |
| `npm run test`         | Run backend tests               |
| `npm run lint`         | Lint both                       |
| `npm run backend:dev`  | Backend only (dev)              |
| `npm run frontend:dev` | Frontend only (dev)             |

Configure LLM provider and API key in the **Settings** tab (stored in database, no `.env` needed). Or set defaults in `backend/.env` (see `backend/.env.example`).

---

## Architecture

```
Datasets (CSV test cases)  →  Candidates (prompt files)  →  Graders (YAML)  →  Experiments (results + analytics)
```

Everything is **file-based**: datasets are CSV, prompts are markdown, graders are YAML. All editable on disk, in the UI, or via API. SQLite stores only experiment runs, results, and settings.

### Datasets

CSV files in `backend/datasets/`. Columns: `input`, `expected_output`, `context`, `metadata`. Optional `.meta.json` sidecar for display name/description. Upload via UI or drop files in the directory.

**Included:** context-qa, research-paper-extraction, summarization, text-rewriting, text-rewriting-research.

### Candidates (Prompts)

Markdown files organized in **family folders** under `backend/prompts/`. Each folder is one prompt family with a `base.md` parent and variant files. IDs auto-derive from folder structure: folder name = parent ID, `{folder}-{filename}` = variant ID.

```
backend/prompts/
  analyst/
    base.md              → ID: analyst (parent)
    citations.md         → ID: analyst-citations (variant)
  summarizer/
    base.md              → ID: summarizer
    concise.md           → ID: summarizer-concise
    bullets.md           → ID: summarizer-bullets
    verbose.md           → ID: summarizer-verbose
```

**Included prompts (12 across 6 families):**

| Family            | Parent                | Variants                        | Recommended Dataset       | Key Graders (weights)                         |
| ----------------- | --------------------- | ------------------------------- | ------------------------- | --------------------------------------------- |
| `qa-assistant/`   | Q&A Assistant         | —                               | context-qa                | faithfulness:0.4, similarity:0.3, helpful:0.3 |
| `analyst/`        | Structured Analyst    | `citations`                     | context-qa                | faithfulness:0.6, helpful:0.4                 |
| `json-extractor/` | Strict JSON Extractor | `loose`                         | research-paper-extraction | schema:0.4, completeness:0.4, faithful:0.2    |
| `summarizer/`     | Summarizer            | `concise`, `bullets`, `verbose` | summarization             | helpful:0.4, similarity:0.3, faithful:0.3     |
| `text-rewriter/`  | Text Rewriter         | `formal`, `casual`              | text-rewriting            | faithfulness:0.6, similarity:0.4              |

**Recommended graders & datasets:** Each prompt declares `recommended_graders` with weights and `recommended_datasets` in its frontmatter. Any grader can be used with any prompt — the recommendations control **weighted scoring**. When an experiment runs, results include both an equal-weight average and a weighted score using each prompt's declared weights, so you can see what matters most for each candidate.

**Adding variants:** Click `+ Variant` on any prompt in the Candidates tab (or use `AI Gen` to auto-generate variants). This creates a new `.md` file in the parent's folder. You can also add files manually — any `.md` file in a family folder that isn't `base.md` becomes a variant.

**Prompt file format:**

```markdown
---
name: Full Structured Analyst
runner: llm_prompt
user_template: '{{input}}'
recommended_graders: faithfulness:0.6, llm-judge-helpful:0.4
recommended_datasets: context-qa
grader_rationale: Faithfulness is highest — must stay grounded in context.
---

You are a technical analyst...
```

Template variables: `{{input}}`, `{{context}}`, `{{expected}}`, `{{metadata.field}}`

### Graders

YAML files in `backend/graders/`. Each grader scores output as pass/fail with a 0-1 score.

| Grader                  | Type                 | Engine    | Threshold |
| ----------------------- | -------------------- | --------- | --------- |
| Faithfulness            | context-faithfulness | promptfoo | 0.8       |
| Helpfulness Judge       | llm-judge            | built-in  | —         |
| Extraction Completeness | llm-judge            | built-in  | —         |
| Paper Extraction Schema | json-schema          | built-in  | —         |
| Semantic Similarity     | semantic-similarity  | built-in  | 0.8       |

Thresholds adjustable per grader in the UI. The `promptfoo` grader type also supports `answer-relevance`, `context-relevance`, `context-recall`, `llm-rubric`, and `similar`.

### Experiments

Select dataset + candidates + graders → Run. Results stream via SSE. Each candidate gets an average score and a weighted score (using the prompt's `recommended_graders` weights). Compare candidates side-by-side with the A/B comparison endpoint.

**Prompt variation evaluation:** Create multiple variants of a prompt (e.g. `summarizer`, `summarizer-concise`, `summarizer-bullets`) and run them against the same dataset and graders in a single experiment. The results show per-candidate scores, letting you directly compare which prompt formulation performs best across your test cases.

**RAG system evaluation:** The `context-faithfulness` grader (powered by promptfoo) measures whether outputs stay grounded in the provided context — a core RAG evaluation metric. Combined with `answer-relevance` and `context-recall` graders, you can evaluate different RAG pipeline configurations by swapping candidates that call different retrieval backends via the `http_endpoint` runner type. Each candidate can point to a different RAG service, and the harness grades them all against the same dataset.

---

## API Reference

See [API.md](API.md) for the full endpoint reference. Interactive docs available at `http://localhost:3021/api/docs` (Swagger).

---

## Tech Stack

| Layer    | Tech                                               | Port          |
| -------- | -------------------------------------------------- | ------------- |
| Frontend | Next.js 15                                         | 3020          |
| Backend  | NestJS                                             | 3021          |
| Database | SQLite (via Drizzle ORM; Postgres adapter planned) | —             |
| LLM      | OpenAI, Anthropic, Ollama                          | —             |
| Docs     | Swagger/OpenAPI                                    | 3021/api/docs |

## Project Structure

```
├── frontend/                    # Next.js 15 app
│   └── src/
│       ├── app/                 # Pages: datasets, graders, candidates, experiments, settings, about
│       ├── components/          # Navigation, ThemeProvider, Toast
│       └── lib/                 # API client, types
├── backend/
│   ├── datasets/                # CSV files + optional .meta.json sidecars
│   ├── graders/                 # YAML grader files
│   ├── prompts/                 # Folder-per-family prompt files
│   └── src/
│       ├── database/            # IDbAdapter + SQLite implementation (Drizzle)
│       ├── datasets/            # DatasetLoaderService
│       ├── candidates/          # PromptLoaderService + CandidateRunnerService
│       ├── experiments/         # Experiment orchestrator + SSE + weighted stats
│       ├── eval-engine/         # Grader implementations (7 types)
│       ├── graders/             # Grader CRUD
│       ├── llm/                 # Provider-agnostic LLM layer
│       ├── presets/             # Seed graders + synthetic generation
│       ├── settings/            # Runtime configuration
│       └── main.ts              # App bootstrap, CORS, Swagger
└── README.md
```

## Testing

```bash
cd backend
npm test                                      # All tests
npm test -- --testPathPattern=candidates       # Prompt loader + template utils
```

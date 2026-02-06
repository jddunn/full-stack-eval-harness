# Full-Stack Eval Harness

A lightweight evaluation harness for testing LLM prompts against datasets with configurable graders. Define prompts as markdown files, load datasets from CSV, grade with YAML-configured graders, run experiments, and compare results.

| Service      | URL                                |
| ------------ | ---------------------------------- |
| **Frontend** | `http://localhost:3020`             |
| **Backend**  | `http://localhost:3021`             |
| **API Docs** | `http://localhost:3021/api/docs`    |

---

## Quick Start

```bash
# Install
npm install && npm --prefix backend install && npm --prefix frontend install

# Dev (both services, hot reload)
npm run dev

# Build
npm run build-all              # backend + frontend
npm --prefix backend run build # backend only
npm --prefix frontend run build # frontend only

# Production
npm run build-all && npm run start-all
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
| `json-extractor/` | Strict JSON Extractor | `loose`                         | research-paper-extraction | completeness:0.5, faithfulness:0.5            |
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

YAML files in `backend/graders/`. Each grader scores output as pass/fail with a 0–1 score. 7 grader types supported — from fast deterministic checks to LLM-powered evaluation.

#### Grader Types: Pros vs Cons

| Type | How it works | Pros | Cons | Best for |
|------|-------------|------|------|----------|
| **exact-match** | String equality between output and expected | Instant, zero cost, deterministic, no false positives | Brittle — fails on whitespace, casing, or phrasing differences | Classification, fixed-format answers |
| **contains** | Checks if output includes a target substring | Fast, deterministic, good for keyword checks | No semantic understanding; false positives on partial matches | Verifying key terms, URLs, or required phrases appear |
| **regex** | Matches output against a regular expression | Flexible pattern matching, deterministic, zero cost | Complex patterns hard to maintain; no semantic awareness | Format validation (emails, dates, IDs), structured text |
| **json-schema** | Validates JSON output against a JSON Schema definition | Structural correctness in one check, deterministic | Only checks structure — not content quality or accuracy | Extraction tasks, API-style outputs, structured data |
| **semantic-similarity** | Cosine similarity on provider embeddings (OpenAI, Ollama) | Captures meaning beyond surface text; adjustable threshold | Requires embedding model; threshold tuning needed; cost per call | Comparing paraphrased answers, summarization quality |
| **llm-judge** | Sends output + rubric to an LLM for pass/fail judgment | Highly flexible; evaluates nuance, tone, completeness | Slowest, most expensive; non-deterministic; subject to model bias | Helpfulness, quality, completeness — anything a rubric can describe |
| **promptfoo** | Delegates to promptfoo's assertion engine (RAGAS-based) | Battle-tested metrics; academic grounding (RAGAS) | Requires promptfoo; LLM calls per assertion; complex config | RAG evaluation — faithfulness, relevance, context recall |

#### Promptfoo Assertions

The `promptfoo` type supports these assertion modes via `config.assertion`:

| Assertion | What it measures |
|-----------|-----------------|
| `context-faithfulness` | Are output claims grounded in the provided context? (RAGAS) |
| `answer-relevance` | Does the output actually answer the question? (RAGAS) |
| `context-relevance` | Is the retrieved context relevant to the query? (RAGAS) |
| `context-recall` | Does the context cover the expected answer? (RAGAS) |
| `llm-rubric` | Custom rubric evaluated by promptfoo's LLM judge |
| `similar` | Semantic similarity via promptfoo's embedding comparison |

#### Included Graders

| Grader | Type | Threshold | Engine |
|--------|------|-----------|--------|
| Faithfulness | `promptfoo` (context-faithfulness) | 0.8 | [promptfoo](https://promptfoo.dev) (external library) |
| Helpfulness Judge | `llm-judge` | — | Custom (direct LLM call) |
| Extraction Completeness | `llm-judge` | — | Custom (direct LLM call) |
| Semantic Similarity | `semantic-similarity` | 0.8 | Custom (embeddings + text overlap fallback) |

**Faithfulness** `[promptfoo library]` — Based on the RAGAS framework ([Es et al., 2023](https://arxiv.org/abs/2309.15217)). Delegates entirely to promptfoo's `context-faithfulness` assertion via `runAssertion()`. Promptfoo extracts atomic claims from the LLM output, then verifies each claim is supported by the provided context. A score of 0.8 means at least 80% of claims must be grounded. Detects hallucination in RAG systems — if the model invents facts not present in the retrieved context, this grader catches it. Promptfoo makes multiple LLM calls internally (claim extraction + verification). The harness maps the configured provider (OpenAI/Anthropic/Ollama) to promptfoo's provider format and passes API keys via env vars.

**Helpfulness Judge** `[custom]` — Custom LLM-as-Judge implementation inspired by [Zheng et al., 2023](https://arxiv.org/abs/2306.05685). No external grading library — sends the input, output, and a human-written rubric directly to the configured LLM via our `LlmService.complete()`. The LLM returns a structured `{pass, score, reason}` JSON judgment. Temperature is set to 0.1 for consistent judgments. The rubric checks whether the response directly answers the question, contains accurate information, and is clearly written. Falls back to heuristic parsing if JSON extraction fails. The most flexible grader — change the rubric to evaluate anything.

**Extraction Completeness** `[custom]` — Same custom LLM-as-Judge engine as Helpfulness, with a domain-specific rubric for structured extraction. Evaluates four dimensions: completeness (all fields populated?), accuracy (values match source?), grounding (every value traces to source text?), and structure (valid JSON matching expected schema?). No external library — the rubric is the only difference from Helpfulness Judge.

**Semantic Similarity** `[custom]` — Custom implementation using provider embedding APIs (OpenAI `text-embedding-3-small`, Ollama's `/api/embeddings`, or an LLM-generated fallback for Anthropic). Embeds both texts via `LlmService.embed()`, then computes cosine similarity between the vectors. Falls back to a custom weighted token overlap algorithm (Jaccard similarity + TF-IDF-style frequency scoring with stop word removal) when embeddings aren't available. Also supports hybrid mode (weighted combination of both), euclidean distance, and dot product metrics. A score of 0.8 means the vectors must be at least 80% aligned.

Thresholds adjustable per grader in the UI. Create new graders from the Graders tab or drop YAML files in `backend/graders/`.

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

# Architecture

Technical design decisions and rationale for the eval harness.

---

## Overview

This harness evaluates AI outputs against test cases using configurable graders. Experiments run as `dataset × candidates × graders` — candidates produce output, graders evaluate it. The architecture prioritizes simplicity, extensibility, and developer experience.

```mermaid
graph LR
    A[Frontend<br/>Next.js] <--> B[Backend<br/>NestJS]
    B <--> C[Database<br/>SQLite/Postgres]
    B --> D[LLM Layer<br/>OpenAI/Anthropic/Ollama]
    B --> E[HTTP Endpoints<br/>External APIs]
```

---

## Database: Why Drizzle + SQLite?

**Drizzle ORM** was chosen because it's dialect-agnostic. The same schema definition works with SQLite (development) and PostgreSQL (production) with minimal changes—just swap the driver.

This matters for a skills demo: SQLite means zero setup (no Docker, no database server), but the code is production-ready if you want to scale later.

**Source data** lives on disk: datasets as CSV files in `backend/datasets/`, prompts as markdown in `backend/prompts/`, graders as YAML in `backend/graders/`. **Runtime data** lives in SQLite: experiments, results, settings.

Schema uses straightforward relational design:
- `experiments` → `experiment_results` (one-to-many)
- `experiment_results` references test case IDs (CSV-derived), grader IDs (YAML-derived), and optionally candidates

Dataset, test case, and grader tables exist in the schema but are unused — the `DatasetLoaderService`, `PromptLoaderService`, and `GraderLoaderService` read files directly.

### Database Adapter Interface

The database layer uses an adapter pattern for dialect-agnostic operations:

```mermaid
classDiagram
    class IDbAdapter {
        <<interface>>
        +initialize()
        +findAllDatasets()
        +findAllGraders()
        +findAllCandidates()
        +findCandidatesByIds()
        +findCandidateVariants()
        +insertCandidate()
        +updateCandidate()
        +insertExperiment()
        +getExperimentStats()
        +upsertMetadataSchema()
        +upsertSetting()
    }

    IDbAdapter <|.. SqliteAdapter
    IDbAdapter <|.. PostgresAdapter
```

SQLite adapter includes `migrateColumns()` for seamless upgrades of existing databases when new columns are added.

**References:**
- Drizzle ORM: https://orm.drizzle.team/
- Drizzle dialect switching: https://orm.drizzle.team/docs/sql-schema-declaration

---

## Grader System

Graders are YAML files in `backend/graders/`. The `GraderLoaderService` reads them on startup and provides CRUD operations that write back to YAML. Each grader defines an evaluation strategy, configuration, and optionally the research that inspired it.

### Storage Format

```yaml
# backend/graders/faithfulness-strict.yaml
name: Faithfulness (Strict)
description: All claims must be supported by context (>90%)
type: faithfulness
config:
  threshold: 0.9
inspiration: |
  RAGAS framework (Es et al., 2023). Extracts atomic claims from the output
  and verifies each is supported by the provided context.
reference: https://arxiv.org/abs/2309.15217
```

### Base Abstraction

```typescript
interface GraderResult {
  pass: boolean;
  score: number;  // 0.0 - 1.0
  reason: string;
}

abstract class BaseGrader {
  abstract evaluate(input: EvalInput): Promise<GraderResult>;
}
```

All graders extend this base. The interface is minimal—input, output, optional expected/context, returns pass/fail with a reason.

### Grader Types

**Deterministic Graders:**

| Type | Description | Inspired By |
|------|-------------|-------------|
| `exact-match` | Binary string equality | SQuAD EM metric (Rajpurkar et al., 2016) |
| `contains` | Checks for required substrings | HELM (Liang et al., 2022) |
| `regex` | Pattern matching | Standard eval pattern |
| `json-schema` | Validates JSON structure | Function calling benchmarks |

**LLM-Powered Graders:**

| Type | Description | Inspired By |
|------|-------------|-------------|
| `llm-judge` | Evaluates against a custom rubric | LLM-as-Judge (Zheng et al., 2023) |
| `semantic-similarity` | Embedding cosine distance | Sentence-BERT (Reimers & Gurevych, 2019) |
| `faithfulness` | Claims grounded in context | RAGAS-style (Es et al., 2023) |
| `answer-relevancy` | Answer-question alignment | RAGAS-style (Es et al., 2023) |
| `context-relevancy` | Context quality for Q&A | RAGAS-style (Es et al., 2023) |

**Promptfoo-Backed Graders:**

| Type | Description | Inspired By |
|------|-------------|-------------|
| `promptfoo` | Wraps promptfoo's 40+ assertion types | promptfoo (MIT licensed) |

The `promptfoo` grader type delegates to promptfoo's battle-tested assertion engine. Configure the `assertion` in the grader's config:

```yaml
# RAGAS-style metrics via promptfoo
type: promptfoo
config:
  assertion: context-faithfulness  # or answer-relevance, context-relevance, context-recall
  threshold: 0.7

# LLM-as-judge via promptfoo
type: promptfoo
config:
  assertion: llm-rubric
  threshold: 0.7
rubric: "Evaluate accuracy, helpfulness, and clarity."

# Semantic similarity via promptfoo
type: promptfoo
config:
  assertion: similar
  threshold: 0.8
```

**Why promptfoo?** Rather than reimplementing complex metrics like RAGAS (claim extraction + NLI verification), we delegate to promptfoo's production-tested implementations. Benefits:
- MIT licensed, actively maintained
- Used by Shopify, Discord, Microsoft
- 40+ assertion types including all RAGAS-style metrics
- Saves significant development and maintenance effort

### Research References

- **RAGAS** — Es et al. 2023. "Automated Evaluation of Retrieval Augmented Generation." Faithfulness, answer relevancy, and context relevancy metrics. https://arxiv.org/abs/2309.15217
- **LLM-as-Judge** — Zheng et al. 2023. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena." Rubric-based LLM evaluation. https://arxiv.org/abs/2306.05685
- **Sentence-BERT** — Reimers & Gurevych 2019. Sentence embeddings for semantic similarity. https://arxiv.org/abs/1908.10084
- **SQuAD** — Rajpurkar et al. 2016. Reading comprehension benchmark introducing EM/F1 metrics. https://arxiv.org/abs/1606.05250
- **HELM** — Liang et al. 2022. Holistic evaluation of language models. https://arxiv.org/abs/2211.09110
- **promptfoo** — Open-source LLM eval framework. Provides the assertion engine for the `promptfoo` grader type, including all RAGAS-style metrics. https://promptfoo.dev
- **DeepEval** — Python-based eval framework with similar RAGAS-style metric implementations. https://docs.confident-ai.com/

---

## Candidate System

Candidates define **how to produce output** for each test case. This turns experiments from `dataset × graders` into `dataset × candidates × graders`.

### Runner Types

```mermaid
graph TD
    A[CandidateRunnerService] --> B{runner_type}
    B -->|llm_prompt| C[Template Interpolation → LLM Call]
    B -->|http_endpoint| D[POST to External API]
```

**LLM Prompt Runner**

Interpolates template variables and calls the configured LLM:
- `{{input}}` — test case input
- `{{context}}` — test case context
- `{{expected}}` — expected output (for few-shot patterns)
- `{{metadata.field}}` — dot notation access into test case metadata JSON

Supports per-candidate model config overrides (provider, model, temperature, maxTokens).

**HTTP Endpoint Runner**

POSTs to an external API with an interpolated JSON body template. Parses the response looking for `output`, `response`, `text`, or `result` fields. Useful for testing real pipelines.

### Variant Lineage

Candidates can reference a `parentId` to form a variant tree, tracking prompt iteration history. `variantLabel` provides a human-readable description of what changed.
Variants can be created manually or generated in batches via `POST /api/prompts/:id/variants/generate`, with per-request generation config that falls back to runtime Settings defaults.

### Presets

Candidates are now file-based markdown prompts in `backend/prompts/`. Six included: `analyst-full`, `analyst-citations`, `summarizer`, `json-extractor-strict`, `json-extractor-loose`, `text-rewriter`.

### Backwards Compatibility

`candidateIds` is nullable on experiments and `candidateId` is nullable on results. When no candidates are selected, experiments fall back to grading `expectedOutput` directly (legacy behavior).

---

## LLM Layer

The LLM service provides a unified interface over multiple providers (OpenAI, Anthropic, Ollama). Provider switching happens via environment variables or runtime settings—no code changes required.

```mermaid
graph LR
    A[LlmService] --> B{Provider}
    B -->|openai| C[OpenAI API]
    B -->|anthropic| D[Anthropic API]
    B -->|ollama| E[Ollama Local]
```

Key benefits:
- Provider switching without code changes
- Structured outputs via response schemas
- Built-in retry and fallback logic
- Streaming support for real-time feedback

For local development, Ollama integration lets you run models without API costs or rate limits.

---

## Real-Time Updates: Why SSE?

When running experiments, users need to see progress as each grader completes.

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Candidate
    participant Grader

    Client->>Server: POST /experiments (run)
    Server-->>Client: SSE connection opened
    loop Each test case
        loop Each candidate
            Server->>Candidate: run(testCase)
            Candidate-->>Server: generated output
            Server-->>Client: SSE event (generation)
            loop Each grader
                Server->>Grader: evaluate(input, output, expected)
                Grader-->>Server: result
                Server-->>Client: SSE event (result)
            end
        end
    end
    Server-->>Client: SSE event (complete)
```

**Polling** — Client repeatedly asks "done yet?" every N seconds. Simple but wasteful. Creates server load and introduces latency.

**WebSockets** — Full bidirectional communication. Overkill here. The client doesn't need to send anything during an experiment.

**SSE (Server-Sent Events)** — Server pushes updates over a long-lived HTTP connection. Advantages:
- One-way is exactly what we need (server → client)
- Auto-reconnect built into browser API
- Runs over plain HTTP—no proxy issues
- NestJS has a simple `@Sse()` decorator

**References:**
- MDN EventSource: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- NestJS SSE: https://docs.nestjs.com/techniques/server-sent-events

---

## API Documentation

The backend exposes a REST API with OpenAPI/Swagger documentation available at `/api/docs`.

```mermaid
graph TD
    A["/api/datasets"] --> B[CRUD + reload + import CSV]
    C["/api/graders"] --> D[CRUD + reload from YAML]
    K["/api/prompts"] --> L[CRUD + test + variant generation + reload from MD]
    E["/api/experiments"] --> F[Run + SSE stream + compare]
    G["/api/settings"] --> H[Runtime LLM config]
    I["/api/presets"] --> J[Grader templates + synthetic generation]
```

---

## Frontend Design

The UI uses Tailwind CSS with a clean monochromatic design—focus on the data.

Primary navigation tabs:
- **Datasets**: Inline editing, import/export (JSON/CSV), file paths, linked prompts
- **Graders**: YAML-based with expandable details, research references, reload from disk
- **Candidates**: Full detail page with frontmatter editing, save to disk, inline test panel
- **Experiments**: Run `dataset × candidates × graders`, multi-candidate results table, candidate comparison
- **Settings**: Runtime LLM configuration (provider, model, API key)

Additional page:
- **About**: Documentation and references

Source data (datasets, prompts, graders) is file-based. Runtime data (experiments, results, settings) persists in SQLite.

**References:**
- Tailwind CSS: https://tailwindcss.com/
- Next.js: https://nextjs.org/docs

---

## Testing Strategy

**Unit tests** cover grader logic with mocked LLM responses. This verifies the evaluation logic works correctly without hitting external APIs.

**Integration tests** cover full CRUD flows and experiment execution against a test SQLite database.

Jest is the test runner—industry standard, good NestJS integration.

---

## References

- Drizzle ORM: https://orm.drizzle.team/
- promptfoo: https://promptfoo.dev/docs
- RAGAS: https://arxiv.org/abs/2309.15217
- DeepEval: https://docs.confident-ai.com/
- NestJS: https://docs.nestjs.com/
- Next.js: https://nextjs.org/docs

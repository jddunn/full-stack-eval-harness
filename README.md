# Fullstack Evals Harness

A lightweight evaluation harness for running AI graders against test cases. Built with Next.js, NestJS, and Mastra.


---

## What It Does

Create datasets of test cases, define graders (evaluation criteria), and run experiments to see how your AI outputs hold up.

- **Datasets**: Tables of test cases with input/expected output
- **Graders**: Evaluation criteria (exact match, LLM judge, semantic similarity, faithfulness)
- **Experiments**: Run graders against datasets, see pass/fail results in real-time

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- (Optional) Ollama for local LLM testing

### Setup

```bash
# Clone and install
cd packages/fullstack-evals-harness-example
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
```

### Environment Variables

```bash
# LLM Provider: openai | anthropic | ollama
LLM_PROVIDER=ollama

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=dolphin-llama3:8b
```

### Run

```bash
# Start backend (port 3001)
pnpm run backend:dev

# Start frontend (port 3000)
pnpm run frontend:dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### 1. Create a Dataset

Navigate to the **Datasets** tab. Create a new dataset and add test cases:

| Input | Expected Output |
|-------|-----------------|
| What is 2+2? | 4 |
| Capital of France? | Paris |

### 2. Define Graders

Switch to the **Graders** tab. Create evaluation criteria:

- **Exact Match**: Output must match expected exactly
- **LLM Judge**: Uses an LLM with your rubric to judge pass/fail
- **Semantic Similarity**: Embedding-based similarity threshold
- **Faithfulness**: Checks if output is faithful to provided context (RAGAS-inspired)

### 3. Run an Experiment

Go to the **Experiments** tab:

1. Select a dataset
2. Select one or more graders
3. Click **Run**
4. Watch results stream in real-time

Results show pass/fail per grader. Hover for the reason.

---

## Project Structure

```
├── frontend/          # Next.js app
├── backend/           # NestJS API
├── ARCHITECTURE.md    # Design decisions and references
└── README.md          # You are here
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, Tailwind, shadcn/ui |
| Backend | NestJS |
| Database | Drizzle ORM + SQLite |
| LLM | Mastra SDK (OpenAI, Anthropic, Ollama) |
| Testing | Jest |

---

## Development

```bash
# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

---

## Grader Types

### Exact Match
Simple string comparison. Pass if output === expected.

### LLM Judge
Provide a rubric, and an LLM evaluates whether the output meets the criteria.

### Semantic Similarity
Compares embeddings of output and expected. Pass if cosine similarity exceeds threshold.

### Faithfulness
RAGAS-inspired. Extracts claims from the output and verifies each against the provided context.

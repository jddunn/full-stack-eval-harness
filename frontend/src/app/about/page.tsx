'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Zap, Database, Brain, TestTube, Server, Layout } from 'lucide-react';
import Link from 'next/link';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion-item">
      <button
        className="accordion-trigger"
        onClick={() => setIsOpen(!isOpen)}
        data-state={isOpen ? 'open' : 'closed'}
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </button>
      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
}

function TechCard({
  icon: Icon,
  title,
  description,
  link
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  link?: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-muted">
          <Icon className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg uppercase tracking-wide">{title}</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="link inline-flex items-center gap-1 mt-3 text-sm"
            >
              Learn More <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Hero Section */}
      <section>
        <h1 className="section-title text-4xl">About This Harness</h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          A lightweight, production-ready evaluation harness for running AI graders against test cases.
          Built for engineers who need to validate LLM outputs systematically.
        </p>
      </section>

      <hr className="divider" />

      {/* How It Works */}
      <section>
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
          Three core concepts power the evaluation system.
        </p>

        <div className="mt-8 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-foreground text-background px-3 py-1 text-sm font-bold">01</span>
              <h3 className="font-bold text-xl uppercase">Datasets</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Datasets are collections of test cases. Each test case has an <code>input</code> (the prompt),
              an optional <code>expected output</code> (ground truth), and optional <code>context</code>
              (for faithfulness checks). You can create datasets manually, load presets, or generate
              synthetic data using an LLM.
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-foreground text-background px-3 py-1 text-sm font-bold">02</span>
              <h3 className="font-bold text-xl uppercase">Graders</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Graders define evaluation criteria. Four types are supported:
            </p>
            <ul className="list-brutal mt-4 text-muted-foreground">
              <li><strong>Exact Match</strong> — Binary pass/fail on string equality</li>
              <li><strong>LLM Judge</strong> — Uses an LLM with your rubric to evaluate quality</li>
              <li><strong>Semantic Similarity</strong> — Embedding-based cosine similarity threshold</li>
              <li><strong>Faithfulness</strong> — RAGAS-inspired claim verification against context</li>
            </ul>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-foreground text-background px-3 py-1 text-sm font-bold">03</span>
              <h3 className="font-bold text-xl uppercase">Experiments</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Experiments combine a dataset with one or more graders. When you run an experiment,
              each test case is evaluated against each selected grader. Results stream in real-time
              via Server-Sent Events (SSE), showing pass/fail status and reasoning as each evaluation
              completes.
            </p>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* Tech Stack */}
      <section>
        <h2 className="section-title">Tech Stack</h2>
        <p className="section-subtitle">
          Modern, battle-tested technologies chosen for reliability and developer experience.
        </p>

        <div className="grid gap-6 mt-8 md:grid-cols-2">
          <TechCard
            icon={Layout}
            title="Next.js 15"
            description="React framework with App Router, server components, and excellent DX. Chosen for its performance, built-in optimizations, and industry adoption."
            link="https://nextjs.org"
          />
          <TechCard
            icon={Server}
            title="NestJS"
            description="Enterprise-grade Node.js framework with dependency injection, decorators, and modular architecture. Provides structure without boilerplate."
            link="https://nestjs.com"
          />
          <TechCard
            icon={Database}
            title="Drizzle ORM + SQLite"
            description="Type-safe ORM with zero runtime overhead. SQLite for simplicity—swap to Postgres in production with minimal changes. Dialect-agnostic design."
            link="https://orm.drizzle.team"
          />
          <TechCard
            icon={Brain}
            title="Configurable LLM"
            description="Provider-agnostic LLM layer supporting OpenAI, Anthropic, and Ollama. Switch providers via environment variables without code changes."
          />
          <TechCard
            icon={Zap}
            title="SSE Streaming"
            description="Real-time experiment progress via Server-Sent Events. Lighter than WebSockets for unidirectional updates, with built-in browser reconnection."
          />
          <TechCard
            icon={TestTube}
            title="Jest Testing"
            description="Industry-standard testing framework with excellent NestJS integration. Enables confident refactoring and regression prevention."
            link="https://jestjs.io"
          />
        </div>
      </section>

      <hr className="divider" />

      {/* FAQs */}
      <section>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-subtitle">
          Common questions about setup, usage, and design decisions.
        </p>

        <div className="mt-8">
          <AccordionItem title="Why SSE instead of WebSockets?" defaultOpen>
            <p className="text-muted-foreground leading-relaxed">
              Server-Sent Events (SSE) are ideal for unidirectional server-to-client communication.
              During experiment runs, the client only needs to <em>receive</em> updates—it doesn't
              send anything. SSE runs over plain HTTP, works through proxies and load balancers without
              special configuration, and includes built-in browser reconnection. WebSockets add complexity
              (connection upgrade, manual reconnection) that we don't need here.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong>Reference:</strong>{' '}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                MDN: Server-Sent Events <ExternalLink className="inline h-3 w-3" />
              </a>
            </p>
          </AccordionItem>

          <AccordionItem title="What is RAGAS-inspired faithfulness?">
            <p className="text-muted-foreground leading-relaxed">
              RAGAS (Retrieval Augmented Generation Assessment) is a framework for evaluating RAG
              pipelines. The faithfulness metric extracts atomic claims from an LLM's response and
              verifies each claim against the provided context. A response is faithful if all claims
              can be inferred from the context—no hallucinations.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Our implementation follows this pattern: extract claims via LLM, then verify each
              against context. Scores reflect the percentage of verifiable claims.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong>Reference:</strong>{' '}
              <a
                href="https://arxiv.org/abs/2309.15217"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                RAGAS: Automated Evaluation of RAG <ExternalLink className="inline h-3 w-3" />
              </a>
            </p>
          </AccordionItem>

          <AccordionItem title="How does semantic similarity work?">
            <p className="text-muted-foreground leading-relaxed">
              Semantic similarity compares the meaning of two texts, not their exact wording.
              Both the output and expected output are converted to embedding vectors (dense
              numerical representations), then compared using cosine similarity. A threshold
              (e.g., 0.8) determines pass/fail.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              This catches cases where the LLM produces a correct answer with different phrasing—
              "The capital is Paris" vs "Paris is France's capital" would score highly despite
              different words.
            </p>
          </AccordionItem>

          <AccordionItem title="Can I use this with my own LLM?">
            <p className="text-muted-foreground leading-relaxed">
              Yes. The LLM layer is provider-agnostic. Set <code>LLM_PROVIDER</code> in your
              <code>.env</code> file to <code>openai</code>, <code>anthropic</code>, or <code>ollama</code>.
              For Ollama, you can point to any local or network instance via <code>OLLAMA_BASE_URL</code>.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To add a new provider, implement the <code>LlmProvider</code> interface in
              <code>backend/src/llm/providers/</code>.
            </p>
          </AccordionItem>

          <AccordionItem title="Why Drizzle over Prisma?">
            <p className="text-muted-foreground leading-relaxed">
              Drizzle offers SQL-like syntax with full TypeScript inference and zero runtime overhead—
              your queries compile to plain SQL with no abstraction layer at runtime. It's also
              dialect-agnostic: switching from SQLite to Postgres requires changing a config file,
              not rewriting queries.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Prisma is excellent but adds a query engine runtime. For a lightweight harness,
              Drizzle's minimal footprint is a better fit.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong>Reference:</strong>{' '}
              <a
                href="https://orm.drizzle.team/docs/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Drizzle ORM Documentation <ExternalLink className="inline h-3 w-3" />
              </a>
            </p>
          </AccordionItem>

          <AccordionItem title="How do I add custom grader types?">
            <p className="text-muted-foreground leading-relaxed">
              Graders extend the <code>BaseGrader</code> abstract class. Implement the <code>evaluate</code>
              method that takes <code>input</code>, <code>output</code>, and optional <code>expected</code>/<code>context</code>,
              then returns a <code>GraderResult</code> with <code>pass</code>, <code>score</code>, and <code>reason</code>.
            </p>
            <pre className="mt-4 text-xs">
{`interface GraderResult {
  pass: boolean;
  score: number;  // 0.0 - 1.0
  reason: string;
}

abstract class BaseGrader {
  abstract evaluate(
    input: string,
    output: string,
    expected?: string,
    context?: string
  ): Promise<GraderResult>;
}`}
            </pre>
          </AccordionItem>

          <AccordionItem title="Is this production-ready?">
            <p className="text-muted-foreground leading-relaxed">
              This harness is designed for evaluation workflows—not as a production inference layer.
              It's excellent for:
            </p>
            <ul className="list-brutal mt-3 text-muted-foreground">
              <li>Pre-deployment prompt/model validation</li>
              <li>Regression testing after prompt changes</li>
              <li>Comparing model versions</li>
              <li>CI/CD integration for LLM pipelines</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              For high-scale production evals, consider dedicated platforms like Braintrust,
              Langsmith, or Arize.
            </p>
          </AccordionItem>
        </div>
      </section>

      <hr className="divider" />

      {/* Roadmap */}
      <section>
        <h2 className="section-title">Roadmap</h2>
        <p className="section-subtitle">
          Planned improvements and future directions.
        </p>

        <div className="mt-8 space-y-4">
          <div className="card-inset p-5">
            <div className="flex items-center gap-3">
              <span className="badge-neutral">Planned</span>
              <h3 className="font-bold uppercase">CSV/JSON Import & Export</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Import test cases from existing datasets. Export experiment results for further analysis
              in spreadsheets or BI tools.
            </p>
          </div>

          <div className="card-inset p-5">
            <div className="flex items-center gap-3">
              <span className="badge-neutral">Planned</span>
              <h3 className="font-bold uppercase">Aggregate Statistics</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Dashboard with pass rates, score distributions, and trend analysis across experiments.
              Identify regressions and improvements at a glance.
            </p>
          </div>

          <div className="card-inset p-5">
            <div className="flex items-center gap-3">
              <span className="badge-neutral">Planned</span>
              <h3 className="font-bold uppercase">Custom Rubric Templates</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Pre-built rubric templates for common evaluation scenarios: code review, factual accuracy,
              tone analysis, safety checks.
            </p>
          </div>

          <div className="card-inset p-5">
            <div className="flex items-center gap-3">
              <span className="badge-neutral">Planned</span>
              <h3 className="font-bold uppercase">CI/CD Integration</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              GitHub Actions workflow and CLI for running evaluations in CI. Fail builds when pass
              rates drop below thresholds.
            </p>
          </div>

          <div className="card-inset p-5">
            <div className="flex items-center gap-3">
              <span className="badge-neutral">Exploring</span>
              <h3 className="font-bold uppercase">Human-in-the-Loop</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Manual review interface for ambiguous cases. Capture human judgments to calibrate
              LLM graders and build labeled datasets.
            </p>
          </div>

          <div className="card-inset p-5">
            <div className="flex items-center gap-3">
              <span className="badge-neutral">Exploring</span>
              <h3 className="font-bold uppercase">Multi-Turn Evaluation</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Evaluate conversation flows, not just single turns. Test coherence, context retention,
              and dialogue quality across exchanges.
            </p>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* References */}
      <section>
        <h2 className="section-title">References & Citations</h2>
        <p className="section-subtitle">
          Research and tools that informed this project.
        </p>

        <div className="mt-8 space-y-4">
          <div className="card p-5">
            <h3 className="font-bold uppercase">RAGAS: Automated Evaluation of Retrieval Augmented Generation</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Es, S., et al. (2023). Introduces faithfulness, answer relevance, and context metrics
              for RAG evaluation. Our faithfulness grader follows their claim extraction and
              verification methodology.
            </p>
            <a
              href="https://arxiv.org/abs/2309.15217"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm mt-3 inline-flex items-center gap-1"
            >
              arxiv.org/abs/2309.15217 <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="card p-5">
            <h3 className="font-bold uppercase">Promptfoo</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Open-source LLM testing framework. Inspired our assertion patterns and grader
              architecture. Their YAML-based config influenced our preset system.
            </p>
            <a
              href="https://promptfoo.dev/docs/configuration/expected-outputs"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm mt-3 inline-flex items-center gap-1"
            >
              promptfoo.dev <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="card p-5">
            <h3 className="font-bold uppercase">DeepEval</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Unit testing framework for LLMs. Influenced our programmatic grader interface and
              the decision to make graders composable classes rather than config-only.
            </p>
            <a
              href="https://docs.confident-ai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm mt-3 inline-flex items-center gap-1"
            >
              docs.confident-ai.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="card p-5">
            <h3 className="font-bold uppercase">Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Zheng, L., et al. (2023). Research on using LLMs to evaluate LLM outputs.
              Informed our LLM Judge grader design and rubric prompting patterns.
            </p>
            <a
              href="https://arxiv.org/abs/2306.05685"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm mt-3 inline-flex items-center gap-1"
            >
              arxiv.org/abs/2306.05685 <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="card p-5">
            <h3 className="font-bold uppercase">Anthropic's Model Card & Evaluations</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Anthropic's approach to model evaluation, including factual accuracy and harmful
              output detection. Influenced safety-oriented grader considerations.
            </p>
            <a
              href="https://www.anthropic.com/research"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm mt-3 inline-flex items-center gap-1"
            >
              anthropic.com/research <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      <hr className="divider-dashed" />

      {/* CTA */}
      <section className="text-center py-8">
        <p className="text-muted-foreground mb-6">
          Ready to evaluate your LLM outputs?
        </p>
        <Link href="/datasets" className="btn-primary">
          Get Started
        </Link>
      </section>
    </div>
  );
}

import { BaseGrader, EvalInput, GraderResult, GraderConfig } from './base.grader';
import { LlmService } from '../llm/llm.service';

type PromptfooAssertion = {
  type: string;
  threshold?: number;
  value?: string;
  provider?: string;
};

/**
 * Promptfoo-backed grader - uses promptfoo's assertion engine.
 *
 * This provides access to promptfoo's battle-tested assertions including:
 * - context-faithfulness (RAGAS faithfulness)
 * - answer-relevance (RAGAS answer relevancy)
 * - context-relevance (RAGAS context relevancy)
 * - context-recall (RAGAS context recall)
 * - similar (semantic similarity via embeddings)
 * - llm-rubric (LLM-as-judge)
 * - factuality (OpenAI factuality)
 * - And 40+ more assertion types
 *
 * Supports multiple providers via Settings:
 * - OpenAI (gpt-4o, etc.)
 * - Anthropic (claude-sonnet-4-5, etc.)
 * - Ollama (llama3, mistral, etc.)
 *
 * Reference: https://promptfoo.dev/docs/configuration/expected-outputs/
 */
export class PromptfooGrader extends BaseGrader {
  private assertion: string;
  private threshold: number;

  constructor(
    graderConfig: GraderConfig,
    private llmService: LlmService,
  ) {
    super(graderConfig);

    // Get promptfoo assertion type from config
    this.assertion = this.getConfigValue('assertion', 'llm-rubric');
    this.threshold = this.getConfigValue('threshold', 0.7);
  }

  get type(): string {
    return 'promptfoo';
  }

  async evaluate(evalInput: EvalInput): Promise<GraderResult> {
    const { input, output, expected, context } = evalInput;

    try {
      const { evaluate } = await import('promptfoo');

      // Build the promptfoo assertion based on type
      const assertion = this.buildAssertion(expected, context);

      // Get provider config from LlmService settings
      const providerConfig = await this.getProviderConfig();

      // Run promptfoo evaluation
      // We use an "echo" provider that just returns the output we already have
      const result = await evaluate({
        prompts: [output], // The output we're evaluating
        providers: [
          {
            id: () => 'echo',
            callApi: async () => ({ output }),
          } as any, // Custom echo provider
        ],
        tests: [{
          vars: {
            query: input,
            context: context || '',
            expected: expected || '',
          },
          assert: [assertion as any],
        }],
        // Pass provider env vars
        env: providerConfig.env,
        // Default provider for LLM-based assertions
        defaultTest: {
          options: {
            provider: providerConfig.provider,
          },
        },
      });

      return this.parsePromptfooResult(result);
    } catch (error) {
      return {
        pass: false,
        score: 0,
        reason: `Promptfoo evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get provider configuration from LlmService settings.
   */
  private async getProviderConfig(): Promise<{ provider?: string; env?: Record<string, string> }> {
    const settings = await this.llmService.getFullSettings();
    const env: Record<string, string> = {};

    // Map our provider names to promptfoo provider format
    let provider: string | undefined;

    switch (settings.provider) {
      case 'openai':
        provider = settings.model ? `openai:${settings.model}` : 'openai:gpt-4o';
        if (settings.apiKey) {
          env.OPENAI_API_KEY = settings.apiKey;
        } else if (process.env.OPENAI_API_KEY) {
          env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        }
        break;

      case 'anthropic':
        provider = settings.model ? `anthropic:messages:${settings.model}` : 'anthropic:messages:claude-sonnet-4-5-20250929';
        if (settings.apiKey) {
          env.ANTHROPIC_API_KEY = settings.apiKey;
        } else if (process.env.ANTHROPIC_API_KEY) {
          env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        }
        break;

      case 'ollama':
        const baseUrl = settings.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        provider = settings.model ? `ollama:${settings.model}` : 'ollama:llama3';
        env.OLLAMA_BASE_URL = baseUrl;
        break;

      default:
        // Fallback to OpenAI
        provider = 'openai:gpt-4o';
        if (process.env.OPENAI_API_KEY) {
          env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        }
    }

    return { provider, env };
  }

  /**
   * Build a promptfoo assertion based on the configured type.
   */
  private buildAssertion(expected?: string, context?: string): PromptfooAssertion {
    const baseAssertion: PromptfooAssertion = {
      type: this.assertion,
      threshold: this.threshold,
    };

    // Add type-specific configuration
    switch (this.assertion) {
      case 'llm-rubric':
        // Use the grader's rubric for LLM-based evaluation
        return {
          ...baseAssertion,
          value: this.rubric || 'Evaluate if the response is accurate, helpful, and well-structured.',
        };

      case 'similar':
        // Semantic similarity against expected output
        return {
          ...baseAssertion,
          value: expected || '',
        };

      case 'context-faithfulness':
      case 'answer-relevance':
      case 'context-relevance':
      case 'context-recall':
        // RAGAS-style metrics - context is passed via vars
        return baseAssertion;

      case 'contains':
      case 'equals':
      case 'regex':
        // Simple assertions need a value
        return {
          ...baseAssertion,
          value: expected || '',
        };

      case 'factuality':
        // OpenAI factuality check
        return baseAssertion;

      default:
        return baseAssertion;
    }
  }

  /**
   * Parse promptfoo's evaluation result into our GraderResult format.
   */
  private parsePromptfooResult(result: any): GraderResult {
    // Get the first (and only) test result
    const testResult = result.results?.[0];

    if (!testResult) {
      return {
        pass: false,
        score: 0,
        reason: 'No results from promptfoo evaluation',
      };
    }

    // Get assertion results
    const assertionResult = testResult.gradingResult;

    if (!assertionResult) {
      return {
        pass: testResult.success,
        score: testResult.success ? 1 : 0,
        reason: testResult.error || 'Evaluation completed',
      };
    }

    // Build reason from component results
    const reasons: string[] = [];
    if (assertionResult.reason) {
      reasons.push(assertionResult.reason);
    }
    if (assertionResult.componentResults) {
      for (const component of assertionResult.componentResults) {
        if (component.reason) {
          reasons.push(component.reason);
        }
      }
    }

    return {
      pass: assertionResult.pass,
      score: assertionResult.score ?? (assertionResult.pass ? 1 : 0),
      reason: reasons.join('. ') || `${this.assertion} evaluation: ${assertionResult.pass ? 'passed' : 'failed'}`,
    };
  }
}

/**
 * Available promptfoo assertion types for reference.
 * See: https://promptfoo.dev/docs/configuration/expected-outputs/
 */
export const PROMPTFOO_ASSERTIONS = {
  // Deterministic
  equals: 'Exact string match',
  contains: 'Output contains substring',
  regex: 'Output matches regex pattern',
  'is-json': 'Output is valid JSON',
  'is-valid-function-call': 'Valid function call format',

  // Semantic
  similar: 'Cosine similarity via embeddings',
  classifier: 'ML classifier evaluation',

  // LLM-as-Judge
  'llm-rubric': 'LLM evaluates against custom rubric',
  'g-eval': 'Chain-of-thought evaluation',
  factuality: 'OpenAI factuality check',
  'model-graded-closedqa': 'OpenAI closed QA evaluation',

  // RAGAS metrics (RAG evaluation)
  'context-faithfulness': 'Claims grounded in context (hallucination detection)',
  'answer-relevance': 'Answer relevant to query',
  'context-relevance': 'Retrieved context relevant to query',
  'context-recall': 'Ground truth present in context',

  // NLP metrics
  'rouge-n': 'ROUGE-N overlap score',
  bleu: 'BLEU translation quality',
  levenshtein: 'Edit distance score',

  // Safety
  'is-refusal': 'Model refused the task',
  guardrails: 'Harmful content detection',
} as const;

export type PromptfooAssertionType = keyof typeof PROMPTFOO_ASSERTIONS;

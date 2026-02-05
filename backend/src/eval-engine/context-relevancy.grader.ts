import { BaseGrader, EvalInput, GraderResult } from './base.grader';
import { LlmService } from '../llm/llm.service';

/**
 * Context Relevancy grader - RAGAS-inspired evaluation.
 *
 * Measures if the retrieved context is relevant to the question by:
 * 1. Splitting context into sentences
 * 2. Using an LLM to identify which sentences are relevant to the question
 * 3. Score = relevant sentences / total sentences
 *
 * Config options:
 * - threshold: Minimum score to pass (default: 0.7)
 *
 * Reference: RAGAS paper - https://arxiv.org/abs/2309.15217
 */
export class ContextRelevancyGrader extends BaseGrader {
  constructor(
    graderConfig: { name: string; description?: string; config?: Record<string, unknown> },
    private llmService: LlmService
  ) {
    super(graderConfig);
  }

  get type(): string {
    return 'context-relevancy';
  }

  async evaluate(evalInput: EvalInput): Promise<GraderResult> {
    const { input, context } = evalInput;

    if (!context) {
      return {
        pass: false,
        score: 0,
        reason:
          'No context provided for context relevancy evaluation. This grader requires context.',
      };
    }

    if (!input || input.trim().length === 0) {
      return {
        pass: false,
        score: 0,
        reason: 'No input/question provided for context relevancy evaluation',
      };
    }

    const threshold = this.getConfigValue('threshold', 0.7);

    try {
      // Split context into sentences
      const allSentences = this.splitIntoSentences(context);

      if (allSentences.length === 0) {
        return {
          pass: true,
          score: 1.0,
          reason: 'No sentences found in context to evaluate',
        };
      }

      // Use LLM to identify relevant sentences
      const relevantIndices = await this.extractRelevantSentences(input, allSentences);

      const score = relevantIndices.length / allSentences.length;
      const pass = score >= threshold;

      return {
        pass,
        score,
        reason: `${relevantIndices.length}/${allSentences.length} context sentences relevant to the question (${(score * 100).toFixed(1)}%). Threshold: ${(threshold * 100).toFixed(0)}%`,
      };
    } catch (error) {
      return {
        pass: false,
        score: 0,
        reason: `Context relevancy evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
  }

  private async extractRelevantSentences(
    question: string,
    allSentences: string[]
  ): Promise<number[]> {
    const prompt = `Given a question and a list of sentences from a context document, identify which sentences are relevant to answering the question.

QUESTION: "${question}"

SENTENCES:
${allSentences.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Return ONLY a JSON array of the sentence numbers (1-indexed) that are relevant to answering the question.
If no sentences are relevant, return an empty array [].

Example: [1, 3, 5]

JSON ARRAY:`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.1,
      maxTokens: 500,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const indices = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(indices)) return [];

      return indices.filter(
        (i: unknown) => typeof i === 'number' && i >= 1 && i <= allSentences.length
      );
    } catch {
      return [];
    }
  }
}

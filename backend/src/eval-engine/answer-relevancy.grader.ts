import { BaseGrader, EvalInput, GraderResult } from './base.grader';
import { LlmService } from '../llm/llm.service';

/**
 * Answer Relevancy grader - RAGAS-inspired evaluation.
 *
 * Measures if the answer is relevant to the question by:
 * 1. Generating N hypothetical questions from the answer
 * 2. Computing cosine similarity between each generated question and the original
 * 3. Averaging similarities as the final score
 *
 * Config options:
 * - threshold: Minimum score to pass (default: 0.7)
 * - numQuestions: Number of questions to generate (default: 3)
 *
 * Reference: RAGAS paper - https://arxiv.org/abs/2309.15217
 */
export class AnswerRelevancyGrader extends BaseGrader {
  constructor(
    graderConfig: { name: string; description?: string; config?: Record<string, unknown> },
    private llmService: LlmService
  ) {
    super(graderConfig);
  }

  get type(): string {
    return 'answer-relevancy';
  }

  async evaluate(evalInput: EvalInput): Promise<GraderResult> {
    const { input, output } = evalInput;

    if (!input || input.trim().length === 0) {
      return {
        pass: false,
        score: 0,
        reason: 'No input/question provided for answer relevancy evaluation',
      };
    }

    if (!output || output.trim().length === 0) {
      return {
        pass: false,
        score: 0,
        reason: 'Empty output cannot be evaluated for relevancy',
      };
    }

    const threshold = this.getConfigValue('threshold', 0.7);
    const numQuestions = this.getConfigValue('numQuestions', 3);

    try {
      // Step 1: Generate hypothetical questions from the answer
      const generatedQuestions = await this.generateQuestionsFromAnswer(output, numQuestions);

      if (generatedQuestions.length === 0) {
        return {
          pass: false,
          score: 0,
          reason: 'Could not generate hypothetical questions from the answer',
        };
      }

      // Step 2: Compute embeddings and similarities
      const similarities = await this.computeSimilarities(input, generatedQuestions);

      // Step 3: Average similarity
      const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
      const pass = avgSimilarity >= threshold;

      return {
        pass,
        score: avgSimilarity,
        reason: this.buildReason(avgSimilarity, threshold, generatedQuestions, similarities),
      };
    } catch (error) {
      return {
        pass: false,
        score: 0,
        reason: `Answer relevancy evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async generateQuestionsFromAnswer(
    answer: string,
    numQuestions: number
  ): Promise<string[]> {
    const prompt = `Given the following answer, generate exactly ${numQuestions} questions that this answer could be responding to.
The questions should be diverse but all directly answerable by the given answer.

ANSWER:
"""
${answer}
"""

Respond with ONLY a JSON array of ${numQuestions} question strings.
Example: ["What is X?", "How does Y work?", "When was Z created?"]

JSON ARRAY:`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const questions = JSON.parse(jsonMatch[0]);
      return Array.isArray(questions)
        ? questions.filter((q: unknown) => typeof q === 'string' && q.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  private async computeSimilarities(
    originalQuestion: string,
    generatedQuestions: string[]
  ): Promise<number[]> {
    const [originalEmbedding, ...generatedEmbeddings] = await Promise.all([
      this.llmService.embed(originalQuestion),
      ...generatedQuestions.map((q) => this.llmService.embed(q)),
    ]);

    return generatedEmbeddings.map((genEmb) => this.cosineSimilarity(originalEmbedding, genEmb));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) return 0;
    // Normalize from [-1, 1] to [0, 1]
    return (dotProduct / (normA * normB) + 1) / 2;
  }

  private buildReason(
    score: number,
    threshold: number,
    questions: string[],
    similarities: number[]
  ): string {
    const parts: string[] = [];
    parts.push(
      `Answer relevancy: ${(score * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(0)}%)`
    );
    parts.push(`Generated ${questions.length} hypothetical question(s)`);

    const bestIdx = similarities.indexOf(Math.max(...similarities));
    if (bestIdx >= 0) {
      parts.push(
        `Best match: "${questions[bestIdx].slice(0, 80)}" (${(similarities[bestIdx] * 100).toFixed(1)}%)`
      );
    }

    return parts.join('. ');
  }
}

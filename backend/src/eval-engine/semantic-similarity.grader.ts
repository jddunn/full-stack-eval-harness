import { BaseGrader, EvalInput, GraderResult } from './base.grader';
import { LlmService } from '../llm/llm.service';

/**
 * Semantic similarity grader - compares embeddings of output and expected.
 *
 * Uses cosine similarity between embedding vectors.
 * Pass threshold is configurable (default: 0.8).
 *
 * Good for cases where exact wording doesn't matter but meaning should align.
 */
export class SemanticSimilarityGrader extends BaseGrader {
  constructor(
    graderConfig: { name: string; description?: string; config?: Record<string, unknown> },
    private llmService: LlmService,
  ) {
    super(graderConfig);
  }

  get type(): string {
    return 'semantic-similarity';
  }

  async evaluate(evalInput: EvalInput): Promise<GraderResult> {
    const { output, expected } = evalInput;

    if (!expected) {
      return {
        pass: false,
        score: 0,
        reason: 'No expected output provided for semantic similarity comparison',
      };
    }

    const threshold = this.getConfigValue('threshold', 0.8);

    try {
      // Get embeddings for both strings
      const [outputEmbedding, expectedEmbedding] = await Promise.all([
        this.llmService.embed(output),
        this.llmService.embed(expected),
      ]);

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(outputEmbedding, expectedEmbedding);
      const pass = similarity >= threshold;

      return {
        pass,
        score: similarity,
        reason: pass
          ? `Semantic similarity ${(similarity * 100).toFixed(1)}% meets threshold ${(threshold * 100).toFixed(0)}%`
          : `Semantic similarity ${(similarity * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(0)}%`,
      };
    } catch (error) {
      return {
        pass: false,
        score: 0,
        reason: `Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

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

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

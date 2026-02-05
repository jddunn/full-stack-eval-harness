import { BaseGrader, EvalInput, GraderResult } from './base.grader';
import { LlmService } from '../llm/llm.service';

/**
 * Faithfulness grader - RAGAS-inspired evaluation.
 *
 * Checks if the output is faithful to the provided context.
 * Process:
 * 1. Extract factual claims from the output
 * 2. For each claim, verify if it's supported by the context
 * 3. Score = (supported claims) / (total claims)
 *
 * Useful for detecting hallucinations in RAG systems.
 *
 * Reference: https://arxiv.org/abs/2309.15217
 */
export class FaithfulnessGrader extends BaseGrader {
  constructor(
    graderConfig: { name: string; description?: string; config?: Record<string, unknown> },
    private llmService: LlmService,
  ) {
    super(graderConfig);
  }

  get type(): string {
    return 'faithfulness';
  }

  async evaluate(evalInput: EvalInput): Promise<GraderResult> {
    const { output, context } = evalInput;

    if (!context) {
      return {
        pass: false,
        score: 0,
        reason: 'No context provided for faithfulness evaluation',
      };
    }

    const threshold = this.getConfigValue('threshold', 0.8);

    try {
      // Step 1: Extract claims from the output
      const claims = await this.extractClaims(output);

      if (claims.length === 0) {
        return {
          pass: true,
          score: 1.0,
          reason: 'No factual claims found in output',
        };
      }

      // Step 2: Verify each claim against context
      const verifications = await this.verifyClaims(claims, context);

      // Step 3: Calculate faithfulness score
      const supportedCount = verifications.filter((v) => v.supported).length;
      const score = supportedCount / claims.length;
      const pass = score >= threshold;

      // Build detailed reason
      const unsupported = verifications
        .filter((v) => !v.supported)
        .map((v) => v.claim);

      let reason = `${supportedCount}/${claims.length} claims supported by context (${(score * 100).toFixed(0)}%)`;
      if (unsupported.length > 0 && unsupported.length <= 3) {
        reason += `. Unsupported: "${unsupported.join('", "')}"`;
      }

      return { pass, score, reason };
    } catch (error) {
      return {
        pass: false,
        score: 0,
        reason: `Faithfulness evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Extract factual claims from the output text.
   */
  private async extractClaims(output: string): Promise<string[]> {
    const prompt = `Extract all factual claims from the following text. Return as a JSON array of strings.
Only include objective, verifiable statements. Skip opinions and questions.

Text:
${output}

Respond with ONLY a JSON array like: ["claim 1", "claim 2", ...]`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.1,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const claims = JSON.parse(jsonMatch[0]);
      return Array.isArray(claims) ? claims.filter((c: unknown) => typeof c === 'string') : [];
    } catch {
      return [];
    }
  }

  /**
   * Verify each claim against the provided context.
   */
  private async verifyClaims(
    claims: string[],
    context: string,
  ): Promise<Array<{ claim: string; supported: boolean }>> {
    const prompt = `For each claim, determine if it is supported by the context.

Context:
${context}

Claims to verify:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each claim, respond with whether it is SUPPORTED or NOT SUPPORTED by the context.
Respond with ONLY a JSON array like: [{"claim": "...", "supported": true/false}, ...]`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.1,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Fallback: assume all claims are unsupported
        return claims.map((claim) => ({ claim, supported: false }));
      }

      const results = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(results)) {
        return claims.map((claim) => ({ claim, supported: false }));
      }

      return results.map((r: { claim?: string; supported?: boolean }, i: number) => ({
        claim: r.claim || claims[i] || '',
        supported: Boolean(r.supported),
      }));
    } catch {
      return claims.map((claim) => ({ claim, supported: false }));
    }
  }
}

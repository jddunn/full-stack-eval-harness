import { BaseGrader, EvalInput, GraderResult } from './base.grader';
import { LlmService } from '../llm/llm.service';

/**
 * Claim verification result with detailed metadata.
 */
interface ClaimVerification {
  claim: string;
  supported: boolean;
  confidence: number; // 0.0 - 1.0
  evidence: string | null;
  reasoning: string;
}

/**
 * Detailed faithfulness analysis result.
 */
interface FaithfulnessAnalysis {
  claims: ClaimVerification[];
  supportedCount: number;
  totalClaims: number;
  score: number;
  hallucinations: string[];
}

/**
 * Faithfulness grader - RAGAS-inspired evaluation for RAG systems.
 *
 * Evaluates whether the generated output is faithful to the provided context.
 * This is critical for detecting hallucinations in retrieval-augmented generation.
 *
 * Process (following RAGAS methodology):
 * 1. Extract atomic factual claims from the output
 * 2. For each claim, perform NLI-style verification against context
 * 3. Calculate faithfulness score = (supported claims) / (total claims)
 * 4. Provide detailed reasoning for each verification
 *
 * Configuration options:
 * - threshold: Minimum score to pass (default: 0.8)
 * - strictMode: Fail on any hallucination (default: false)
 * - includePartialSupport: Count partially supported claims (default: false)
 *
 * Reference: RAGAS paper - https://arxiv.org/abs/2309.15217
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
        reason: 'No context provided for faithfulness evaluation. Faithfulness grader requires context to verify claims against.',
      };
    }

    if (!output || output.trim().length === 0) {
      return {
        pass: true,
        score: 1.0,
        reason: 'Empty output - no claims to verify',
      };
    }

    const threshold = this.getConfigValue('threshold', 0.8);
    const strictMode = this.getConfigValue('strictMode', false);
    const includePartialSupport = this.getConfigValue('includePartialSupport', false);

    try {
      // Step 1: Extract atomic claims from the output
      const claims = await this.extractAtomicClaims(output);

      if (claims.length === 0) {
        return {
          pass: true,
          score: 1.0,
          reason: 'No verifiable factual claims found in output',
        };
      }

      // Step 2: Verify each claim against context using NLI
      const analysis = await this.analyzeClaimsWithNLI(claims, context, includePartialSupport);

      // Step 3: Calculate final score and determine pass/fail
      const pass = strictMode
        ? analysis.hallucinations.length === 0
        : analysis.score >= threshold;

      // Build detailed reason
      const reason = this.buildDetailedReason(analysis, threshold, strictMode);

      return {
        pass,
        score: analysis.score,
        reason,
      };
    } catch (error) {
      return {
        pass: false,
        score: 0,
        reason: `Faithfulness evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Extract atomic factual claims from the output text.
   * Atomic claims are single, verifiable statements that cannot be broken down further.
   */
  private async extractAtomicClaims(output: string): Promise<string[]> {
    const prompt = `You are a precise claim extractor. Your task is to break down the following text into atomic factual claims.

RULES:
1. Each claim must be a single, verifiable fact
2. Each claim must be self-contained (understandable without context)
3. Skip opinions, questions, hedged statements ("might", "could", "maybe")
4. Skip meta-statements about the response itself
5. Convert relative references to absolute where possible
6. Keep claims atomic - one fact per claim

TEXT TO ANALYZE:
"""
${output}
"""

Extract all atomic factual claims. Respond with ONLY a JSON array of strings.
Example format: ["The capital of France is Paris", "Water boils at 100 degrees Celsius"]

JSON ARRAY:`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.1,
      maxTokens: 2000,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const claims = JSON.parse(jsonMatch[0]);
      return Array.isArray(claims)
        ? claims.filter((c: unknown) => typeof c === 'string' && c.trim().length > 0)
        : [];
    } catch {
      // Fallback: simple sentence splitting
      return output
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
    }
  }

  /**
   * Verify claims using Natural Language Inference (NLI) style reasoning.
   */
  private async analyzeClaimsWithNLI(
    claims: string[],
    context: string,
    includePartialSupport: boolean,
  ): Promise<FaithfulnessAnalysis> {
    // Process claims in batches to avoid token limits
    const batchSize = 5;
    const allVerifications: ClaimVerification[] = [];

    for (let i = 0; i < claims.length; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      const verifications = await this.verifyClaimBatch(batch, context);
      allVerifications.push(...verifications);
    }

    // Calculate supported count based on configuration
    const supportedCount = allVerifications.filter((v) => {
      if (v.supported) return true;
      if (includePartialSupport && v.confidence >= 0.5) return true;
      return false;
    }).length;

    const score = claims.length > 0 ? supportedCount / claims.length : 1.0;

    const hallucinations = allVerifications
      .filter((v) => !v.supported && v.confidence < 0.5)
      .map((v) => v.claim);

    return {
      claims: allVerifications,
      supportedCount,
      totalClaims: claims.length,
      score,
      hallucinations,
    };
  }

  /**
   * Verify a batch of claims against the context.
   */
  private async verifyClaimBatch(
    claims: string[],
    context: string,
  ): Promise<ClaimVerification[]> {
    const prompt = `You are a precise fact-checker using Natural Language Inference. For each claim, determine if it is ENTAILED (supported), CONTRADICTED, or NEUTRAL (not enough information) based ONLY on the provided context.

CONTEXT:
"""
${context}
"""

CLAIMS TO VERIFY:
${claims.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

For each claim, provide:
- supported: true if ENTAILED by context, false otherwise
- confidence: 0.0-1.0 (how certain you are)
- evidence: quote from context that supports/contradicts (or null if none)
- reasoning: brief explanation of your verdict

Respond with ONLY a JSON array:
[
  {
    "claim": "...",
    "supported": true/false,
    "confidence": 0.0-1.0,
    "evidence": "quote" or null,
    "reasoning": "..."
  }
]

JSON ARRAY:`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.1,
      maxTokens: 2000,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return claims.map((claim) => ({
          claim,
          supported: false,
          confidence: 0,
          evidence: null,
          reasoning: 'Failed to parse verification response',
        }));
      }

      const results = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(results)) {
        return claims.map((claim) => ({
          claim,
          supported: false,
          confidence: 0,
          evidence: null,
          reasoning: 'Invalid verification response format',
        }));
      }

      return results.map((r: Partial<ClaimVerification>, i: number) => ({
        claim: r.claim || claims[i] || '',
        supported: Boolean(r.supported),
        confidence: typeof r.confidence === 'number' ? r.confidence : 0,
        evidence: r.evidence || null,
        reasoning: r.reasoning || 'No reasoning provided',
      }));
    } catch {
      return claims.map((claim) => ({
        claim,
        supported: false,
        confidence: 0,
        evidence: null,
        reasoning: 'JSON parsing failed',
      }));
    }
  }

  /**
   * Build a detailed reason string from the analysis.
   */
  private buildDetailedReason(
    analysis: FaithfulnessAnalysis,
    threshold: number,
    strictMode: boolean,
  ): string {
    const parts: string[] = [];

    // Main score summary
    parts.push(
      `${analysis.supportedCount}/${analysis.totalClaims} claims supported by context (${(analysis.score * 100).toFixed(1)}%)`,
    );

    // Threshold info
    if (strictMode) {
      parts.push(`Strict mode: ${analysis.hallucinations.length === 0 ? 'no hallucinations detected' : `${analysis.hallucinations.length} hallucination(s) found`}`);
    } else {
      parts.push(`Threshold: ${(threshold * 100).toFixed(0)}%`);
    }

    // List hallucinations if any (limit to 3)
    if (analysis.hallucinations.length > 0) {
      const shown = analysis.hallucinations.slice(0, 3);
      parts.push(`Unsupported claims: "${shown.join('", "')}"`);
      if (analysis.hallucinations.length > 3) {
        parts.push(`... and ${analysis.hallucinations.length - 3} more`);
      }
    }

    return parts.join('. ');
  }
}

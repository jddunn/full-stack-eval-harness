import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

export interface SyntheticTestCase {
  input: string;
  expectedOutput: string;
  context?: string;
}

export interface SyntheticGenerationRequest {
  topic: string;
  count: number;
  style: 'qa' | 'classification' | 'extraction' | 'rag';
  customInstructions?: string;
}

interface ThoughtBranch {
  approach: string;
  testCases: SyntheticTestCase[];
}

const NUM_BRANCHES = 3;

@Injectable()
export class SyntheticService {
  constructor(private llmService: LlmService) {}

  /**
   * Generate synthetic test cases using Tree of Thought prompting.
   *
   * 1. Brainstorm: generate multiple diverse approaches to the topic
   * 2. Expand: generate test cases for each approach in parallel
   * 3. Evaluate: score branches on diversity, realism, and accuracy
   * 4. Synthesize: merge the best test cases into the final set
   */
  async generateTestCases(
    request: SyntheticGenerationRequest,
  ): Promise<SyntheticTestCase[]> {
    // Step 1: Brainstorm diverse approaches
    const approaches = await this.brainstormApproaches(request);

    // Step 2: Expand each approach into test cases (parallel)
    const branches = await Promise.all(
      approaches.map((approach) =>
        this.expandBranch(request, approach),
      ),
    );

    // Step 3: Evaluate and synthesize the best test cases
    return this.evaluateAndSynthesize(request, branches);
  }

  /**
   * Step 1 — Brainstorm: ask the LLM to propose multiple distinct angles
   * for generating test data on the given topic.
   */
  private async brainstormApproaches(
    request: SyntheticGenerationRequest,
  ): Promise<string[]> {
    const styleContext = {
      qa: 'question-answer pairs',
      classification: 'text classification samples',
      extraction: 'information extraction passages',
      rag: 'retrieval-augmented QA with context documents',
    };

    const prompt = `You are an expert test-data architect. Your task is to brainstorm ${NUM_BRANCHES} distinct approaches for generating synthetic ${styleContext[request.style]} about "${request.topic}".

Each approach should explore the topic from a DIFFERENT angle to maximise diversity:
- Approach 1: Focus on common, straightforward cases
- Approach 2: Focus on edge cases, ambiguities, or tricky variations
- Approach 3: Focus on domain-specific depth or real-world complexity

${request.customInstructions ? `Additional context: ${request.customInstructions}` : ''}

Output a JSON array of exactly ${NUM_BRANCHES} strings, where each string is a concise description (1-2 sentences) of the approach.
Only output valid JSON, no markdown formatting.`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.9,
      maxTokens: 512,
    });

    try {
      const parsed = this.extractJson<string[]>(response);
      if (Array.isArray(parsed) && parsed.length >= NUM_BRANCHES) {
        return parsed.slice(0, NUM_BRANCHES);
      }
    } catch {
      // fall through
    }

    // Fallback: generate generic approaches
    return [
      `Common, straightforward ${styleContext[request.style]} about ${request.topic}`,
      `Edge cases and tricky variations for ${request.topic}`,
      `Real-world, domain-specific scenarios for ${request.topic}`,
    ];
  }

  /**
   * Step 2 — Expand: generate a full set of test cases for one approach.
   */
  private async expandBranch(
    request: SyntheticGenerationRequest,
    approach: string,
  ): Promise<ThoughtBranch> {
    const styleInstructions = {
      qa: `Generate question-answer pairs. Each question should have a clear, concise answer.`,
      classification: `Generate text samples with their correct classification labels. Common categories: positive/negative/neutral, spam/not-spam, etc.`,
      extraction: `Generate text passages with key information to extract. Include the expected extracted data.`,
      rag: `Generate questions with supporting context documents and answers that must be derived from the context.`,
    };

    const prompt = `You are a test data generator for AI evaluation systems.

Topic: ${request.topic}
Style: ${request.style}
Number of test cases: ${request.count}
Approach: ${approach}

${styleInstructions[request.style]}

${request.customInstructions ? `Additional instructions: ${request.customInstructions}` : ''}

Follow the specified approach closely. Generate exactly ${request.count} test cases. Output as JSON array with this structure:
${request.style === 'rag' ? `[{"input": "question", "expectedOutput": "answer", "context": "supporting document"}]` : `[{"input": "input text", "expectedOutput": "expected output"}]`}

Important:
- Stay true to the approach described above
- Make test cases diverse and realistic within that approach
- Ensure expected outputs are accurate
- Keep inputs and outputs concise
- Only output valid JSON, no markdown formatting`;

    const response = await this.llmService.complete(prompt, {
      temperature: 0.8,
      maxTokens: 2048,
    });

    const testCases = this.parseResponse(response, request.style);
    return { approach, testCases };
  }

  /**
   * Step 3 — Evaluate & Synthesize: have the LLM judge branches and
   * merge the best test cases into the final output.
   */
  private async evaluateAndSynthesize(
    request: SyntheticGenerationRequest,
    branches: ThoughtBranch[],
  ): Promise<SyntheticTestCase[]> {
    // Build a summary of each branch for the evaluator
    const branchSummaries = branches
      .map((b, i) => {
        const samples = b.testCases
          .slice(0, 3)
          .map((tc) => `  - "${tc.input}" → "${tc.expectedOutput}"`)
          .join('\n');
        return `Branch ${i + 1} (${b.approach}):\n${samples}\n  ... (${b.testCases.length} total)`;
      })
      .join('\n\n');

    // Flatten all test cases with branch labels for selection
    const allCases = branches.flatMap((b, bi) =>
      b.testCases.map((tc, ti) => ({
        branchIndex: bi,
        caseIndex: ti,
        ...tc,
      })),
    );

    const prompt = `You are an expert evaluator of synthetic test data quality.

I generated ${NUM_BRANCHES} branches of test cases about "${request.topic}" (${request.style} style).

${branchSummaries}

All test cases (branch.case format):
${allCases.map((c, i) => `${c.branchIndex}.${c.caseIndex}: "${c.input}" → "${c.expectedOutput}"${c.context ? ` [context: "${c.context.substring(0, 80)}..."]` : ''}`).join('\n')}

Select the best ${request.count} test cases that together form the most diverse, realistic, and accurate dataset. Prefer:
1. Coverage across different sub-topics and difficulty levels
2. Realistic, non-repetitive inputs
3. Accurate expected outputs

Output a JSON array of the selected indices in "branch.case" format, e.g. ["0.2", "1.0", "2.3"].
Only output valid JSON, no markdown formatting.`;

    try {
      const response = await this.llmService.complete(prompt, {
        temperature: 0.3,
        maxTokens: 1024,
      });

      const selectedIndices = this.extractJson<string[]>(response);
      if (Array.isArray(selectedIndices) && selectedIndices.length > 0) {
        const selected: SyntheticTestCase[] = [];
        for (const idx of selectedIndices) {
          const [bi, ci] = idx.split('.').map(Number);
          const branch = branches[bi];
          if (branch && branch.testCases[ci]) {
            const tc = branch.testCases[ci];
            selected.push({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              ...(tc.context ? { context: tc.context } : {}),
            });
          }
        }
        if (selected.length >= request.count) {
          return selected.slice(0, request.count);
        }
        // If not enough were selected, pad from remaining
        if (selected.length > 0) {
          return this.padResults(selected, branches, request.count);
        }
      }
    } catch {
      // fall through to deterministic merge
    }

    // Fallback: round-robin merge from branches
    return this.roundRobinMerge(branches, request.count);
  }

  /**
   * Pad selected results with unused cases from branches to reach target count.
   */
  private padResults(
    selected: SyntheticTestCase[],
    branches: ThoughtBranch[],
    targetCount: number,
  ): SyntheticTestCase[] {
    const seen = new Set(selected.map((tc) => tc.input));
    const result = [...selected];
    for (const branch of branches) {
      for (const tc of branch.testCases) {
        if (result.length >= targetCount) return result;
        if (!seen.has(tc.input)) {
          seen.add(tc.input);
          result.push({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            ...(tc.context ? { context: tc.context } : {}),
          });
        }
      }
    }
    return result.slice(0, targetCount);
  }

  /**
   * Deterministic fallback: interleave test cases from branches.
   */
  private roundRobinMerge(
    branches: ThoughtBranch[],
    targetCount: number,
  ): SyntheticTestCase[] {
    const result: SyntheticTestCase[] = [];
    const seen = new Set<string>();
    let idx = 0;

    while (result.length < targetCount) {
      let added = false;
      for (const branch of branches) {
        if (idx < branch.testCases.length) {
          const tc = branch.testCases[idx];
          if (!seen.has(tc.input)) {
            seen.add(tc.input);
            result.push({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              ...(tc.context ? { context: tc.context } : {}),
            });
            added = true;
          }
          if (result.length >= targetCount) break;
        }
      }
      if (!added) break;
      idx++;
    }

    return result.slice(0, targetCount);
  }

  /**
   * Extract a JSON value from an LLM response, stripping markdown fences.
   */
  private extractJson<T>(response: string): T {
    let jsonStr = response;

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    return JSON.parse(jsonStr.trim());
  }

  private parseResponse(
    response: string,
    style: string,
  ): SyntheticTestCase[] {
    const parsed = this.extractJson<any[]>(response);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed.map((item: any, index: number) => {
      if (!item.input || !item.expectedOutput) {
        throw new Error(
          `Test case ${index} missing required fields`,
        );
      }

      const testCase: SyntheticTestCase = {
        input: String(item.input).trim(),
        expectedOutput: String(item.expectedOutput).trim(),
      };

      if (item.context && style === 'rag') {
        testCase.context = String(item.context).trim();
      }

      return testCase;
    });
  }
}

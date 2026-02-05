export * from './base.grader';
export * from './exact-match.grader';
export * from './llm-judge.grader';
export * from './semantic-similarity.grader';
export * from './faithfulness.grader';

import { BaseGrader, GraderConfig } from './base.grader';
import { ExactMatchGrader } from './exact-match.grader';
import { LlmJudgeGrader } from './llm-judge.grader';
import { SemanticSimilarityGrader } from './semantic-similarity.grader';
import { FaithfulnessGrader } from './faithfulness.grader';
import { LlmService } from '../llm/llm.service';

export type GraderType = 'exact-match' | 'llm-judge' | 'semantic-similarity' | 'faithfulness';

/**
 * Factory function to create grader instances based on type.
 */
export function createGrader(
  type: GraderType,
  config: GraderConfig,
  llmService: LlmService,
): BaseGrader {
  switch (type) {
    case 'exact-match':
      return new ExactMatchGrader(config);

    case 'llm-judge':
      return new LlmJudgeGrader(config, llmService);

    case 'semantic-similarity':
      return new SemanticSimilarityGrader(config, llmService);

    case 'faithfulness':
      return new FaithfulnessGrader(config, llmService);

    default:
      throw new Error(`Unknown grader type: ${type}`);
  }
}

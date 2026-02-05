export * from './base.grader';
export * from './exact-match.grader';
export * from './llm-judge.grader';
export * from './semantic-similarity.grader';
export * from './faithfulness.grader';
export * from './contains.grader';
export * from './regex.grader';
export * from './json-schema.grader';
export * from './answer-relevancy.grader';
export * from './context-relevancy.grader';

import { BaseGrader, GraderConfig } from './base.grader';
import { ExactMatchGrader } from './exact-match.grader';
import { LlmJudgeGrader } from './llm-judge.grader';
import { SemanticSimilarityGrader } from './semantic-similarity.grader';
import { FaithfulnessGrader } from './faithfulness.grader';
import { ContainsGrader } from './contains.grader';
import { RegexGrader } from './regex.grader';
import { JsonSchemaGrader } from './json-schema.grader';
import { AnswerRelevancyGrader } from './answer-relevancy.grader';
import { ContextRelevancyGrader } from './context-relevancy.grader';
import { LlmService } from '../llm/llm.service';

export type GraderType =
  | 'exact-match'
  | 'llm-judge'
  | 'semantic-similarity'
  | 'faithfulness'
  | 'contains'
  | 'regex'
  | 'json-schema'
  | 'answer-relevancy'
  | 'context-relevancy';

/**
 * Factory function to create grader instances based on type.
 */
export function createGrader(
  type: GraderType,
  config: GraderConfig,
  llmService: LlmService
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

    case 'contains':
      return new ContainsGrader(config);

    case 'regex':
      return new RegexGrader(config);

    case 'json-schema':
      return new JsonSchemaGrader(config);

    case 'answer-relevancy':
      return new AnswerRelevancyGrader(config, llmService);

    case 'context-relevancy':
      return new ContextRelevancyGrader(config, llmService);

    default:
      throw new Error(`Unknown grader type: ${type}`);
  }
}

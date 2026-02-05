/**
 * Shared types for the eval harness frontend.
 */

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  testCaseCount?: number;
  testCases?: TestCase[];
}

export interface TestCase {
  id: string;
  datasetId: string;
  input: string;
  expectedOutput?: string;
  context?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type GraderType = 'exact-match' | 'llm-judge' | 'semantic-similarity' | 'faithfulness';

export interface Grader {
  id: string;
  name: string;
  description?: string;
  type: GraderType;
  rubric?: string;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Experiment {
  id: string;
  name?: string;
  datasetId: string;
  graderIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  results?: ExperimentResult[];
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  testCaseId: string;
  graderId: string;
  pass: boolean;
  score?: number;
  reason?: string;
  output?: string;
  createdAt: string;
}

export interface ExperimentProgress {
  type: 'progress' | 'result' | 'complete' | 'error';
  experimentId: string;
  testCaseId?: string;
  graderId?: string;
  current?: number;
  total?: number;
  result?: {
    pass: boolean;
    score: number;
    reason: string;
  };
  error?: string;
}

export interface ExperimentStats {
  experimentId: string;
  totalTests: number;
  totalGraders: number;
  passRate: number;
  graderStats: Array<{
    graderId: string;
    passed: number;
    total: number;
    passRate: number;
    avgScore: number;
  }>;
}

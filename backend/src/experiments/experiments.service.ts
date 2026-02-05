import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { Subject, Observable } from 'rxjs';
import { DB_ADAPTER, IDbAdapter } from '../database/db.module';
import { DatasetsService } from '../datasets/datasets.service';
import { GradersService } from '../graders/graders.service';
import { LlmService } from '../llm/llm.service';
import { createGrader, GraderType, EvalInput } from '../eval-engine';

export interface CreateExperimentDto {
  name?: string;
  datasetId: string;
  graderIds: string[];
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

@Injectable()
export class ExperimentsService {
  private experimentStreams = new Map<string, Subject<ExperimentProgress>>();

  constructor(
    @Inject(DB_ADAPTER)
    private db: IDbAdapter,
    private datasetsService: DatasetsService,
    private gradersService: GradersService,
    private llmService: LlmService,
  ) {}

  /**
   * Get all experiments.
   */
  async findAll() {
    const experiments = await this.db.findAllExperiments();
    return experiments.map((e) => ({
      ...e,
      graderIds: JSON.parse(e.graderIds),
    }));
  }

  /**
   * Get an experiment by ID, including all results.
   */
  async findOne(id: string) {
    const experiment = await this.db.findExperimentById(id);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${id} not found`);
    }

    const results = await this.db.findResultsByExperimentId(id);

    return {
      ...experiment,
      graderIds: JSON.parse(experiment.graderIds),
      results,
    };
  }

  /**
   * Create and run a new experiment.
   */
  async create(dto: CreateExperimentDto) {
    const dataset = await this.datasetsService.findOne(dto.datasetId);
    const graders = await this.gradersService.findMany(dto.graderIds);

    const experiment = await this.db.insertExperiment({
      id: nanoid(),
      name: dto.name || `Experiment ${new Date().toISOString().slice(0, 16)}`,
      datasetId: dto.datasetId,
      graderIds: JSON.stringify(dto.graderIds),
      status: 'pending',
      createdAt: new Date(),
    });

    this.runExperiment(experiment.id, dataset, graders);

    return {
      ...experiment,
      graderIds: dto.graderIds,
    };
  }

  /**
   * Get SSE stream for experiment progress.
   */
  getProgressStream(experimentId: string): Observable<ExperimentProgress> {
    let subject = this.experimentStreams.get(experimentId);

    if (!subject) {
      subject = new Subject<ExperimentProgress>();
      this.experimentStreams.set(experimentId, subject);
    }

    return subject.asObservable();
  }

  /**
   * Run the experiment - evaluate all test cases with all graders.
   */
  private async runExperiment(
    experimentId: string,
    dataset: Awaited<ReturnType<typeof this.datasetsService.findOne>>,
    graders: Awaited<ReturnType<typeof this.gradersService.findMany>>,
  ) {
    const subject = this.experimentStreams.get(experimentId) || new Subject<ExperimentProgress>();
    this.experimentStreams.set(experimentId, subject);

    try {
      await this.db.updateExperiment(experimentId, { status: 'running' });

      const testCases = dataset.testCases;
      const totalEvals = testCases.length * graders.length;
      let current = 0;

      for (const testCase of testCases) {
        for (const graderDef of graders) {
          current++;

          subject.next({
            type: 'progress',
            experimentId,
            testCaseId: testCase.id,
            graderId: graderDef.id,
            current,
            total: totalEvals,
          });

          try {
            const grader = createGrader(
              graderDef.type as GraderType,
              {
                name: graderDef.name,
                description: graderDef.description || undefined,
                rubric: graderDef.rubric || undefined,
                config: graderDef.config || undefined,
              },
              this.llmService,
            );

            const evalInput: EvalInput = {
              input: testCase.input,
              output: testCase.expectedOutput || '',
              expected: testCase.expectedOutput || undefined,
              context: testCase.context || undefined,
            };

            const result = await grader.evaluate(evalInput);

            await this.db.insertResult({
              id: nanoid(),
              experimentId,
              testCaseId: testCase.id,
              graderId: graderDef.id,
              pass: result.pass,
              score: result.score,
              reason: result.reason,
              output: evalInput.output,
              createdAt: new Date(),
            });

            subject.next({
              type: 'result',
              experimentId,
              testCaseId: testCase.id,
              graderId: graderDef.id,
              current,
              total: totalEvals,
              result: {
                pass: result.pass,
                score: result.score,
                reason: result.reason,
              },
            });
          } catch (error) {
            await this.db.insertResult({
              id: nanoid(),
              experimentId,
              testCaseId: testCase.id,
              graderId: graderDef.id,
              pass: false,
              score: 0,
              reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              output: testCase.expectedOutput || '',
              createdAt: new Date(),
            });

            subject.next({
              type: 'error',
              experimentId,
              testCaseId: testCase.id,
              graderId: graderDef.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      await this.db.updateExperiment(experimentId, {
        status: 'completed',
        completedAt: new Date(),
      });

      subject.next({ type: 'complete', experimentId });
      subject.complete();
    } catch (error) {
      await this.db.updateExperiment(experimentId, { status: 'failed' });

      subject.next({
        type: 'error',
        experimentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      subject.complete();
    } finally {
      setTimeout(() => {
        this.experimentStreams.delete(experimentId);
      }, 60000);
    }
  }

  /**
   * Get aggregate statistics for an experiment.
   */
  async getStats(experimentId: string) {
    const experiment = await this.findOne(experimentId);
    const stats = await this.db.getExperimentStats(experimentId);

    return {
      experimentId,
      totalTests: stats.total,
      totalGraders: (experiment.graderIds as string[]).length,
      passRate: stats.total > 0 ? stats.passed / stats.total : 0,
      passed: stats.passed,
      failed: stats.failed,
      graderStats: Object.entries(stats.byGrader).map(([graderId, data]) => ({
        graderId,
        ...data,
        passRate: data.total > 0 ? data.passed / data.total : 0,
      })),
    };
  }
}

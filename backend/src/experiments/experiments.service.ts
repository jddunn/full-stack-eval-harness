import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import { Subject, Observable } from 'rxjs';
import { DATABASE_CONNECTION } from '../database/db.module';
import * as schema from '../database/schema';
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
  // Track active experiment streams for SSE
  private experimentStreams = new Map<string, Subject<ExperimentProgress>>();

  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: BetterSQLite3Database<typeof schema>,
    private datasetsService: DatasetsService,
    private gradersService: GradersService,
    private llmService: LlmService,
  ) {}

  /**
   * Get all experiments.
   */
  async findAll() {
    const experiments = await this.db.select().from(schema.experiments);
    return experiments.map((e) => ({
      ...e,
      graderIds: JSON.parse(e.graderIds),
    }));
  }

  /**
   * Get an experiment by ID, including all results.
   */
  async findOne(id: string) {
    const [experiment] = await this.db
      .select()
      .from(schema.experiments)
      .where(eq(schema.experiments.id, id));

    if (!experiment) {
      throw new NotFoundException(`Experiment ${id} not found`);
    }

    const results = await this.db
      .select()
      .from(schema.experimentResults)
      .where(eq(schema.experimentResults.experimentId, id));

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
    // Verify dataset and graders exist
    const dataset = await this.datasetsService.findOne(dto.datasetId);
    const graders = await this.gradersService.findMany(dto.graderIds);

    const experiment: schema.NewExperiment = {
      id: nanoid(),
      name: dto.name || `Experiment ${new Date().toISOString().slice(0, 16)}`,
      datasetId: dto.datasetId,
      graderIds: JSON.stringify(dto.graderIds),
      status: 'pending',
      createdAt: new Date(),
    };

    await this.db.insert(schema.experiments).values(experiment);

    // Start running the experiment asynchronously
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
      // Update status to running
      await this.db
        .update(schema.experiments)
        .set({ status: 'running' })
        .where(eq(schema.experiments.id, experimentId));

      const testCases = dataset.testCases;
      const totalEvals = testCases.length * graders.length;
      let current = 0;

      // Iterate through each test case and grader
      for (const testCase of testCases) {
        for (const graderDef of graders) {
          current++;

          // Emit progress update
          subject.next({
            type: 'progress',
            experimentId,
            testCaseId: testCase.id,
            graderId: graderDef.id,
            current,
            total: totalEvals,
          });

          try {
            // Create grader instance
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

            // Build eval input
            const evalInput: EvalInput = {
              input: testCase.input,
              output: testCase.expectedOutput || '', // For now, use expected as output (in real use, this would be model output)
              expected: testCase.expectedOutput || undefined,
              context: testCase.context || undefined,
            };

            // Run evaluation
            const result = await grader.evaluate(evalInput);

            // Store result
            const experimentResult: schema.NewExperimentResult = {
              id: nanoid(),
              experimentId,
              testCaseId: testCase.id,
              graderId: graderDef.id,
              pass: result.pass,
              score: result.score,
              reason: result.reason,
              output: evalInput.output,
              createdAt: new Date(),
            };

            await this.db.insert(schema.experimentResults).values(experimentResult);

            // Emit result
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
            // Store failed result
            const experimentResult: schema.NewExperimentResult = {
              id: nanoid(),
              experimentId,
              testCaseId: testCase.id,
              graderId: graderDef.id,
              pass: false,
              score: 0,
              reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              output: testCase.expectedOutput || '',
              createdAt: new Date(),
            };

            await this.db.insert(schema.experimentResults).values(experimentResult);

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

      // Mark experiment as completed
      await this.db
        .update(schema.experiments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(schema.experiments.id, experimentId));

      subject.next({ type: 'complete', experimentId });
      subject.complete();
    } catch (error) {
      // Mark experiment as failed
      await this.db
        .update(schema.experiments)
        .set({ status: 'failed' })
        .where(eq(schema.experiments.id, experimentId));

      subject.next({
        type: 'error',
        experimentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      subject.complete();
    } finally {
      // Clean up stream after a delay
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
    const results = experiment.results;

    if (results.length === 0) {
      return {
        experimentId,
        totalTests: 0,
        totalGraders: experiment.graderIds.length,
        passRate: 0,
        graderStats: [],
      };
    }

    // Calculate per-grader stats
    const graderIds = experiment.graderIds as string[];
    const graderStats = graderIds.map((graderId) => {
      const graderResults = results.filter((r) => r.graderId === graderId);
      const passed = graderResults.filter((r) => r.pass).length;
      const total = graderResults.length;
      const avgScore = graderResults.reduce((sum, r) => sum + (r.score || 0), 0) / total;

      return {
        graderId,
        passed,
        total,
        passRate: total > 0 ? passed / total : 0,
        avgScore,
      };
    });

    const totalPassed = results.filter((r) => r.pass).length;

    return {
      experimentId,
      totalTests: results.length,
      totalGraders: graderIds.length,
      passRate: totalPassed / results.length,
      graderStats,
    };
  }
}

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import { DATABASE_CONNECTION } from '../database/db.module';
import * as schema from '../database/schema';

export interface CreateDatasetDto {
  name: string;
  description?: string;
}

export interface CreateTestCaseDto {
  input: string;
  expectedOutput?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTestCaseDto {
  input?: string;
  expectedOutput?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DatasetsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: BetterSQLite3Database<typeof schema>,
  ) {}

  /**
   * Get all datasets with their test case counts.
   */
  async findAll() {
    const datasets = await this.db.select().from(schema.datasets);

    // Get test case counts for each dataset
    const datasetsWithCounts = await Promise.all(
      datasets.map(async (dataset) => {
        const cases = await this.db
          .select()
          .from(schema.testCases)
          .where(eq(schema.testCases.datasetId, dataset.id));
        return {
          ...dataset,
          testCaseCount: cases.length,
        };
      }),
    );

    return datasetsWithCounts;
  }

  /**
   * Get a dataset by ID, including all its test cases.
   */
  async findOne(id: string) {
    const [dataset] = await this.db
      .select()
      .from(schema.datasets)
      .where(eq(schema.datasets.id, id));

    if (!dataset) {
      throw new NotFoundException(`Dataset ${id} not found`);
    }

    const testCases = await this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.datasetId, id));

    return {
      ...dataset,
      testCases: testCases.map((tc) => ({
        ...tc,
        metadata: tc.metadata ? JSON.parse(tc.metadata) : null,
      })),
    };
  }

  /**
   * Create a new dataset.
   */
  async create(dto: CreateDatasetDto) {
    const now = new Date();
    const dataset: schema.NewDataset = {
      id: nanoid(),
      name: dto.name,
      description: dto.description,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(schema.datasets).values(dataset);
    return dataset;
  }

  /**
   * Update a dataset.
   */
  async update(id: string, dto: Partial<CreateDatasetDto>) {
    const [existing] = await this.db
      .select()
      .from(schema.datasets)
      .where(eq(schema.datasets.id, id));

    if (!existing) {
      throw new NotFoundException(`Dataset ${id} not found`);
    }

    await this.db
      .update(schema.datasets)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(schema.datasets.id, id));

    return this.findOne(id);
  }

  /**
   * Delete a dataset and all its test cases.
   */
  async remove(id: string) {
    const [existing] = await this.db
      .select()
      .from(schema.datasets)
      .where(eq(schema.datasets.id, id));

    if (!existing) {
      throw new NotFoundException(`Dataset ${id} not found`);
    }

    await this.db.delete(schema.datasets).where(eq(schema.datasets.id, id));
    return { deleted: true };
  }

  /**
   * Add a test case to a dataset.
   */
  async addTestCase(datasetId: string, dto: CreateTestCaseDto) {
    // Verify dataset exists
    const [dataset] = await this.db
      .select()
      .from(schema.datasets)
      .where(eq(schema.datasets.id, datasetId));

    if (!dataset) {
      throw new NotFoundException(`Dataset ${datasetId} not found`);
    }

    const testCase: schema.NewTestCase = {
      id: nanoid(),
      datasetId,
      input: dto.input,
      expectedOutput: dto.expectedOutput,
      context: dto.context,
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
      createdAt: new Date(),
    };

    await this.db.insert(schema.testCases).values(testCase);
    return {
      ...testCase,
      metadata: dto.metadata || null,
    };
  }

  /**
   * Update a test case.
   */
  async updateTestCase(datasetId: string, caseId: string, dto: UpdateTestCaseDto) {
    const [existing] = await this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.id, caseId));

    if (!existing || existing.datasetId !== datasetId) {
      throw new NotFoundException(`Test case ${caseId} not found in dataset ${datasetId}`);
    }

    const updates: Partial<schema.TestCase> = {};
    if (dto.input !== undefined) updates.input = dto.input;
    if (dto.expectedOutput !== undefined) updates.expectedOutput = dto.expectedOutput;
    if (dto.context !== undefined) updates.context = dto.context;
    if (dto.metadata !== undefined) updates.metadata = JSON.stringify(dto.metadata);

    await this.db.update(schema.testCases).set(updates).where(eq(schema.testCases.id, caseId));

    const [updated] = await this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.id, caseId));

    return {
      ...updated,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
    };
  }

  /**
   * Delete a test case.
   */
  async removeTestCase(datasetId: string, caseId: string) {
    const [existing] = await this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.id, caseId));

    if (!existing || existing.datasetId !== datasetId) {
      throw new NotFoundException(`Test case ${caseId} not found in dataset ${datasetId}`);
    }

    await this.db.delete(schema.testCases).where(eq(schema.testCases.id, caseId));
    return { deleted: true };
  }
}

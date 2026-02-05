import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { DB_ADAPTER, IDbAdapter } from '../database/db.module';

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
    @Inject(DB_ADAPTER)
    private db: IDbAdapter,
  ) {}

  /**
   * Get all datasets with their test case counts.
   */
  async findAll() {
    const datasets = await this.db.findAllDatasets();

    const datasetsWithCounts = await Promise.all(
      datasets.map(async (dataset) => {
        const count = await this.db.countTestCasesByDatasetId(dataset.id);
        return {
          ...dataset,
          testCaseCount: count,
        };
      }),
    );

    return datasetsWithCounts;
  }

  /**
   * Get a dataset by ID, including all its test cases.
   */
  async findOne(id: string) {
    const dataset = await this.db.findDatasetById(id);

    if (!dataset) {
      throw new NotFoundException(`Dataset ${id} not found`);
    }

    const testCases = await this.db.findTestCasesByDatasetId(id);

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
    const dataset = await this.db.insertDataset({
      id: nanoid(),
      name: dto.name,
      description: dto.description,
      createdAt: now,
      updatedAt: now,
    });

    return dataset;
  }

  /**
   * Update a dataset.
   */
  async update(id: string, dto: Partial<CreateDatasetDto>) {
    const existing = await this.db.findDatasetById(id);

    if (!existing) {
      throw new NotFoundException(`Dataset ${id} not found`);
    }

    await this.db.updateDataset(id, {
      ...dto,
      updatedAt: new Date(),
    });

    return this.findOne(id);
  }

  /**
   * Delete a dataset and all its test cases.
   */
  async remove(id: string) {
    const existing = await this.db.findDatasetById(id);

    if (!existing) {
      throw new NotFoundException(`Dataset ${id} not found`);
    }

    await this.db.deleteDataset(id);
    return { deleted: true };
  }

  /**
   * Add a test case to a dataset.
   */
  async addTestCase(datasetId: string, dto: CreateTestCaseDto) {
    const dataset = await this.db.findDatasetById(datasetId);

    if (!dataset) {
      throw new NotFoundException(`Dataset ${datasetId} not found`);
    }

    const testCase = await this.db.insertTestCase({
      id: nanoid(),
      datasetId,
      input: dto.input,
      expectedOutput: dto.expectedOutput,
      context: dto.context,
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
      createdAt: new Date(),
    });

    return {
      ...testCase,
      metadata: dto.metadata || null,
    };
  }

  /**
   * Update a test case.
   */
  async updateTestCase(datasetId: string, caseId: string, dto: UpdateTestCaseDto) {
    const existing = await this.db.findTestCaseById(caseId);

    if (!existing || existing.datasetId !== datasetId) {
      throw new NotFoundException(`Test case ${caseId} not found in dataset ${datasetId}`);
    }

    const updates: Record<string, unknown> = {};
    if (dto.input !== undefined) updates.input = dto.input;
    if (dto.expectedOutput !== undefined) updates.expectedOutput = dto.expectedOutput;
    if (dto.context !== undefined) updates.context = dto.context;
    if (dto.metadata !== undefined) updates.metadata = JSON.stringify(dto.metadata);

    const updated = await this.db.updateTestCase(caseId, updates);

    return {
      ...updated,
      metadata: updated?.metadata ? JSON.parse(updated.metadata) : null,
    };
  }

  /**
   * Delete a test case.
   */
  async removeTestCase(datasetId: string, caseId: string) {
    const existing = await this.db.findTestCaseById(caseId);

    if (!existing || existing.datasetId !== datasetId) {
      throw new NotFoundException(`Test case ${caseId} not found in dataset ${datasetId}`);
    }

    await this.db.deleteTestCase(caseId);
    return { deleted: true };
  }
}

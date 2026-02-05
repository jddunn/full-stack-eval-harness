import { Injectable } from '@nestjs/common';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, inArray, sql } from 'drizzle-orm';
import * as BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { nanoid } from 'nanoid';

import {
  IDbAdapter,
  Dataset,
  TestCase,
  Grader,
  Experiment,
  ExperimentResult,
  Settings,
  InsertDataset,
  InsertTestCase,
  InsertGrader,
  InsertExperiment,
  InsertExperimentResult,
} from '../interfaces/db-adapter.interface';
import * as schema from '../schema';

// Handle CommonJS/ESM interop
const Database = (BetterSqlite3 as any).default || BetterSqlite3;

@Injectable()
export class SqliteAdapter implements IDbAdapter {
  private db: BetterSQLite3Database<typeof schema>;
  private sqlite: any;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.DATABASE_PATH || './data/evals.sqlite';
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.sqlite = new Database(this.filePath);
    this.db = drizzle(this.sqlite, { schema });

    // Create tables
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        input TEXT NOT NULL,
        expected_output TEXT,
        context TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS graders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        rubric TEXT,
        config TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        name TEXT,
        dataset_id TEXT NOT NULL REFERENCES datasets(id),
        grader_ids TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS experiment_results (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        test_case_id TEXT NOT NULL REFERENCES test_cases(id),
        grader_id TEXT NOT NULL REFERENCES graders(id),
        pass INTEGER NOT NULL,
        score REAL,
        reason TEXT,
        output TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_test_cases_dataset ON test_cases(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_results_experiment ON experiment_results(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    `);

    console.log('SQLite database initialized at:', this.filePath);
  }

  async close(): Promise<void> {
    if (this.sqlite) {
      this.sqlite.close();
    }
  }

  // ============================================================
  // Datasets
  // ============================================================

  async findAllDatasets(): Promise<Dataset[]> {
    return this.db.select().from(schema.datasets);
  }

  async findDatasetById(id: string): Promise<Dataset | null> {
    const [result] = await this.db
      .select()
      .from(schema.datasets)
      .where(eq(schema.datasets.id, id));
    return result || null;
  }

  async insertDataset(dataset: InsertDataset): Promise<Dataset> {
    await this.db.insert(schema.datasets).values(dataset);
    return dataset as Dataset;
  }

  async updateDataset(
    id: string,
    updates: Partial<Omit<Dataset, 'id' | 'createdAt'>>,
  ): Promise<Dataset | null> {
    await this.db
      .update(schema.datasets)
      .set(updates)
      .where(eq(schema.datasets.id, id));
    return this.findDatasetById(id);
  }

  async deleteDataset(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.datasets)
      .where(eq(schema.datasets.id, id));
    return true;
  }

  // ============================================================
  // Test Cases
  // ============================================================

  async findTestCasesByDatasetId(datasetId: string): Promise<TestCase[]> {
    return this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.datasetId, datasetId));
  }

  async findTestCaseById(id: string): Promise<TestCase | null> {
    const [result] = await this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.id, id));
    return result || null;
  }

  async insertTestCase(testCase: InsertTestCase): Promise<TestCase> {
    await this.db.insert(schema.testCases).values(testCase);
    return testCase as TestCase;
  }

  async updateTestCase(
    id: string,
    updates: Partial<Omit<TestCase, 'id' | 'datasetId' | 'createdAt'>>,
  ): Promise<TestCase | null> {
    await this.db
      .update(schema.testCases)
      .set(updates)
      .where(eq(schema.testCases.id, id));
    return this.findTestCaseById(id);
  }

  async deleteTestCase(id: string): Promise<boolean> {
    await this.db.delete(schema.testCases).where(eq(schema.testCases.id, id));
    return true;
  }

  async countTestCasesByDatasetId(datasetId: string): Promise<number> {
    const cases = await this.findTestCasesByDatasetId(datasetId);
    return cases.length;
  }

  // ============================================================
  // Graders
  // ============================================================

  async findAllGraders(): Promise<Grader[]> {
    return this.db.select().from(schema.graders);
  }

  async findGraderById(id: string): Promise<Grader | null> {
    const [result] = await this.db
      .select()
      .from(schema.graders)
      .where(eq(schema.graders.id, id));
    return result || null;
  }

  async findGradersByIds(ids: string[]): Promise<Grader[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(schema.graders)
      .where(inArray(schema.graders.id, ids));
  }

  async insertGrader(grader: InsertGrader): Promise<Grader> {
    await this.db.insert(schema.graders).values(grader);
    return grader as Grader;
  }

  async updateGrader(
    id: string,
    updates: Partial<Omit<Grader, 'id' | 'createdAt'>>,
  ): Promise<Grader | null> {
    await this.db
      .update(schema.graders)
      .set(updates)
      .where(eq(schema.graders.id, id));
    return this.findGraderById(id);
  }

  async deleteGrader(id: string): Promise<boolean> {
    await this.db.delete(schema.graders).where(eq(schema.graders.id, id));
    return true;
  }

  // ============================================================
  // Experiments
  // ============================================================

  async findAllExperiments(): Promise<Experiment[]> {
    return this.db.select().from(schema.experiments);
  }

  async findExperimentById(id: string): Promise<Experiment | null> {
    const [result] = await this.db
      .select()
      .from(schema.experiments)
      .where(eq(schema.experiments.id, id));
    return result || null;
  }

  async insertExperiment(experiment: InsertExperiment): Promise<Experiment> {
    await this.db.insert(schema.experiments).values(experiment);
    return experiment as Experiment;
  }

  async updateExperiment(
    id: string,
    updates: Partial<Omit<Experiment, 'id' | 'createdAt'>>,
  ): Promise<Experiment | null> {
    await this.db
      .update(schema.experiments)
      .set(updates)
      .where(eq(schema.experiments.id, id));
    return this.findExperimentById(id);
  }

  async deleteExperiment(id: string): Promise<boolean> {
    await this.db.delete(schema.experiments).where(eq(schema.experiments.id, id));
    return true;
  }

  // ============================================================
  // Experiment Results
  // ============================================================

  async findResultsByExperimentId(experimentId: string): Promise<ExperimentResult[]> {
    return this.db
      .select()
      .from(schema.experimentResults)
      .where(eq(schema.experimentResults.experimentId, experimentId));
  }

  async insertResult(result: InsertExperimentResult): Promise<ExperimentResult> {
    await this.db.insert(schema.experimentResults).values(result);
    return result as ExperimentResult;
  }

  async deleteResultsByExperimentId(experimentId: string): Promise<boolean> {
    await this.db
      .delete(schema.experimentResults)
      .where(eq(schema.experimentResults.experimentId, experimentId));
    return true;
  }

  // ============================================================
  // Aggregate Queries
  // ============================================================

  async getExperimentStats(experimentId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    byGrader: Record<string, { total: number; passed: number; avgScore: number }>;
  }> {
    const results = await this.findResultsByExperimentId(experimentId);

    const byGrader: Record<string, { total: number; passed: number; scores: number[] }> = {};

    for (const result of results) {
      if (!byGrader[result.graderId]) {
        byGrader[result.graderId] = { total: 0, passed: 0, scores: [] };
      }
      byGrader[result.graderId].total++;
      if (result.pass) byGrader[result.graderId].passed++;
      if (result.score !== null) byGrader[result.graderId].scores.push(result.score);
    }

    const finalByGrader: Record<string, { total: number; passed: number; avgScore: number }> = {};
    for (const [graderId, data] of Object.entries(byGrader)) {
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0;
      finalByGrader[graderId] = {
        total: data.total,
        passed: data.passed,
        avgScore,
      };
    }

    return {
      total: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      byGrader: finalByGrader,
    };
  }

  // ============================================================
  // Settings
  // ============================================================

  async findAllSettings(): Promise<Settings[]> {
    return this.db.select().from(schema.settings);
  }

  async findSettingByKey(key: string): Promise<Settings | null> {
    const [result] = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key));
    return result || null;
  }

  async upsertSetting(key: string, value: string): Promise<Settings> {
    const existing = await this.findSettingByKey(key);
    const now = new Date();

    if (existing) {
      await this.db
        .update(schema.settings)
        .set({ value, updatedAt: now })
        .where(eq(schema.settings.key, key));
      return { ...existing, value, updatedAt: now };
    } else {
      const setting: Settings = {
        id: nanoid(),
        key,
        value,
        updatedAt: now,
      };
      await this.db.insert(schema.settings).values(setting);
      return setting;
    }
  }

  async deleteSetting(key: string): Promise<boolean> {
    await this.db.delete(schema.settings).where(eq(schema.settings.key, key));
    return true;
  }
}

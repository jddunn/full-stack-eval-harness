import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Datasets hold collections of test cases.
 * Each dataset can have many test cases.
 */
export const datasets = sqliteTable('datasets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Test cases belong to a dataset.
 * Each case has an input and optional expected output.
 * Metadata stores any custom fields as JSON.
 */
export const testCases = sqliteTable('test_cases', {
  id: text('id').primaryKey(),
  datasetId: text('dataset_id')
    .notNull()
    .references(() => datasets.id, { onDelete: 'cascade' }),
  input: text('input').notNull(),
  expectedOutput: text('expected_output'),
  context: text('context'), // For faithfulness grader
  metadata: text('metadata'), // JSON blob for custom fields
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Graders define evaluation criteria.
 * Type determines the grading strategy.
 * Config and rubric are type-specific settings.
 */
export const graders = sqliteTable('graders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'exact-match' | 'llm-judge' | 'semantic-similarity' | 'faithfulness'
  rubric: text('rubric'), // For LLM-based graders
  config: text('config'), // JSON blob for type-specific settings
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Experiments run graders against datasets.
 * Status tracks progress: pending -> running -> completed | failed.
 */
export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  name: text('name'),
  datasetId: text('dataset_id')
    .notNull()
    .references(() => datasets.id),
  graderIds: text('grader_ids').notNull(), // JSON array of grader IDs
  status: text('status').notNull(), // 'pending' | 'running' | 'completed' | 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

/**
 * Results store individual grader evaluations.
 * One result per (experiment, test case, grader) combination.
 */
export const experimentResults = sqliteTable('experiment_results', {
  id: text('id').primaryKey(),
  experimentId: text('experiment_id')
    .notNull()
    .references(() => experiments.id, { onDelete: 'cascade' }),
  testCaseId: text('test_case_id')
    .notNull()
    .references(() => testCases.id),
  graderId: text('grader_id')
    .notNull()
    .references(() => graders.id),
  pass: integer('pass', { mode: 'boolean' }).notNull(),
  score: real('score'), // 0.0 - 1.0
  reason: text('reason'),
  output: text('output'), // The actual output that was evaluated
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Settings store runtime configuration.
 * Used for LLM provider settings, API keys, etc.
 */
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Type exports for use in services
export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;
export type TestCase = typeof testCases.$inferSelect;
export type NewTestCase = typeof testCases.$inferInsert;
export type Grader = typeof graders.$inferSelect;
export type NewGrader = typeof graders.$inferInsert;
export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type ExperimentResult = typeof experimentResults.$inferSelect;
export type NewExperimentResult = typeof experimentResults.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

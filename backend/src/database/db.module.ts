import { Module, Global, OnModuleInit } from '@nestjs/common';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as BetterSqlite3 from 'better-sqlite3';
import * as schema from './schema';

// Handle CommonJS/ESM interop
const Database = (BetterSqlite3 as any).default || BetterSqlite3;
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

const DB_PATH = process.env.DATABASE_PATH || './data/evals.sqlite';

/**
 * Creates the database connection and runs migrations.
 * Using better-sqlite3 for synchronous, fast local SQLite.
 */
function createDatabase(): BetterSQLite3Database<typeof schema> {
  // Ensure data directory exists
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite, { schema });

  // Create tables if they don't exist
  sqlite.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_test_cases_dataset ON test_cases(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_results_experiment ON experiment_results(experiment_id);
  `);

  return db;
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: () => createDatabase(),
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule implements OnModuleInit {
  onModuleInit() {
    console.log('Database initialized at:', DB_PATH);
  }
}

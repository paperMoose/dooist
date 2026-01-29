import { Kysely, SqliteDialect, Migrator, type Migration, type MigrationProvider } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import type { Database } from '../types/database.js';
import * as migration001 from './migrations/001_initial.js';
import * as migration002 from './migrations/002_add_context.js';
import * as migration003 from './migrations/003_add_task_updates.js';

const migrations: Record<string, Migration> = {
  '001_initial': migration001,
  '002_add_context': migration002,
  '003_add_task_updates': migration003,
};

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

let db: Kysely<Database> | null = null;

function ensureDataDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createDatabase(): Kysely<Database> {
  if (db) {
    return db;
  }

  if (config.database.type === 'sqlite') {
    ensureDataDir(config.database.sqlitePath);
    const sqliteDb = new BetterSqlite3(config.database.sqlitePath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    db = new Kysely<Database>({
      dialect: new SqliteDialect({
        database: sqliteDb,
      }),
    });
  } else {
    throw new Error('PostgreSQL support not yet implemented');
  }

  return db;
}

export async function migrateToLatest(): Promise<void> {
  const database = createDatabase();
  const migrator = new Migrator({
    db: database,
    provider: new StaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.error(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to migrate');
    console.error(error);
    throw error;
  }
}

export async function seedInbox(): Promise<void> {
  const database = createDatabase();

  const inbox = await database
    .selectFrom('projects')
    .where('is_inbox', '=', 1)
    .selectAll()
    .executeTakeFirst();

  if (!inbox) {
    await database
      .insertInto('projects')
      .values({
        id: crypto.randomUUID(),
        name: 'Inbox',
        is_inbox: 1,
        is_archived: 0,
        order: 0,
        view_style: 'list',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();
    console.error('Created Inbox project');
  }
}

export async function initializeDatabase(): Promise<Kysely<Database>> {
  await migrateToLatest();
  await seedInbox();
  return createDatabase();
}

export function getDatabase(): Kysely<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call createDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}

export { db };

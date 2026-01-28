import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tasks ADD COLUMN context TEXT`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // SQLite doesn't support DROP COLUMN before 3.35.0
  // For safety, recreate the table without the column
  await sql`CREATE TABLE tasks_backup AS SELECT id, project_id, section_id, parent_id, content, description, priority, is_completed, completed_at, due_date, due_datetime, due_string, due_is_recurring, due_timezone, "order", created_at, updated_at FROM tasks`.execute(db);
  await sql`DROP TABLE tasks`.execute(db);
  await sql`ALTER TABLE tasks_backup RENAME TO tasks`.execute(db);
}

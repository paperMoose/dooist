import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Projects table
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('color', 'text')
    .addColumn('order', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('is_inbox', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('is_archived', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('view_style', 'text', (col) => col.notNull().defaultTo('list'))
    .addColumn('parent_id', 'text', (col) => col.references('projects.id').onDelete('set null'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .execute();

  // Tasks table
  await db.schema
    .createTable('tasks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) => col.notNull().references('projects.id').onDelete('cascade'))
    .addColumn('section_id', 'text', (col) => col.references('sections.id').onDelete('set null'))
    .addColumn('parent_id', 'text', (col) => col.references('tasks.id').onDelete('cascade'))
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('is_completed', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('completed_at', 'text')
    .addColumn('due_date', 'text')
    .addColumn('due_datetime', 'text')
    .addColumn('due_string', 'text')
    .addColumn('due_is_recurring', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('due_timezone', 'text')
    .addColumn('order', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .execute();

  // Labels table
  await db.schema
    .createTable('labels')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('color', 'text')
    .addColumn('order', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('is_favorite', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .execute();

  // Task_Labels join table
  await db.schema
    .createTable('task_labels')
    .addColumn('task_id', 'text', (col) => col.notNull().references('tasks.id').onDelete('cascade'))
    .addColumn('label_id', 'text', (col) => col.notNull().references('labels.id').onDelete('cascade'))
    .addPrimaryKeyConstraint('task_labels_pk', ['task_id', 'label_id'])
    .execute();

  // Sections table
  await db.schema
    .createTable('sections')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) => col.notNull().references('projects.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('order', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(new Date().toISOString()))
    .execute();

  // Create indexes
  await db.schema.createIndex('idx_tasks_project_id').on('tasks').column('project_id').execute();
  await db.schema.createIndex('idx_tasks_due_date').on('tasks').column('due_date').execute();
  await db.schema.createIndex('idx_tasks_is_completed').on('tasks').column('is_completed').execute();
  await db.schema.createIndex('idx_sections_project_id').on('sections').column('project_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('task_labels').execute();
  await db.schema.dropTable('tasks').execute();
  await db.schema.dropTable('sections').execute();
  await db.schema.dropTable('labels').execute();
  await db.schema.dropTable('projects').execute();
}

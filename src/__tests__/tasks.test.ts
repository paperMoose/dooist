import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import type { Database } from '../types/database.js';
import { TaskService } from '../services/tasks.js';
import { ProjectService } from '../services/projects.js';
import { LabelService } from '../services/labels.js';
import * as migration from '../db/migrations/001_initial.js';
import * as migration002 from '../db/migrations/002_add_context.js';
import * as migration003 from '../db/migrations/003_add_task_updates.js';

let db: Kysely<Database>;
let taskService: TaskService;
let projectService: ProjectService;
let labelService: LabelService;
let inboxId: string;

beforeAll(async () => {
  const sqliteDb = new BetterSqlite3(':memory:');
  sqliteDb.pragma('foreign_keys = ON');

  db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  });

  await migration.up(db);
  await migration002.up(db);
  await migration003.up(db);

  // Create inbox project
  inboxId = crypto.randomUUID();
  await db.insertInto('projects').values({
    id: inboxId,
    name: 'Inbox',
    is_inbox: 1,
    is_archived: 0,
    order: 0,
    view_style: 'list',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).execute();

  taskService = new TaskService(db);
  projectService = new ProjectService(db);
  labelService = new LabelService(db);
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  // Clean up tasks, labels, and updates before each test
  await db.deleteFrom('task_updates').execute();
  await db.deleteFrom('task_labels').execute();
  await db.deleteFrom('tasks').execute();
  await db.deleteFrom('labels').execute();
});

describe('TaskService', () => {
  describe('create', () => {
    it('should create a task in the inbox by default', async () => {
      const task = await taskService.create({
        content: 'Test task',
      });

      expect(task.content).toBe('Test task');
      expect(task.project_id).toBe(inboxId);
      expect(task.is_completed).toBe(0);
      expect(task.priority).toBe(1);
    });

    it('should create a task with priority', async () => {
      const task = await taskService.create({
        content: 'High priority task',
        priority: 4,
      });

      expect(task.priority).toBe(4);
    });

    it('should create a task with due date', async () => {
      const task = await taskService.create({
        content: 'Task with due',
        due: 'tomorrow',
      });

      expect(task.due_date).toBeTruthy();
      expect(task.due_string).toBe('tomorrow');
    });

    it('should create a task with labels', async () => {
      const task = await taskService.create({
        content: 'Labeled task',
        labels: ['urgent', 'work'],
      });

      expect(task.labels).toHaveLength(2);
      expect(task.labels.map(l => l.name)).toContain('urgent');
      expect(task.labels.map(l => l.name)).toContain('work');
    });
  });

  describe('list', () => {
    it('should list incomplete tasks by default', async () => {
      await taskService.create({ content: 'Task 1' });
      await taskService.create({ content: 'Task 2' });

      const tasks = await taskService.list();

      expect(tasks).toHaveLength(2);
    });

    it('should filter by project', async () => {
      const project = await projectService.create({ name: 'Test Project' });

      await taskService.create({ content: 'Inbox task' });
      await taskService.create({ content: 'Project task', projectId: project.id });

      const inboxTasks = await taskService.list({ projectId: inboxId });
      const projectTasks = await taskService.list({ projectId: project.id });

      expect(inboxTasks).toHaveLength(1);
      expect(inboxTasks[0].content).toBe('Inbox task');
      expect(projectTasks).toHaveLength(1);
      expect(projectTasks[0].content).toBe('Project task');
    });
  });

  describe('complete/reopen', () => {
    it('should complete a task', async () => {
      const task = await taskService.create({ content: 'Task to complete' });
      expect(task.is_completed).toBe(0);

      const completed = await taskService.complete(task.id);
      expect(completed.is_completed).toBe(1);
      expect(completed.completed_at).toBeTruthy();
    });

    it('should reopen a completed task', async () => {
      const task = await taskService.create({ content: 'Task to reopen' });
      await taskService.complete(task.id);

      const reopened = await taskService.reopen(task.id);
      expect(reopened.is_completed).toBe(0);
      expect(reopened.completed_at).toBeNull();
    });
  });

  describe('update', () => {
    it('should update task content', async () => {
      const task = await taskService.create({ content: 'Original' });

      const updated = await taskService.update(task.id, {
        content: 'Updated',
      });

      expect(updated.content).toBe('Updated');
    });

    it('should update task priority', async () => {
      const task = await taskService.create({ content: 'Task', priority: 1 });

      const updated = await taskService.update(task.id, {
        priority: 4,
      });

      expect(updated.priority).toBe(4);
    });

    it('should update task labels', async () => {
      const task = await taskService.create({
        content: 'Task',
        labels: ['old'],
      });

      expect(task.labels.map(l => l.name)).toContain('old');

      const updated = await taskService.update(task.id, {
        labels: ['new1', 'new2'],
      });

      expect(updated.labels).toHaveLength(2);
      expect(updated.labels.map(l => l.name)).not.toContain('old');
      expect(updated.labels.map(l => l.name)).toContain('new1');
      expect(updated.labels.map(l => l.name)).toContain('new2');
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      const task = await taskService.create({ content: 'To delete' });

      await taskService.delete(task.id);

      const found = await taskService.getById(task.id);
      expect(found).toBeUndefined();
    });

    it('should throw when deleting non-existent task', async () => {
      await expect(taskService.delete('non-existent-id')).rejects.toThrow('Task not found');
    });
  });

  describe('error handling', () => {
    it('should throw when updating non-existent task', async () => {
      await expect(taskService.update('non-existent-id', { content: 'test' }))
        .rejects.toThrow('Task not found');
    });

    it('should throw when completing non-existent task', async () => {
      await expect(taskService.complete('non-existent-id'))
        .rejects.toThrow('Task not found');
    });

    it('should throw when reopening non-existent task', async () => {
      await expect(taskService.reopen('non-existent-id'))
        .rejects.toThrow('Task not found');
    });
  });

  describe('today', () => {
    it('should return tasks due today', async () => {
      await taskService.create({ content: 'Today task', due: 'today' });
      await taskService.create({ content: 'Tomorrow task', due: 'tomorrow' });

      const todayTasks = await taskService.today();

      expect(todayTasks.some(t => t.content === 'Today task')).toBe(true);
      expect(todayTasks.some(t => t.content === 'Tomorrow task')).toBe(false);
    });
  });

  describe('upcoming', () => {
    it('should return tasks due within days', async () => {
      await taskService.create({ content: 'Soon task', due: 'tomorrow' });
      await taskService.create({ content: 'Later task', due: 'in 30 days' });

      const upcoming = await taskService.upcoming(7);

      expect(upcoming.some(t => t.content === 'Soon task')).toBe(true);
      expect(upcoming.some(t => t.content === 'Later task')).toBe(false);
    });
  });

  describe('task updates', () => {
    it('should add an update to a task', async () => {
      const task = await taskService.create({ content: 'Task with updates' });

      const update = await taskService.addUpdate(task.id, 'Started investigation');

      expect(update.task_id).toBe(task.id);
      expect(update.content).toBe('Started investigation');
      expect(update.created_at).toBeTruthy();
    });

    it('should get updates in chronological order', async () => {
      const task = await taskService.create({ content: 'Task with updates' });

      await taskService.addUpdate(task.id, 'First update');
      await taskService.addUpdate(task.id, 'Second update');
      await taskService.addUpdate(task.id, 'Third update');

      const updates = await taskService.getUpdates(task.id);

      expect(updates).toHaveLength(3);
      expect(updates[0].content).toBe('First update');
      expect(updates[1].content).toBe('Second update');
      expect(updates[2].content).toBe('Third update');
    });

    it('should throw when adding update to non-existent task', async () => {
      await expect(taskService.addUpdate('non-existent-id', 'Update'))
        .rejects.toThrow('Task not found');
    });

    it('should throw when getting updates for non-existent task', async () => {
      await expect(taskService.getUpdates('non-existent-id'))
        .rejects.toThrow('Task not found');
    });

    it('should delete updates when task is deleted (cascade)', async () => {
      const task = await taskService.create({ content: 'Task to delete' });
      await taskService.addUpdate(task.id, 'Update 1');
      await taskService.addUpdate(task.id, 'Update 2');

      await taskService.delete(task.id);

      // Verify updates are gone by checking database directly
      const updates = await db
        .selectFrom('task_updates')
        .where('task_id', '=', task.id)
        .selectAll()
        .execute();

      expect(updates).toHaveLength(0);
    });
  });
});

describe('ProjectService', () => {
  it('should get inbox project', async () => {
    const inbox = await projectService.getInbox();

    expect(inbox.name).toBe('Inbox');
    expect(inbox.is_inbox).toBe(1);
  });

  it('should create a project', async () => {
    const project = await projectService.create({
      name: 'New Project',
      color: 'blue',
    });

    expect(project.name).toBe('New Project');
    expect(project.color).toBe('blue');
    expect(project.is_inbox).toBe(0);
  });

  it('should not delete inbox', async () => {
    const inbox = await projectService.getInbox();

    await expect(projectService.delete(inbox.id)).rejects.toThrow('Cannot delete the Inbox');
  });
});

describe('LabelService', () => {
  it('should create a label', async () => {
    const label = await labelService.create({ name: 'test-label' });

    expect(label.name).toBe('test-label');
  });

  it('should not create duplicate labels', async () => {
    await labelService.create({ name: 'unique-label' });

    await expect(labelService.create({ name: 'unique-label' })).rejects.toThrow('already exists');
  });

  it('should get or create label', async () => {
    const label1 = await labelService.getOrCreate('maybe-new');
    const label2 = await labelService.getOrCreate('maybe-new');

    expect(label1.id).toBe(label2.id);
  });
});

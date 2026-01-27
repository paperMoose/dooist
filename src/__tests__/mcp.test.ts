import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import type { Database } from '../types/database.js';
import { ToolHandlers, getToolDefinitions } from '../mcp/tools.js';
import * as migration from '../db/migrations/001_initial.js';

let db: Kysely<Database>;
let handlers: ToolHandlers;
let inboxId: string;

beforeAll(async () => {
  const sqliteDb = new BetterSqlite3(':memory:');
  sqliteDb.pragma('foreign_keys = ON');

  db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  });

  await migration.up(db);

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

  handlers = new ToolHandlers(db);
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await db.deleteFrom('task_labels').execute();
  await db.deleteFrom('tasks').execute();
  await db.deleteFrom('labels').execute();
  // Keep projects - just clean tasks/labels
});

describe('MCP Tool Definitions', () => {
  it('should return all expected tools', () => {
    const tools = getToolDefinitions();
    const toolNames = tools.map(t => t.name);

    expect(toolNames).toContain('create_task');
    expect(toolNames).toContain('list_tasks');
    expect(toolNames).toContain('complete_task');
    expect(toolNames).toContain('reopen_task');
    expect(toolNames).toContain('update_task');
    expect(toolNames).toContain('delete_task');
    expect(toolNames).toContain('today');
    expect(toolNames).toContain('upcoming');
    expect(toolNames).toContain('list_projects');
    expect(toolNames).toContain('create_project');
    expect(toolNames).toContain('list_labels');
    expect(toolNames).toContain('create_label');
  });

  it('should have valid JSON Schema for each tool', () => {
    const tools = getToolDefinitions();

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('should require content for create_task', () => {
    const tools = getToolDefinitions();
    const createTask = tools.find(t => t.name === 'create_task');

    expect(createTask?.inputSchema.required).toContain('content');
  });

  it('should require id for complete_task', () => {
    const tools = getToolDefinitions();
    const completeTask = tools.find(t => t.name === 'complete_task');

    expect(completeTask?.inputSchema.required).toContain('id');
  });
});

describe('MCP Tool Handlers', () => {
  describe('create_task', () => {
    it('should create a task and return formatted output', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Test MCP task',
      });

      expect(result).toContain('Test MCP task');
      expect(result).toMatch(/^\[[\w-]{8}\]/); // Starts with [8-char-id]
    });

    it('should create task with priority and show P-level', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Urgent task',
        priority: 4,
      });

      expect(result).toContain('Urgent task');
      expect(result).toContain('Priority: P1'); // Priority 4 = P1 display
    });

    it('should create task with due date', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Task with due',
        due: 'tomorrow',
      });

      expect(result).toContain('Task with due');
      expect(result).toContain('Due: tomorrow');
    });

    it('should create task with labels', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Labeled task',
        labels: ['urgent', 'work'],
      });

      expect(result).toContain('Labeled task');
      expect(result).toContain('@urgent');
      expect(result).toContain('@work');
    });
  });

  describe('list_tasks', () => {
    it('should return empty message when no tasks', async () => {
      const result = await handlers.handleTool('list_tasks', {});

      expect(result).toBe('No tasks found.');
    });

    it('should list created tasks', async () => {
      await handlers.handleTool('create_task', { content: 'Task 1' });
      await handlers.handleTool('create_task', { content: 'Task 2' });

      const result = await handlers.handleTool('list_tasks', {});

      expect(result).toContain('Task 1');
      expect(result).toContain('Task 2');
    });

    it('should filter by project name', async () => {
      await handlers.handleTool('create_project', { name: 'Work' });
      await handlers.handleTool('create_task', { content: 'Inbox task' });
      await handlers.handleTool('create_task', { content: 'Work task', project: 'Work' });

      const inboxResult = await handlers.handleTool('list_tasks', { project: 'Inbox' });
      const workResult = await handlers.handleTool('list_tasks', { project: 'Work' });

      expect(inboxResult).toContain('Inbox task');
      expect(inboxResult).not.toContain('Work task');
      expect(workResult).toContain('Work task');
      expect(workResult).not.toContain('Inbox task');
    });
  });

  describe('complete_task / reopen_task', () => {
    it('should complete a task', async () => {
      await handlers.handleTool('create_task', { content: 'To complete' });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('complete_task', { id: taskId });

      expect(result).toContain('Completed: To complete');
    });

    it('should reopen a completed task', async () => {
      await handlers.handleTool('create_task', { content: 'To reopen' });
      const taskId = await getLastCreatedTaskId();

      await handlers.handleTool('complete_task', { id: taskId });
      const result = await handlers.handleTool('reopen_task', { id: taskId });

      expect(result).toContain('Reopened: To reopen');
    });

    it('should error on non-existent task', async () => {
      await expect(handlers.handleTool('complete_task', { id: 'fake-id' }))
        .rejects.toThrow('Task not found');
    });
  });

  describe('update_task', () => {
    it('should update task content', async () => {
      await handlers.handleTool('create_task', { content: 'Original' });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('update_task', {
        id: taskId,
        content: 'Updated content',
      });

      expect(result).toContain('Updated task');
      expect(result).toContain('Updated content');
    });

    it('should error on non-existent task', async () => {
      await expect(handlers.handleTool('update_task', { id: 'fake-id', content: 'test' }))
        .rejects.toThrow('Task not found');
    });
  });

  describe('delete_task', () => {
    it('should delete a task', async () => {
      await handlers.handleTool('create_task', { content: 'To delete' });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('delete_task', { id: taskId });

      expect(result).toBe('Task deleted.');

      // Verify it's gone
      const listResult = await handlers.handleTool('list_tasks', {});
      expect(listResult).toBe('No tasks found.');
    });

    it('should error on non-existent task', async () => {
      await expect(handlers.handleTool('delete_task', { id: 'fake-id' }))
        .rejects.toThrow('Task not found');
    });
  });

  describe('today', () => {
    it('should return empty message when no tasks due today', async () => {
      const result = await handlers.handleTool('today', {});

      expect(result).toBe('No tasks due today.');
    });

    it('should return tasks due today', async () => {
      await handlers.handleTool('create_task', { content: 'Today task', due: 'today' });
      await handlers.handleTool('create_task', { content: 'Tomorrow task', due: 'tomorrow' });

      const result = await handlers.handleTool('today', {});

      expect(result).toContain('Tasks for today');
      expect(result).toContain('Today task');
      expect(result).not.toContain('Tomorrow task');
    });
  });

  describe('upcoming', () => {
    it('should return empty message when no upcoming tasks', async () => {
      const result = await handlers.handleTool('upcoming', { days: 7 });

      expect(result).toBe('No tasks due in the next 7 days.');
    });

    it('should return tasks due within days', async () => {
      await handlers.handleTool('create_task', { content: 'Soon task', due: 'tomorrow' });

      const result = await handlers.handleTool('upcoming', { days: 7 });

      expect(result).toContain('Upcoming tasks');
      expect(result).toContain('Soon task');
    });

    it('should default to 7 days', async () => {
      const result = await handlers.handleTool('upcoming', {});

      expect(result).toContain('7 days');
    });
  });

  describe('list_projects', () => {
    it('should list inbox project', async () => {
      const result = await handlers.handleTool('list_projects', {});

      expect(result).toContain('Inbox');
    });
  });

  describe('create_project', () => {
    it('should create a project', async () => {
      const result = await handlers.handleTool('create_project', {
        name: 'New Project',
        color: 'red',
      });

      expect(result).toContain('Created project');
      expect(result).toContain('New Project');
    });
  });

  describe('list_labels', () => {
    it('should return empty message when no labels', async () => {
      const result = await handlers.handleTool('list_labels', {});

      expect(result).toBe('No labels found.');
    });

    it('should list created labels', async () => {
      await handlers.handleTool('create_label', { name: 'test-label' });

      const result = await handlers.handleTool('list_labels', {});

      expect(result).toContain('@test-label');
    });
  });

  describe('create_label', () => {
    it('should create a label', async () => {
      const result = await handlers.handleTool('create_label', {
        name: 'new-label',
        color: 'blue',
      });

      expect(result).toContain('Created label');
      expect(result).toContain('@new-label');
      expect(result).toContain('blue');
    });
  });

  describe('unknown tool', () => {
    it('should throw on unknown tool name', async () => {
      await expect(handlers.handleTool('nonexistent_tool', {}))
        .rejects.toThrow('Unknown tool: nonexistent_tool');
    });
  });

  describe('validation errors', () => {
    it('should throw on missing required content', async () => {
      await expect(handlers.handleTool('create_task', {}))
        .rejects.toThrow();
    });

    it('should throw on invalid priority', async () => {
      await expect(handlers.handleTool('create_task', { content: 'test', priority: 10 }))
        .rejects.toThrow();
    });
  });
});

// Helper to get full task ID by querying DB (output only shows first 8 chars)
async function getLastCreatedTaskId(): Promise<string> {
  const task = await db
    .selectFrom('tasks')
    .select('id')
    .orderBy('created_at', 'desc')
    .executeTakeFirst();

  if (!task) {
    throw new Error('No tasks found in database');
  }
  return task.id;
}

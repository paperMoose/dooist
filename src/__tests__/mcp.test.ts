import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import type { Database } from '../types/database.js';
import { ToolHandlers, getToolDefinitions } from '../mcp/tools.js';
import * as migration from '../db/migrations/001_initial.js';
import * as migration002 from '../db/migrations/002_add_context.js';

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
  await migration002.up(db);

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
    expect(toolNames).toContain('get_task');
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

    it('should create task with all fields', async () => {
      await handlers.handleTool('create_project', { name: 'AllFields' });

      const result = await handlers.handleTool('create_task', {
        content: 'Full task',
        description: 'Detailed desc',
        project: 'AllFields',
        priority: 3,
        due: 'tomorrow',
        labels: ['home', 'errand'],
      });

      expect(result).toContain('Full task');
      expect(result).toContain('Description: Detailed desc');
      expect(result).toContain('Priority: P2'); // priority 3 = P2 display
      expect(result).toContain('Due: tomorrow');
      expect(result).toContain('@home');
      expect(result).toContain('@errand');
    });

    it('should create task with only content (minimal)', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Minimal task',
      });

      expect(result).toContain('Minimal task');
      expect(result).not.toContain('Priority:');
      expect(result).not.toContain('Due:');
      expect(result).not.toContain('Labels:');
    });

    it('should create task with priority and show P-level', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Urgent task',
        priority: 4,
      });

      expect(result).toContain('Urgent task');
      expect(result).toContain('Priority: P1'); // Priority 4 = P1 display
    });

    it('should reject invalid priority', async () => {
      await expect(handlers.handleTool('create_task', { content: 'test', priority: 10 }))
        .rejects.toThrow();

      await expect(handlers.handleTool('create_task', { content: 'test', priority: 0 }))
        .rejects.toThrow();
    });

    it('should create task with due date', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Task with due',
        due: 'tomorrow',
      });

      expect(result).toContain('Task with due');
      expect(result).toContain('Due: tomorrow');
    });

    it('should create task with natural language due date', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Monday task',
        due: 'next monday',
      });

      expect(result).toContain('Monday task');
      expect(result).toContain('Due: next monday');
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

    it('should filter by label name', async () => {
      await handlers.handleTool('create_task', { content: 'Tagged', labels: ['focus'] });
      await handlers.handleTool('create_task', { content: 'Untagged' });

      const result = await handlers.handleTool('list_tasks', { label: 'focus' });

      expect(result).toContain('Tagged');
      expect(result).not.toContain('Untagged');
    });

    it('should include completed tasks when requested', async () => {
      await handlers.handleTool('create_task', { content: 'Done task' });
      const taskId = await getLastCreatedTaskId();
      await handlers.handleTool('complete_task', { id: taskId });

      const withoutCompleted = await handlers.handleTool('list_tasks', {});
      const withCompleted = await handlers.handleTool('list_tasks', { completed: true });

      expect(withoutCompleted).toBe('No tasks found.');
      expect(withCompleted).toContain('Done task');
    });
  });

  describe('complete_task / reopen_task', () => {
    it('should complete a task', async () => {
      await handlers.handleTool('create_task', { content: 'To complete' });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('complete_task', { id: taskId });

      expect(result).toContain('Completed: To complete');
    });

    it('should complete a task using 8-char truncated ID', async () => {
      await handlers.handleTool('create_task', { content: 'Truncated complete' });
      const truncatedId = await getTruncatedTaskId();

      const result = await handlers.handleTool('complete_task', { id: truncatedId });

      expect(result).toContain('Completed: Truncated complete');
    });

    it('should reopen a completed task', async () => {
      await handlers.handleTool('create_task', { content: 'To reopen' });
      const taskId = await getLastCreatedTaskId();

      await handlers.handleTool('complete_task', { id: taskId });
      const result = await handlers.handleTool('reopen_task', { id: taskId });

      expect(result).toContain('Reopened: To reopen');
    });

    it('should reopen using 8-char truncated ID', async () => {
      await handlers.handleTool('create_task', { content: 'Truncated reopen' });
      const truncatedId = await getTruncatedTaskId();

      await handlers.handleTool('complete_task', { id: truncatedId });
      const result = await handlers.handleTool('reopen_task', { id: truncatedId });

      expect(result).toContain('Reopened: Truncated reopen');
    });

    it('should complete already-completed task', async () => {
      await handlers.handleTool('create_task', { content: 'Double complete' });
      const taskId = await getLastCreatedTaskId();

      await handlers.handleTool('complete_task', { id: taskId });
      // Completing again should still work (idempotent)
      const result = await handlers.handleTool('complete_task', { id: taskId });
      expect(result).toContain('Completed: Double complete');
    });

    it('should reopen a non-completed task without error', async () => {
      await handlers.handleTool('create_task', { content: 'Not completed' });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('reopen_task', { id: taskId });
      expect(result).toContain('Reopened: Not completed');
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

    it('should update task using 8-char truncated ID', async () => {
      await handlers.handleTool('create_task', { content: 'Before update' });
      const truncatedId = await getTruncatedTaskId();

      const result = await handlers.handleTool('update_task', {
        id: truncatedId,
        content: 'After update',
      });

      expect(result).toContain('Updated task');
      expect(result).toContain('After update');
    });

    it('should update priority, due date, and labels', async () => {
      await handlers.handleTool('create_task', { content: 'Multi update' });
      const truncatedId = await getTruncatedTaskId();

      const result = await handlers.handleTool('update_task', {
        id: truncatedId,
        priority: 4,
        due: 'tomorrow',
        labels: ['updated-label'],
      });

      expect(result).toContain('Priority: P1');
      expect(result).toContain('Due: tomorrow');
      expect(result).toContain('@updated-label');
    });

    it('should update with project name (not ID)', async () => {
      await handlers.handleTool('create_project', { name: 'MoveTarget' });
      await handlers.handleTool('create_task', { content: 'Moveable task' });
      const truncatedId = await getTruncatedTaskId();

      const result = await handlers.handleTool('update_task', {
        id: truncatedId,
        project: 'MoveTarget',
      });

      expect(result).toContain('Updated task');

      // Verify it's no longer in Inbox
      const inboxTasks = await handlers.handleTool('list_tasks', { project: 'Inbox' });
      expect(inboxTasks).not.toContain('Moveable task');

      const targetTasks = await handlers.handleTool('list_tasks', { project: 'MoveTarget' });
      expect(targetTasks).toContain('Moveable task');
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

    it('should delete using 8-char truncated ID', async () => {
      await handlers.handleTool('create_task', { content: 'Truncated delete' });
      const truncatedId = await getTruncatedTaskId();

      const result = await handlers.handleTool('delete_task', { id: truncatedId });

      expect(result).toBe('Task deleted.');

      const listResult = await handlers.handleTool('list_tasks', {});
      expect(listResult).toBe('No tasks found.');
    });

    it('should cascade delete task_labels on task delete', async () => {
      await handlers.handleTool('create_task', { content: 'Labeled delete', labels: ['cascade-test'] });
      const truncatedId = await getTruncatedTaskId();
      const fullId = await getLastCreatedTaskId();

      await handlers.handleTool('delete_task', { id: truncatedId });

      // Verify task_labels rows are gone
      const orphanedLabels = await db
        .selectFrom('task_labels')
        .where('task_id', '=', fullId)
        .selectAll()
        .execute();

      expect(orphanedLabels).toHaveLength(0);
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

    it('should return overdue tasks', async () => {
      // Insert a task with a past due date directly
      const taskId = crypto.randomUUID();
      await db.insertInto('tasks').values({
        id: taskId,
        project_id: inboxId,
        content: 'Overdue task',
        priority: 1,
        is_completed: 0,
        due_date: '2020-01-01',
        due_string: '2020-01-01',
        order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute();

      const result = await handlers.handleTool('today', {});

      expect(result).toContain('Overdue task');
    });

    it('should exclude future tasks', async () => {
      await handlers.handleTool('create_task', { content: 'Future task', due: 'in 10 days' });

      const result = await handlers.handleTool('today', {});

      expect(result).not.toContain('Future task');
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

    it('should use custom days parameter', async () => {
      await handlers.handleTool('create_task', { content: 'Soon task', due: 'tomorrow' });

      const result = await handlers.handleTool('upcoming', { days: 3 });

      expect(result).toContain('next 3 days');
      expect(result).toContain('Soon task');
    });

    it('should exclude tasks beyond the window', async () => {
      await handlers.handleTool('create_task', { content: 'Far task', due: 'in 30 days' });

      const result = await handlers.handleTool('upcoming', { days: 3 });

      expect(result).toBe('No tasks due in the next 3 days.');
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
      expect(result).toContain('(Inbox)');
    });

    it('should list created projects alongside Inbox', async () => {
      await handlers.handleTool('create_project', { name: 'ListedProject' });

      const result = await handlers.handleTool('list_projects', {});

      expect(result).toContain('Inbox');
      expect(result).toContain('ListedProject');
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

    it('should create a project with color', async () => {
      const result = await handlers.handleTool('create_project', {
        name: 'Colored Project',
        color: 'green',
      });

      expect(result).toContain('Colored Project');

      // Verify it shows up in list
      const list = await handlers.handleTool('list_projects', {});
      expect(list).toContain('Colored Project');
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

    it('should error on duplicate label name', async () => {
      await handlers.handleTool('create_label', { name: 'dupe-label' });

      await expect(handlers.handleTool('create_label', { name: 'dupe-label' }))
        .rejects.toThrow('already exists');
    });
  });

  describe('get_task', () => {
    it('should return full task details with context', async () => {
      await handlers.handleTool('create_task', {
        content: 'Task with context',
        context: '## Intent\nDo the thing\n## Plan\n1. Step one',
      });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('get_task', { id: taskId });

      expect(result).toContain('Task with context');
      expect(result).toContain('Context:');
      expect(result).toContain('## Intent');
      expect(result).toContain('Do the thing');
      expect(result).toContain('## Plan');
    });

    it('should return task with truncated 8-char ID', async () => {
      await handlers.handleTool('create_task', {
        content: 'Truncated get',
        context: '## Intent\nTest truncated ID',
      });
      const truncatedId = await getTruncatedTaskId();

      const result = await handlers.handleTool('get_task', { id: truncatedId });

      expect(result).toContain('Truncated get');
      expect(result).toContain('## Intent');
    });

    it('should error on non-existent task', async () => {
      await expect(handlers.handleTool('get_task', { id: 'fake-id' }))
        .rejects.toThrow('Task not found');
    });

    it('should return task without context when none set', async () => {
      await handlers.handleTool('create_task', { content: 'No context task' });
      const taskId = await getLastCreatedTaskId();

      const result = await handlers.handleTool('get_task', { id: taskId });

      expect(result).toContain('No context task');
      expect(result).not.toContain('Context:');
    });
  });

  describe('context field', () => {
    it('should create task with context', async () => {
      const result = await handlers.handleTool('create_task', {
        content: 'Contextual task',
        context: '## Intent\nBuild feature X',
      });

      // list format should show indicator, not full body
      expect(result).toContain('[has context]');
      expect(result).not.toContain('## Intent');
    });

    it('should update task to add context', async () => {
      await handlers.handleTool('create_task', { content: 'Add context later' });
      const taskId = await getLastCreatedTaskId();

      await handlers.handleTool('update_task', {
        id: taskId,
        context: '## Plan\nStep 1\nStep 2',
      });

      const result = await handlers.handleTool('get_task', { id: taskId });
      expect(result).toContain('## Plan');
      expect(result).toContain('Step 1');
    });

    it('should update task to change context', async () => {
      await handlers.handleTool('create_task', {
        content: 'Change context',
        context: '## Old\nold content',
      });
      const taskId = await getLastCreatedTaskId();

      await handlers.handleTool('update_task', {
        id: taskId,
        context: '## New\nnew content',
      });

      const result = await handlers.handleTool('get_task', { id: taskId });
      expect(result).toContain('## New');
      expect(result).toContain('new content');
      expect(result).not.toContain('## Old');
    });

    it('should show [has context] indicator in list but not full body', async () => {
      await handlers.handleTool('create_task', {
        content: 'Listed context task',
        context: '## Intent\nThis should not appear in list',
      });

      const result = await handlers.handleTool('list_tasks', {});

      expect(result).toContain('Listed context task');
      expect(result).toContain('[has context]');
      expect(result).not.toContain('## Intent');
      expect(result).not.toContain('This should not appear in list');
    });
  });

  describe('unknown tool', () => {
    it('should throw on unknown tool name', async () => {
      await expect(handlers.handleTool('nonexistent_tool', {}))
        .rejects.toThrow('Unknown tool: nonexistent_tool');
    });
  });

  describe('scan_todos', () => {
    it('should scan a directory and find TODO comments', async () => {
      // Scan the project's own source (which may have TODOs)
      // This tests the tool integration - even if no TODOs found, it should not error
      const result = await handlers.handleTool('scan_todos', {
        directory: '/Users/ryanbrandt/git/todoistclone/src',
      });

      // Should return a result (either found or not found)
      expect(typeof result).toBe('string');
      expect(result).toMatch(/TODO|No TODOs found/);
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

// Helper to get 8-char truncated ID (matching MCP output format)
async function getTruncatedTaskId(): Promise<string> {
  const fullId = await getLastCreatedTaskId();
  return fullId.slice(0, 8);
}

import { z } from 'zod';
import type { Kysely } from 'kysely';
import type { Database, TaskWithLabels, Project, Label, TaskStatusUpdate } from '../types/database.js';
import { TaskService } from '../services/tasks.js';
import { ProjectService } from '../services/projects.js';
import { LabelService } from '../services/labels.js';
import { TodoScanner, type FoundTodo } from '../services/todos.js';

// Input schemas
export const createTaskSchema = z.object({
  content: z.string().describe('The task content/title'),
  description: z.string().optional().describe('Optional detailed description'),
  project: z.string().optional().describe('Project name or ID (defaults to Inbox)'),
  priority: z.number().min(1).max(4).optional().describe('Priority 1-4 (4 = urgent, 1 = low)'),
  due: z.string().optional().describe('Due date string like "tomorrow", "next monday", "2024-03-15"'),
  labels: z.array(z.string()).optional().describe('Array of label names'),
  context: z.string().optional().describe('Rich markdown context: intent, desired outputs, current status, spec plan'),
  parentId: z.string().optional().describe('Parent task ID to create this as a subtask'),
});

export const listTasksSchema = z.object({
  project: z.string().optional().describe('Filter by project name or ID'),
  label: z.string().optional().describe('Filter by label name'),
  completed: z.boolean().optional().describe('Include completed tasks'),
  parentId: z.string().optional().describe('Filter by parent task ID (get subtasks)'),
  topLevel: z.boolean().optional().describe('Only show top-level tasks (no subtasks)'),
});

export const taskIdSchema = z.object({
  id: z.string().describe('The task ID'),
});

export const updateTaskSchema = z.object({
  id: z.string().describe('The task ID'),
  content: z.string().optional().describe('New task content'),
  description: z.string().optional().describe('New description'),
  project: z.string().optional().describe('Move to project'),
  priority: z.number().min(1).max(4).optional().describe('New priority'),
  due: z.string().optional().describe('New due date'),
  labels: z.array(z.string()).optional().describe('Replace labels'),
  context: z.string().optional().describe('Rich markdown context: intent, desired outputs, current status, spec plan'),
  parentId: z.string().nullable().optional().describe('Parent task ID (null to make top-level)'),
});

export const getTaskSchema = z.object({
  id: z.string().describe('The task ID'),
});

export const upcomingSchema = z.object({
  days: z.number().min(1).max(30).optional().default(7).describe('Number of days to look ahead'),
});

export const createProjectSchema = z.object({
  name: z.string().describe('Project name'),
  color: z.string().optional().describe('Project color (hex or name)'),
});

export const createLabelSchema = z.object({
  name: z.string().describe('Label name'),
  color: z.string().optional().describe('Label color'),
});

export const scanTodosSchema = z.object({
  directory: z.string().optional().describe('Directory to scan (defaults to current working directory)'),
  createTasks: z.boolean().optional().default(false).describe('Create tasks from found TODOs'),
  project: z.string().optional().describe('Project for created tasks (defaults to Inbox)'),
});

export const addTaskUpdateSchema = z.object({
  id: z.string().describe('The task ID'),
  update: z.string().describe('The status update content'),
});

// Tool definitions
export function getToolDefinitions() {
  return [
    {
      name: 'create_task',
      description: 'Create a new task. Supports natural language due dates like "tomorrow" or "every monday". To create multiple tasks at once, call this tool multiple times in a single message. Use parentId to create subtasks.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          content: { type: 'string', description: 'The task content/title' },
          description: { type: 'string', description: 'Optional detailed description' },
          project: { type: 'string', description: 'Project name or ID (defaults to Inbox)' },
          priority: { type: 'number', minimum: 1, maximum: 4, description: 'Priority 1-4 (4 = urgent)' },
          due: { type: 'string', description: 'Due date like "tomorrow", "next monday", "2024-03-15"' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Array of label names' },
          context: { type: 'string', description: 'Rich markdown context: intent, desired outputs, current status, spec plan' },
          parentId: { type: 'string', description: 'Parent task ID to create this as a subtask' },
        },
        required: ['content'],
      },
    },
    {
      name: 'list_tasks',
      description: 'List tasks with optional filters. By default shows incomplete top-level tasks. Use parentId to get subtasks of a specific task.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project: { type: 'string', description: 'Filter by project name or ID' },
          label: { type: 'string', description: 'Filter by label name' },
          completed: { type: 'boolean', description: 'Include completed tasks' },
          parentId: { type: 'string', description: 'Filter by parent task ID (get subtasks)' },
          topLevel: { type: 'boolean', description: 'Only show top-level tasks (no subtasks). Default: true' },
        },
      },
    },
    {
      name: 'complete_task',
      description: 'Mark a task as completed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The task ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'reopen_task',
      description: 'Reopen a completed task.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The task ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'update_task',
      description: 'Update an existing task. Use parentId to convert to subtask or null to make top-level.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The task ID' },
          content: { type: 'string', description: 'New task content' },
          description: { type: 'string', description: 'New description' },
          project: { type: 'string', description: 'Move to project' },
          priority: { type: 'number', minimum: 1, maximum: 4, description: 'New priority' },
          due: { type: 'string', description: 'New due date' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Replace labels' },
          context: { type: 'string', description: 'Rich markdown context: intent, desired outputs, current status, spec plan' },
          parentId: { type: ['string', 'null'], description: 'Parent task ID (null to make top-level)' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get_task',
      description: 'Get full details of a task including rich context (intent, outputs, plan).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The task ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_task',
      description: 'Delete a task permanently.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The task ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'today',
      description: 'Get all tasks due today (including overdue).',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'upcoming',
      description: 'Get tasks due in the next N days.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', minimum: 1, maximum: 30, default: 7, description: 'Days to look ahead' },
        },
      },
    },
    {
      name: 'list_projects',
      description: 'List all projects.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'create_project',
      description: 'Create a new project.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Project name' },
          color: { type: 'string', description: 'Project color' },
        },
        required: ['name'],
      },
    },
    {
      name: 'list_labels',
      description: 'List all labels.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'create_label',
      description: 'Create a new label.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Label name' },
          color: { type: 'string', description: 'Label color' },
        },
        required: ['name'],
      },
    },
    {
      name: 'scan_todos',
      description: 'Scan codebase for TODO, FIXME, HACK, and XXX comments. Optionally create tasks from them.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          directory: { type: 'string', description: 'Directory to scan (defaults to current working directory)' },
          createTasks: { type: 'boolean', description: 'Create tasks from found TODOs' },
          project: { type: 'string', description: 'Project for created tasks (defaults to Inbox)' },
        },
      },
    },
    {
      name: 'add_task_update',
      description: 'Add a timestamped status update to a task. Use this to track progress and activity on a task over time.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The task ID' },
          update: { type: 'string', description: 'The status update content' },
        },
        required: ['id', 'update'],
      },
    },
  ];
}

// Tool handlers
export class ToolHandlers {
  private taskService: TaskService;
  private projectService: ProjectService;
  private labelService: LabelService;
  private todoScanner: TodoScanner;

  constructor(db: Kysely<Database>) {
    this.taskService = new TaskService(db);
    this.projectService = new ProjectService(db);
    this.labelService = new LabelService(db);
    this.todoScanner = new TodoScanner();
  }

  async handleTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'create_task':
        return this.createTask(args);
      case 'list_tasks':
        return this.listTasks(args);
      case 'complete_task':
        return this.completeTask(args);
      case 'reopen_task':
        return this.reopenTask(args);
      case 'update_task':
        return this.updateTask(args);
      case 'get_task':
        return this.getTask(args);
      case 'delete_task':
        return this.deleteTask(args);
      case 'today':
        return this.today();
      case 'upcoming':
        return this.upcoming(args);
      case 'list_projects':
        return this.listProjects();
      case 'create_project':
        return this.createProject(args);
      case 'list_labels':
        return this.listLabels();
      case 'create_label':
        return this.createLabel(args);
      case 'scan_todos':
        return this.scanTodos(args);
      case 'add_task_update':
        return this.addTaskUpdate(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async createTask(args: Record<string, unknown>): Promise<string> {
    const input = createTaskSchema.parse(args);

    let projectId = input.project;
    if (input.project) {
      const project = await this.findProject(input.project);
      projectId = project?.id;
    }

    // Resolve parentId if provided (supports truncated IDs)
    let parentId = input.parentId;
    if (parentId) {
      const parentTask = await this.taskService.getById(parentId);
      if (!parentTask) {
        throw new Error(`Parent task not found: ${parentId}`);
      }
      parentId = parentTask.id;
    }

    const task = await this.taskService.create({
      content: input.content,
      description: input.description,
      projectId,
      priority: input.priority,
      due: input.due,
      labels: input.labels,
      context: input.context,
      parentId,
    });

    return this.formatTask(task);
  }

  private async listTasks(args: Record<string, unknown>): Promise<string> {
    const input = listTasksSchema.parse(args);

    let projectId: string | undefined;
    if (input.project) {
      const project = await this.findProject(input.project);
      projectId = project?.id;
    }

    let labelId: string | undefined;
    if (input.label) {
      const label = await this.labelService.getByName(input.label);
      labelId = label?.id;
    }

    // Resolve parentId if provided (supports truncated IDs)
    let parentId: string | undefined;
    if (input.parentId) {
      const parentTask = await this.taskService.getById(input.parentId);
      if (!parentTask) {
        throw new Error(`Parent task not found: ${input.parentId}`);
      }
      parentId = parentTask.id;
    }

    const tasks = await this.taskService.list({
      projectId,
      labelId,
      completed: input.completed,
      parentId,
      topLevel: input.parentId ? false : (input.topLevel ?? true),
    });

    if (tasks.length === 0) {
      return input.parentId ? 'No subtasks found.' : 'No tasks found.';
    }

    // If listing subtasks, show them indented
    if (input.parentId) {
      return tasks.map((t) => this.formatTask(t, 1)).join('\n\n');
    }

    return tasks.map((t) => this.formatTask(t)).join('\n\n');
  }

  private async completeTask(args: Record<string, unknown>): Promise<string> {
    const { id } = taskIdSchema.parse(args);
    const task = await this.taskService.complete(id);
    return `Completed: ${task.content}`;
  }

  private async reopenTask(args: Record<string, unknown>): Promise<string> {
    const { id } = taskIdSchema.parse(args);
    const task = await this.taskService.reopen(id);
    return `Reopened: ${task.content}`;
  }

  private async updateTask(args: Record<string, unknown>): Promise<string> {
    const input = updateTaskSchema.parse(args);

    let projectId: string | undefined;
    if (input.project) {
      const project = await this.findProject(input.project);
      projectId = project?.id;
    }

    // Resolve parentId if provided (supports truncated IDs)
    let parentId: string | null | undefined;
    if (input.parentId !== undefined) {
      if (input.parentId === null) {
        parentId = null; // Explicitly set to null to make top-level
      } else {
        const parentTask = await this.taskService.getById(input.parentId);
        if (!parentTask) {
          throw new Error(`Parent task not found: ${input.parentId}`);
        }
        parentId = parentTask.id;
      }
    }

    const task = await this.taskService.update(input.id, {
      content: input.content,
      description: input.description,
      projectId,
      priority: input.priority,
      due: input.due,
      labels: input.labels,
      context: input.context,
      parentId,
    });

    return `Updated task:\n${this.formatTask(task)}`;
  }

  private async getTask(args: Record<string, unknown>): Promise<string> {
    const { id } = getTaskSchema.parse(args);
    const task = await this.taskService.getById(id);
    if (!task) {
      throw new Error('Task not found');
    }
    const updates = await this.taskService.getUpdates(task.id);
    return this.formatTaskFull(task, updates);
  }

  private async deleteTask(args: Record<string, unknown>): Promise<string> {
    const { id } = taskIdSchema.parse(args);
    await this.taskService.delete(id);
    return `Task deleted.`;
  }

  private async today(): Promise<string> {
    const tasks = await this.taskService.today();

    if (tasks.length === 0) {
      return 'No tasks due today.';
    }

    return `Tasks for today (${tasks.length}):\n\n${tasks.map((t) => this.formatTask(t)).join('\n\n')}`;
  }

  private async upcoming(args: Record<string, unknown>): Promise<string> {
    const { days } = upcomingSchema.parse(args);
    const tasks = await this.taskService.upcoming(days);

    if (tasks.length === 0) {
      return `No tasks due in the next ${days} days.`;
    }

    return `Upcoming tasks (next ${days} days):\n\n${tasks.map((t) => this.formatTask(t)).join('\n\n')}`;
  }

  private async listProjects(): Promise<string> {
    const projects = await this.projectService.getAll();
    return projects.map((p) => this.formatProject(p)).join('\n');
  }

  private async createProject(args: Record<string, unknown>): Promise<string> {
    const input = createProjectSchema.parse(args);
    const project = await this.projectService.create(input);
    return `Created project: ${this.formatProject(project)}`;
  }

  private async listLabels(): Promise<string> {
    const labels = await this.labelService.getAll();

    if (labels.length === 0) {
      return 'No labels found.';
    }

    return labels.map((l) => this.formatLabel(l)).join('\n');
  }

  private async createLabel(args: Record<string, unknown>): Promise<string> {
    const input = createLabelSchema.parse(args);
    const label = await this.labelService.create(input);
    return `Created label: ${this.formatLabel(label)}`;
  }

  private async scanTodos(args: Record<string, unknown>): Promise<string> {
    const input = scanTodosSchema.parse(args);
    const directory = input.directory || process.cwd();

    const todos = await this.todoScanner.scan(directory);

    if (todos.length === 0) {
      return 'No TODOs found in codebase.';
    }

    // Group by type
    const grouped: Record<string, FoundTodo[]> = {};
    for (const todo of todos) {
      if (!grouped[todo.type]) grouped[todo.type] = [];
      grouped[todo.type].push(todo);
    }

    // If createTasks is true, create tasks from the TODOs
    if (input.createTasks) {
      let projectId: string | undefined;
      if (input.project) {
        const project = await this.findProject(input.project);
        projectId = project?.id;
      }

      let created = 0;
      for (const todo of todos) {
        await this.taskService.create({
          content: `[${todo.type}] ${todo.content}`,
          description: `${todo.file}:${todo.line}`,
          projectId,
          priority: todo.type === 'FIXME' ? 2 : todo.type === 'HACK' ? 3 : undefined,
        });
        created++;
      }

      return `Found ${todos.length} TODOs. Created ${created} tasks.\n\n${this.formatTodoList(grouped)}`;
    }

    return `Found ${todos.length} TODOs:\n\n${this.formatTodoList(grouped)}`;
  }

  private async addTaskUpdate(args: Record<string, unknown>): Promise<string> {
    const input = addTaskUpdateSchema.parse(args);
    const update = await this.taskService.addUpdate(input.id, input.update);
    return `Added update at ${update.created_at}:\n${update.content}`;
  }

  private formatTodoList(grouped: Record<string, FoundTodo[]>): string {
    const parts: string[] = [];

    for (const [type, todos] of Object.entries(grouped)) {
      parts.push(`${type} (${todos.length}):`);
      for (const todo of todos) {
        parts.push(`  - ${todo.content}`);
        parts.push(`    ${todo.file}:${todo.line}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  private async findProject(nameOrId: string): Promise<Project | undefined> {
    // Try by ID first
    const project = await this.projectService.getById(nameOrId);
    if (project) return project;

    // Try by name
    const projects = await this.projectService.getAll();
    return projects.find((p) => p.name.toLowerCase() === nameOrId.toLowerCase());
  }

  private formatTask(task: TaskWithLabels, indentLevel: number = 0): string {
    const indent = '  '.repeat(indentLevel);
    const prefix = indentLevel > 0 ? '└─ ' : '';
    const parts = [`${indent}${prefix}[${task.id.slice(0, 8)}] ${task.content}`];

    if (task.priority > 1) {
      parts.push(`${indent}  Priority: P${5 - task.priority}`); // Convert to P1-P4 display
    }

    if (task.due_date) {
      parts.push(`${indent}  Due: ${task.due_string || task.due_date}`);
    }

    if (task.labels.length > 0) {
      parts.push(`${indent}  Labels: ${task.labels.map((l) => `@${l.name}`).join(' ')}`);
    }

    if (task.description) {
      parts.push(`${indent}  Description: ${task.description}`);
    }

    if (task.parent_id) {
      parts.push(`${indent}  [subtask]`);
    }

    if (task.context) {
      parts.push(`${indent}  [has context]`);
    }

    if (task.is_completed) {
      parts.push(`${indent}  (completed)`);
    }

    return parts.join('\n');
  }

  private formatTaskFull(task: TaskWithLabels, updates: TaskStatusUpdate[] = [], indentLevel: number = 0): string {
    const indent = '  '.repeat(indentLevel);
    const prefix = indentLevel > 0 ? '└─ ' : '';
    const parts = [`${indent}${prefix}[${task.id.slice(0, 8)}] ${task.content}`];

    if (task.priority > 1) {
      parts.push(`${indent}  Priority: P${5 - task.priority}`);
    }

    if (task.due_date) {
      parts.push(`${indent}  Due: ${task.due_string || task.due_date}`);
    }

    if (task.labels.length > 0) {
      parts.push(`${indent}  Labels: ${task.labels.map((l) => `@${l.name}`).join(' ')}`);
    }

    if (task.description) {
      parts.push(`${indent}  Description: ${task.description}`);
    }

    if (task.parent_id) {
      parts.push(`${indent}  Parent: ${task.parent_id.slice(0, 8)}`);
    }

    if (task.is_completed) {
      parts.push(`${indent}  (completed)`);
    }

    let result = parts.join('\n');

    if (task.context) {
      result += `\n\n${indent}Context:\n${task.context}`;
    }

    if (updates.length > 0) {
      result += `\n\n${indent}Updates:`;
      for (const update of updates) {
        result += `\n${indent}  [${update.created_at}] ${update.content}`;
      }
    }

    return result;
  }

  private formatProject(project: Project): string {
    const inbox = project.is_inbox ? ' (Inbox)' : '';
    return `[${project.id.slice(0, 8)}] ${project.name}${inbox}`;
  }

  private formatLabel(label: Label): string {
    return `[${label.id.slice(0, 8)}] @${label.name}${label.color ? ` (${label.color})` : ''}`;
  }
}

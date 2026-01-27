import type { Kysely } from 'kysely';
import type { Database, Task, NewTask, TaskUpdate, Label, TaskWithLabels } from '../types/database.js';
import { parseDueString, getTodayDate, getDateInDays } from './dates.js';
import { LabelService } from './labels.js';

export interface CreateTaskInput {
  content: string;
  description?: string;
  projectId?: string;
  priority?: number;
  due?: string;
  labels?: string[];
}

export interface UpdateTaskInput {
  content?: string;
  description?: string;
  projectId?: string;
  priority?: number;
  due?: string;
  labels?: string[];
}

export interface ListTasksOptions {
  projectId?: string;
  labelId?: string;
  completed?: boolean;
}

export class TaskService {
  private labelService: LabelService;

  constructor(private db: Kysely<Database>) {
    this.labelService = new LabelService(db);
  }

  async getById(id: string): Promise<TaskWithLabels | undefined> {
    const task = await this.db
      .selectFrom('tasks')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();

    if (!task) return undefined;

    const labels = await this.getTaskLabels(id);
    return { ...task, labels };
  }

  async list(options: ListTasksOptions = {}): Promise<TaskWithLabels[]> {
    let query = this.db.selectFrom('tasks').selectAll();

    if (options.projectId) {
      query = query.where('project_id', '=', options.projectId);
    }

    if (options.completed !== undefined) {
      query = query.where('is_completed', '=', options.completed ? 1 : 0);
    } else {
      query = query.where('is_completed', '=', 0);
    }

    if (options.labelId) {
      query = query.where('id', 'in', (eb) =>
        eb
          .selectFrom('task_labels')
          .where('label_id', '=', options.labelId!)
          .select('task_id')
      );
    }

    const tasks = await query.orderBy('order', 'asc').execute();

    return this.attachLabelsToTasks(tasks);
  }

  async today(): Promise<TaskWithLabels[]> {
    const todayDate = getTodayDate();

    const tasks = await this.db
      .selectFrom('tasks')
      .where('is_completed', '=', 0)
      .where((eb) =>
        eb.or([
          eb('due_date', '=', todayDate),
          eb('due_date', '<', todayDate), // Include overdue
        ])
      )
      .orderBy('priority', 'desc')
      .orderBy('due_date', 'asc')
      .selectAll()
      .execute();

    return this.attachLabelsToTasks(tasks);
  }

  async upcoming(days: number = 7): Promise<TaskWithLabels[]> {
    const todayDate = getTodayDate();
    const futureDate = getDateInDays(days);

    const tasks = await this.db
      .selectFrom('tasks')
      .where('is_completed', '=', 0)
      .where('due_date', '>=', todayDate)
      .where('due_date', '<=', futureDate)
      .orderBy('due_date', 'asc')
      .orderBy('priority', 'desc')
      .selectAll()
      .execute();

    return this.attachLabelsToTasks(tasks);
  }

  async create(input: CreateTaskInput): Promise<TaskWithLabels> {
    let projectId = input.projectId;

    if (!projectId) {
      const inbox = await this.db
        .selectFrom('projects')
        .where('is_inbox', '=', 1)
        .select('id')
        .executeTakeFirst();

      if (!inbox) {
        throw new Error('Inbox project not found');
      }
      projectId = inbox.id;
    }

    const maxOrder = await this.db
      .selectFrom('tasks')
      .where('project_id', '=', projectId)
      .select((eb) => eb.fn.max('order').as('max_order'))
      .executeTakeFirst();

    let dueData = {
      due_date: null as string | null,
      due_datetime: null as string | null,
      due_string: null as string | null,
      due_is_recurring: 0,
      due_timezone: null as string | null,
    };

    if (input.due) {
      const parsed = parseDueString(input.due);
      dueData = {
        due_date: parsed.date,
        due_datetime: parsed.datetime,
        due_string: parsed.string,
        due_is_recurring: parsed.isRecurring ? 1 : 0,
        due_timezone: parsed.timezone,
      };
    }

    const taskId = crypto.randomUUID();
    const newTask: NewTask = {
      id: taskId,
      project_id: projectId,
      section_id: null,
      parent_id: null,
      content: input.content,
      description: input.description ?? null,
      priority: input.priority ?? 1,
      is_completed: 0,
      completed_at: null,
      ...dueData,
      order: ((maxOrder?.max_order as number) ?? 0) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get or create labels BEFORE transaction to avoid SQLite locking issues
    let labels: { id: string }[] = [];
    if (input.labels && input.labels.length > 0) {
      labels = await Promise.all(
        input.labels.map((name) => this.labelService.getOrCreate(name))
      );
    }

    // Use transaction for task + task_labels
    await this.db.transaction().execute(async (trx) => {
      await trx.insertInto('tasks').values(newTask).execute();

      if (labels.length > 0) {
        await trx
          .insertInto('task_labels')
          .values(labels.map((label) => ({ task_id: taskId, label_id: label.id })))
          .execute();
      }
    });

    const task = await this.getById(taskId);
    if (!task) {
      throw new Error('Failed to create task');
    }

    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<TaskWithLabels> {
    // Check existence first
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Task not found');
    }

    const updates: TaskUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (input.content !== undefined) updates.content = input.content;
    if (input.description !== undefined) updates.description = input.description;
    if (input.projectId !== undefined) updates.project_id = input.projectId;
    if (input.priority !== undefined) updates.priority = input.priority;

    if (input.due !== undefined) {
      if (input.due === null || input.due === '') {
        updates.due_date = null;
        updates.due_datetime = null;
        updates.due_string = null;
        updates.due_is_recurring = 0;
        updates.due_timezone = null;
      } else {
        const parsed = parseDueString(input.due);
        updates.due_date = parsed.date;
        updates.due_datetime = parsed.datetime;
        updates.due_string = parsed.string;
        updates.due_is_recurring = parsed.isRecurring ? 1 : 0;
        updates.due_timezone = parsed.timezone;
      }
    }

    await this.db.updateTable('tasks').set(updates).where('id', '=', id).execute();

    if (input.labels !== undefined) {
      await this.setTaskLabels(id, input.labels);
    }

    const task = await this.getById(id);
    return task!;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .deleteFrom('tasks')
      .where('id', '=', id)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new Error('Task not found');
    }
  }

  async complete(id: string): Promise<TaskWithLabels> {
    // Check existence first
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Task not found');
    }

    await this.db
      .updateTable('tasks')
      .set({
        is_completed: 1,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute();

    return { ...existing, is_completed: 1, completed_at: new Date().toISOString() };
  }

  async reopen(id: string): Promise<TaskWithLabels> {
    // Check existence first
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Task not found');
    }

    await this.db
      .updateTable('tasks')
      .set({
        is_completed: 0,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute();

    return { ...existing, is_completed: 0, completed_at: null };
  }

  /**
   * Batch fetch labels for multiple tasks (fixes N+1 query problem)
   */
  private async attachLabelsToTasks(tasks: Task[]): Promise<TaskWithLabels[]> {
    if (tasks.length === 0) return [];

    const taskIds = tasks.map((t) => t.id);

    // Single query to get all task-label relationships with label data
    const taskLabels = await this.db
      .selectFrom('task_labels')
      .innerJoin('labels', 'labels.id', 'task_labels.label_id')
      .where('task_labels.task_id', 'in', taskIds)
      .select([
        'task_labels.task_id',
        'labels.id',
        'labels.name',
        'labels.color',
        'labels.order',
        'labels.is_favorite',
        'labels.created_at',
        'labels.updated_at',
      ])
      .execute();

    // Group labels by task_id
    const labelsByTaskId = new Map<string, Label[]>();
    for (const row of taskLabels) {
      const labels = labelsByTaskId.get(row.task_id) ?? [];
      labels.push({
        id: row.id,
        name: row.name,
        color: row.color,
        order: row.order,
        is_favorite: row.is_favorite,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      labelsByTaskId.set(row.task_id, labels);
    }

    // Attach labels to tasks
    return tasks.map((task) => ({
      ...task,
      labels: labelsByTaskId.get(task.id) ?? [],
    }));
  }

  private async getTaskLabels(taskId: string): Promise<Label[]> {
    const labelIds = await this.db
      .selectFrom('task_labels')
      .where('task_id', '=', taskId)
      .select('label_id')
      .execute();

    if (labelIds.length === 0) return [];

    return this.labelService.getByIds(labelIds.map((l) => l.label_id));
  }

  private async setTaskLabels(taskId: string, labelNames: string[]): Promise<void> {
    // Remove existing labels
    await this.db.deleteFrom('task_labels').where('task_id', '=', taskId).execute();

    if (labelNames.length === 0) return;

    // Get or create labels
    const labels = await Promise.all(
      labelNames.map((name) => this.labelService.getOrCreate(name))
    );

    // Insert task_labels
    await this.db
      .insertInto('task_labels')
      .values(labels.map((label) => ({ task_id: taskId, label_id: label.id })))
      .execute();
  }
}

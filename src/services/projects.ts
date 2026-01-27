import type { Kysely } from 'kysely';
import type { Database, Project, NewProject, ProjectUpdate } from '../types/database.js';

export class ProjectService {
  constructor(private db: Kysely<Database>) {}

  async getAll(): Promise<Project[]> {
    return this.db
      .selectFrom('projects')
      .where('is_archived', '=', 0)
      .orderBy('order', 'asc')
      .selectAll()
      .execute();
  }

  async getById(id: string): Promise<Project | undefined> {
    return this.db
      .selectFrom('projects')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }

  async getInbox(): Promise<Project> {
    const inbox = await this.db
      .selectFrom('projects')
      .where('is_inbox', '=', 1)
      .selectAll()
      .executeTakeFirst();

    if (!inbox) {
      throw new Error('Inbox project not found. Database may not be initialized.');
    }

    return inbox;
  }

  async create(data: { name: string; color?: string; parentId?: string }): Promise<Project> {
    const maxOrder = await this.db
      .selectFrom('projects')
      .select((eb) => eb.fn.max('order').as('max_order'))
      .executeTakeFirst();

    const newProject: NewProject = {
      id: crypto.randomUUID(),
      name: data.name,
      color: data.color ?? null,
      order: ((maxOrder?.max_order as number) ?? 0) + 1,
      is_inbox: 0,
      is_archived: 0,
      view_style: 'list',
      parent_id: data.parentId ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.db.insertInto('projects').values(newProject).execute();

    const project = await this.getById(newProject.id as string);
    if (!project) {
      throw new Error('Failed to create project');
    }

    return project;
  }

  async update(id: string, data: { name?: string; color?: string; isArchived?: boolean }): Promise<Project> {
    const updates: ProjectUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.color !== undefined) updates.color = data.color;
    if (data.isArchived !== undefined) updates.is_archived = data.isArchived ? 1 : 0;

    await this.db
      .updateTable('projects')
      .set(updates)
      .where('id', '=', id)
      .execute();

    const project = await this.getById(id);
    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  }

  async delete(id: string): Promise<void> {
    const project = await this.getById(id);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.is_inbox === 1) {
      throw new Error('Cannot delete the Inbox project');
    }

    await this.db.deleteFrom('projects').where('id', '=', id).execute();
  }

  async archive(id: string): Promise<Project> {
    return this.update(id, { isArchived: true });
  }

  async unarchive(id: string): Promise<Project> {
    return this.update(id, { isArchived: false });
  }
}

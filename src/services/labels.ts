import type { Kysely } from 'kysely';
import type { Database, Label, NewLabel, LabelUpdate } from '../types/database.js';

export class LabelService {
  constructor(private db: Kysely<Database>) {}

  async getAll(): Promise<Label[]> {
    return this.db
      .selectFrom('labels')
      .orderBy('order', 'asc')
      .selectAll()
      .execute();
  }

  async getById(id: string): Promise<Label | undefined> {
    return this.db
      .selectFrom('labels')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }

  async getByName(name: string): Promise<Label | undefined> {
    return this.db
      .selectFrom('labels')
      .where('name', '=', name)
      .selectAll()
      .executeTakeFirst();
  }

  async getByIds(ids: string[]): Promise<Label[]> {
    if (ids.length === 0) return [];

    return this.db
      .selectFrom('labels')
      .where('id', 'in', ids)
      .selectAll()
      .execute();
  }

  async create(data: { name: string; color?: string }): Promise<Label> {
    const existing = await this.getByName(data.name);
    if (existing) {
      throw new Error(`Label "${data.name}" already exists`);
    }

    const maxOrder = await this.db
      .selectFrom('labels')
      .select((eb) => eb.fn.max('order').as('max_order'))
      .executeTakeFirst();

    const newLabel: NewLabel = {
      id: crypto.randomUUID(),
      name: data.name,
      color: data.color ?? null,
      order: ((maxOrder?.max_order as number) ?? 0) + 1,
      is_favorite: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.db.insertInto('labels').values(newLabel).execute();

    const label = await this.getById(newLabel.id as string);
    if (!label) {
      throw new Error('Failed to create label');
    }

    return label;
  }

  async update(id: string, data: { name?: string; color?: string; isFavorite?: boolean }): Promise<Label> {
    if (data.name) {
      const existing = await this.getByName(data.name);
      if (existing && existing.id !== id) {
        throw new Error(`Label "${data.name}" already exists`);
      }
    }

    const updates: LabelUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.color !== undefined) updates.color = data.color;
    if (data.isFavorite !== undefined) updates.is_favorite = data.isFavorite ? 1 : 0;

    await this.db
      .updateTable('labels')
      .set(updates)
      .where('id', '=', id)
      .execute();

    const label = await this.getById(id);
    if (!label) {
      throw new Error('Label not found');
    }

    return label;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('labels').where('id', '=', id).execute();
  }

  async getOrCreate(name: string, color?: string): Promise<Label> {
    const existing = await this.getByName(name);
    if (existing) {
      return existing;
    }
    return this.create({ name, color });
  }
}

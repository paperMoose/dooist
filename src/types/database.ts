import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface ProjectTable {
  id: Generated<string>;
  name: string;
  color: string | null;
  order: number;
  is_inbox: number; // SQLite boolean (0/1)
  is_archived: number;
  view_style: string;
  parent_id: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface TaskTable {
  id: Generated<string>;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  content: string;
  description: string | null;
  priority: number; // 1-4 (4 = highest/urgent, 1 = lowest)
  is_completed: number;
  completed_at: string | null;
  due_date: string | null; // YYYY-MM-DD
  due_datetime: string | null; // ISO 8601
  due_string: string | null; // Original string like "every monday"
  due_is_recurring: number;
  due_timezone: string | null;
  order: number;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface LabelTable {
  id: Generated<string>;
  name: string;
  color: string | null;
  order: number;
  is_favorite: number;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface TaskLabelTable {
  task_id: string;
  label_id: string;
}

export interface SectionTable {
  id: Generated<string>;
  project_id: string;
  name: string;
  order: number;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface Database {
  projects: ProjectTable;
  tasks: TaskTable;
  labels: LabelTable;
  task_labels: TaskLabelTable;
  sections: SectionTable;
}

// Utility types for each table
export type Project = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;

export type Task = Selectable<TaskTable>;
export type NewTask = Insertable<TaskTable>;
export type TaskUpdate = Updateable<TaskTable>;

export type Label = Selectable<LabelTable>;
export type NewLabel = Insertable<LabelTable>;
export type LabelUpdate = Updateable<LabelTable>;

export type TaskLabel = Selectable<TaskLabelTable>;
export type NewTaskLabel = Insertable<TaskLabelTable>;

export type Section = Selectable<SectionTable>;
export type NewSection = Insertable<SectionTable>;
export type SectionUpdate = Updateable<SectionTable>;

// Application-level types (with boolean conversion)
export interface TaskWithLabels extends Task {
  labels: Label[];
}

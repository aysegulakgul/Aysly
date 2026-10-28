import type { WorkspaceScope } from '@/modules/workspaces';
import type { Due } from '../domain/due';
import type { Priority, Task, TaskStatus } from '../domain/task';

/** Yazılabilir görev alanları (DATA_MODEL §3.7). */
export type TaskChanges = Partial<{
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  due: Due | null;
  completedAt: Date | null;
  completedBy: string | null;
}>;

export type NewTask = {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  startDate: string | null;
  due: Due | null;
  position: string;
  createdBy: string;
  now: Date;
};

export type TaskListFilter = {
  projectId?: string | undefined;
  statuses: readonly TaskStatus[];
};

/** Görev deposu. Her metot `WorkspaceScope` ister; başka çalışma alanının kaydı hiç görülmez (ARCHITECTURE §6). */
export type TaskRepository = {
  insert(scope: WorkspaceScope, task: NewTask): Promise<Task>;
  /** Çöpteki görevler dahil edilmez (BR-DEL-007). */
  findById(scope: WorkspaceScope, id: string): Promise<Task | null>;
  /** Sürüm eşleşmezse null (BR-TASK-010). */
  update(
    scope: WorkspaceScope,
    id: string,
    expectedVersion: number,
    changes: TaskChanges,
    now: Date,
  ): Promise<Task | null>;
  lastPosition(
    scope: WorkspaceScope,
    projectId: string,
    parentTaskId: string | null,
  ): Promise<string | null>;
  list(scope: WorkspaceScope, filter: TaskListFilter): Promise<Task[]>;
};

/** Görevin bağlanacağı proje bilgisi (projects modülünden). */
export type ProjectRef = { id: string; kind: 'inbox' | 'standard'; archived: boolean };

export type ProjectDirectory = {
  /** Çöpteki proje bulunamadı sayılır. */
  find(scope: WorkspaceScope, projectId: string): Promise<ProjectRef | null>;
  inbox(scope: WorkspaceScope): Promise<ProjectRef>;
};

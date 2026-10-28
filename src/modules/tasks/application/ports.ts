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
  projectId: string;
  parentTaskId: string | null;
  position: string;
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
  /** Projedeki açık, arşivlenmemiş, çöpte olmayan üst düzey görev sayısı. */
  countOpen(scope: WorkspaceScope, projectId: string): Promise<number>;
  /** Görevlerim (BR-INBOX-004): verilen projelerdeki açık, arşivlenmemiş üst düzey görevler. */
  listOpenInProjects(scope: WorkspaceScope, projectIds: readonly string[]): Promise<Task[]>;
  /** Çöpte olmayan alt görevler (arşivliler dahil), sıralı. */
  listSubtasks(scope: WorkspaceScope, parentId: string): Promise<Task[]>;
  subtaskCounts(
    scope: WorkspaceScope,
    parentIds: readonly string[],
  ): Promise<Map<string, { total: number; done: number }>>;
  /** BR-SUB-003: ebeveynle aynı işlemde açık alt görevleri tamamlar. */
  completeOpenSubtasks(
    scope: WorkspaceScope,
    parentId: string,
    now: Date,
    actorId: string,
  ): Promise<void>;
  /** BR-SUB-002: ebeveyn taşınınca alt görevler de aynı projeye geçer. */
  moveSubtasks(
    scope: WorkspaceScope,
    parentId: string,
    projectId: string,
    now: Date,
  ): Promise<void>;
  /** ONBOARDING §4 ilerlemesi: çöpte olmayan görevler üzerinden. */
  progressFlags(
    scope: WorkspaceScope,
    inboxId: string,
  ): Promise<{ hasTask: boolean; hasProjectTask: boolean; hasDatedTask: boolean }>;
  /** Çöpteki görev dahil (BR-DEL-007: durum sorgusu ve geri yükleme için). */
  findAny(scope: WorkspaceScope, id: string): Promise<Task | null>;
  /** BR-DEL-002 / BR-SUB-004: arşivleme ve arşivden çıkarma; sürüm artar. */
  setArchived(
    scope: WorkspaceScope,
    ids: readonly string[],
    archivedAt: Date | null,
    now: Date,
  ): Promise<number>;
  /** Alt görevlerden ebeveynle aynı anda arşivlenenler (birlikte arşivden çıkarılır). */
  subtasksArchivedWith(
    scope: WorkspaceScope,
    parentId: string,
    archivedAt: Date,
  ): Promise<string[]>;
  /** BR-DEL-006: tek eylemde çöpe atılanlar aynı grup kimliğini alır. */
  trash(scope: WorkspaceScope, ids: readonly string[], batchId: string, now: Date): Promise<number>;
  /** BR-DEL-004: geri yükleme; sürüm artar. */
  restore(scope: WorkspaceScope, ids: readonly string[], now: Date): Promise<number>;
  batchMembers(scope: WorkspaceScope, batchId: string): Promise<Task[]>;
  listTrash(scope: WorkspaceScope): Promise<Task[]>;
  /** BR-DEL-005: yalnızca çöpteki kayıtlar kalıcı silinir; grup verilmezse tüm çöp. */
  purge(scope: WorkspaceScope, batchId: string | null): Promise<number>;
};

/** Etiket bağlantıları (tags modülünden). */
export type TagPort = {
  replace(
    scope: WorkspaceScope,
    taskId: string,
    names: readonly string[],
    now: Date,
  ): Promise<void>;
  forTasks(
    scope: WorkspaceScope,
    taskIds: readonly string[],
  ): Promise<Map<string, { id: string; name: string; color: string }[]>>;
  /** Çalışma alanında henüz olmayan adlar ve mevcut etiket sayısı (BR-TAG-003 sınırı için). */
  missing(scope: WorkspaceScope, names: readonly string[]): Promise<string[]>;
  count(scope: WorkspaceScope): Promise<number>;
};

/** Görevin bağlanacağı proje bilgisi (projects modülünden). */
export type ProjectRef = {
  id: string;
  name: string;
  kind: 'inbox' | 'standard';
  archived: boolean;
};

export type ProjectDirectory = {
  /** Çöpteki proje bulunamadı sayılır. */
  find(scope: WorkspaceScope, projectId: string): Promise<ProjectRef | null>;
  inbox(scope: WorkspaceScope): Promise<ProjectRef>;
  /** Arşivlenmemiş ve çöpte olmayan projeler; Inbox ilk sırada. */
  listActive(scope: WorkspaceScope): Promise<ProjectRef[]>;
};

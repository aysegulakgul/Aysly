import type { Progress, Project, ProjectRepository } from '@/modules/projects';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import type { Reminder, ReminderKind, ReminderStatus } from '@/modules/reminders';
import type { Due } from '../domain/due';
import type { Recurrence } from '../domain/recurrence';
import type { Priority, Task, TaskStatus } from '../domain/task';

/** Yazılabilir görev alanları (DATA_MODEL §3.7). */
export type TaskChanges = Partial<{
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  storyPoints: number | null;
  assigneeId: string | null;
  startDate: string | null;
  due: Due | null;
  completedAt: Date | null;
  completedBy: string | null;
  projectId: string;
  parentTaskId: string | null;
  position: string;
  recurrence: Recurrence | null;
}>;

export type NewTask = {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  storyPoints?: number | null | undefined;
  assigneeId?: string | null | undefined;
  startDate: string | null;
  due: Due | null;
  position: string;
  recurrence?: Recurrence | null | undefined;
  createdBy: string;
  now: Date;
};

export type TaskListFilter = {
  projectId?: string | undefined;
  statuses: readonly TaskStatus[];
};

/** Görünüm sorgusunun veritabanında uygulanan kısmı (TaskFilter v1, API_CONTRACTS §6.2). */
export type TaskQuery = {
  projectIds: readonly string[];
  statuses: readonly TaskStatus[];
  priorities?: readonly Priority[] | undefined;
  includeArchived: boolean;
  topLevelOnly: boolean;
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
  /** Görünümler (BR-VIEW-002): verilen projelerdeki görevler, `position` sırasıyla. */
  query(scope: WorkspaceScope, query: TaskQuery): Promise<Task[]>;
  /** BR-PROJ-003: tamamlanmış / (arşivlenmemiş, çöpte olmayan) üst düzey görev sayıları, proje başına. */
  progress(scope: WorkspaceScope, projectIds: readonly string[]): Promise<Map<string, Progress>>;
  /** BR-PROJ-005: projenin çöpte olmayan tüm görevleri (alt görevler ve arşivliler dahil). */
  inProject(
    scope: WorkspaceScope,
    projectId: string,
  ): Promise<{ id: string; parentTaskId: string | null }[]>;
  /** BR-PROJ-002 "hepsini tamamla": projedeki açık, arşivlenmemiş görevler (alt görevler dahil). */
  completeOpenInProject(
    scope: WorkspaceScope,
    projectId: string,
    now: Date,
    actorId: string,
  ): Promise<number>;
  /** BR-DEL-004: kalıcı silinecek projelerde kalan (başka grupla çöpteki) görevler Inbox'a bağlanır. */
  reassignTrashed(
    scope: WorkspaceScope,
    projectIds: readonly string[],
    inboxId: string,
  ): Promise<void>;
  /** Arşiv sayfası (BR-DEL-001): tek başına arşivlenmiş, çöpte olmayan görevler. */
  listArchived(scope: WorkspaceScope): Promise<Task[]>;
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
  /** BR-REC-007: bu görevin tamamlanmasıyla üretilmiş, çöpte olmayan sonraki örnek. */
  findGeneratedFrom(scope: WorkspaceScope, id: string): Promise<Task | null>;
  /** BR-REC-007: hiç değiştirilmemiş sonraki örnek kalıcı silinir (alt görevler ve bağlantılar birlikte). */
  hardDelete(scope: WorkspaceScope, id: string): Promise<void>;
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
  /** Çalışma alanında var olan etiket kimlikleri (silinmiş etikete referans tespiti, BR-VIEW-001). */
  existing(scope: WorkspaceScope, tagIds: readonly string[]): Promise<Set<string>>;
  /** TaskFilter `tagId` + `tagMode`: etiketlere uyan görev kimlikleri. */
  taskIdsWithTags(
    scope: WorkspaceScope,
    tagIds: readonly string[],
    mode: 'any' | 'all',
  ): Promise<Set<string>>;
};

/** Görevin bağlanacağı proje bilgisi (projects modülünden). */
export type ProjectRef = {
  id: string;
  name: string;
  kind: 'inbox' | 'standard';
  color?: string | undefined;
  archived: boolean;
};

export type ProjectDirectory = {
  /** Çöpteki proje bulunamadı sayılır. */
  find(scope: WorkspaceScope, projectId: string): Promise<ProjectRef | null>;
  inbox(scope: WorkspaceScope): Promise<ProjectRef>;
  /** Arşivlenmemiş ve çöpte olmayan projeler; Inbox ilk sırada. */
  listActive(scope: WorkspaceScope): Promise<ProjectRef[]>;
  /** Proje yönetimi (Faz 5): tam proje kayıtları; çöpteki projeler yalnızca `findAny` ve `listTrashed` ile. */
  repo: ProjectRepository;
  findAny(scope: WorkspaceScope, id: string): Promise<Project | null>;
  trash(scope: WorkspaceScope, id: string, batchId: string, now: Date): Promise<boolean>;
  restore(scope: WorkspaceScope, ids: readonly string[], now: Date): Promise<number>;
  listTrashed(scope: WorkspaceScope, batchId?: string): Promise<Project[]>;
  purge(scope: WorkspaceScope, batchId: string | null): Promise<number>;
};

/** Hatırlatıcılar (reminders modülünden; BR-REM-001..005). */
export type ReminderPort = {
  forTasks(scope: WorkspaceScope, taskIds: readonly string[]): Promise<Map<string, Reminder[]>>;
  insert(
    scope: WorkspaceScope,
    r: {
      id: string;
      taskId: string;
      kind: ReminderKind;
      offsetMinutes: number | null;
      remindAt: Date;
      status: ReminderStatus;
      now: Date;
    },
  ): Promise<Reminder>;
  remove(scope: WorkspaceScope, taskId: string, id: string): Promise<boolean>;
  retime(
    scope: WorkspaceScope,
    id: string,
    remindAt: Date,
    status: ReminderStatus,
    now: Date,
  ): Promise<void>;
  removeRelative(scope: WorkspaceScope, taskId: string): Promise<void>;
  cancel(scope: WorkspaceScope, taskIds: readonly string[], now: Date): Promise<void>;
  reactivate(scope: WorkspaceScope, taskIds: readonly string[], now: Date): Promise<void>;
};

/** Kullanıcının takvim tercihleri (preferences modülünden): "bugün", tüm gün hatırlatıcı saati. */
export type CalendarPort = {
  of(userId: string): Promise<{ timezone: string; allDayReminderTime: string; weekStart: number }>;
};

/** Görev kullanım senaryolarının bağımlılıkları (CODING_STANDARDS §2.1: elle bağlanır). */
/** D-097: atanabilecek kişiler (contacts modülü). */
export type ContactPort = {
  refs(
    scope: WorkspaceScope,
    ids: readonly string[],
  ): Promise<Map<string, { id: string; name: string; color: string }>>;
};

export type TaskDeps = {
  contacts: ContactPort;
  tasks: TaskRepository;
  projects: ProjectDirectory;
  tags: TagPort;
  reminders: ReminderPort;
  calendar: CalendarPort;
  clock: Clock;
  newId: () => string;
};

/** projects modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export { insertInbox } from './infrastructure/inbox-writer';
export { insertProjects } from './infrastructure/project-writer';
export {
  findInboxRef,
  findProjectRef,
  listActiveProjects,
  type ProjectRef,
} from './infrastructure/project-reader';
export {
  createDrizzleProjectRepository,
  findAnyProject,
  listExpiredTrashedProjects,
  listTrashedProjects,
  purgeExpiredProjects,
  purgeProjects,
  restoreProjects,
  trashProject,
} from './infrastructure/drizzle-project-repository';
export {
  findActiveProjects,
  patchProject,
  postProject,
  postProjectArchive,
  postProjectReorder,
  postProjectUnarchive,
  projectDeps,
  toProjectJson,
} from './http/project-handlers';
export { getProject, listProjects, type ProjectRepository } from './application/projects';
export {
  PROJECT_COLORS,
  PROJECT_STATUSES,
  progressPercent,
  type Progress,
  type Project,
  type ProjectColor,
  type ProjectStatus,
} from './domain/project';

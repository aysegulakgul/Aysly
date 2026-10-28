/** projects modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export { insertInbox } from './infrastructure/inbox-writer';
export { insertProjects } from './infrastructure/project-writer';
export {
  findInboxRef,
  findProjectRef,
  listActiveProjects,
  type ProjectRef,
} from './infrastructure/project-reader';
export { findActiveProjects, getProjects } from './http/project-handlers';

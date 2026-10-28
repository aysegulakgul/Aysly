/** tasks modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  getOneTask,
  getTasks,
  patchTask,
  postComplete,
  postReopen,
  postTask,
} from './http/task-handlers';

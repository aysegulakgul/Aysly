/** goals modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  deleteOneGoal,
  findGoal,
  findGoals,
  getGoals,
  getOneGoal,
  goalDeps,
  patchGoal,
  postGoal,
  postGoalArchive,
  postGoalUnarchive,
  putGoalLinks,
  type GoalView,
} from './http/goal-handlers';
export { goalsLinkedToTask, purgeExpiredGoals } from './infrastructure/drizzle-goal-repository';
export type { Goal, GoalStatus } from './domain/goal';

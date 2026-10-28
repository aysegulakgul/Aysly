/** tags modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  TAGS_PER_RECORD,
  TAGS_PER_WORKSPACE,
  normalizeTagName,
  prepareTagNames,
} from './domain/tag';
export {
  countTags,
  findTagsForTasks,
  listTags,
  missingTagNames,
  replaceTaskTags,
  type TagView,
} from './infrastructure/tag-store';
export { getTags } from './http/tag-handlers';

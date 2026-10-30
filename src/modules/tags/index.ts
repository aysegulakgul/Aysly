/** tags modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  TAGS_PER_RECORD,
  TAGS_PER_WORKSPACE,
  TAG_COLORS,
  normalizeTagName,
  prepareTagNames,
  type TagColor,
} from './domain/tag';
export {
  countTags,
  existingTagIds,
  findTagsForNotes,
  findTagsForTasks,
  listTags,
  missingTagNames,
  noteIdsWithTag,
  replaceNoteTags,
  replaceTaskTags,
  taskIdsWithTags,
  type TagView,
} from './infrastructure/tag-store';
export { deleteOneTag, findManagedTags, getTags, patchTag } from './http/tag-handlers';
export type { ManagedTag } from './application/tags';

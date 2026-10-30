/** lifecycle modülünün dışa açık yüzü (ARCHITECTURE §4.1): arşiv ve çöp orkestrasyonu. */
export {
  deleteTrash,
  findArchiveContents,
  findTrashGroups,
  getArchive,
  getTrash,
  postRestore,
  type ArchiveContentsView,
  type TrashGroupsView,
} from './http/lifecycle-handlers';

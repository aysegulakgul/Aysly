/** notes modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  deleteOneNote,
  findNote,
  findNotes,
  getNotes,
  getOneNote,
  noteDeps,
  patchNote,
  postNote,
  postNoteArchive,
  postNoteUnarchive,
  putNoteLinks,
  type NoteView,
} from './http/note-handlers';
export { purgeExpiredNotes } from './infrastructure/drizzle-note-repository';
export { displayTitle, type Note } from './domain/note';

/** contacts modülünün dışa açık yüzü (ARCHITECTURE §4.2): görevlere atanabilen kişiler (D-097). */
export {
  deleteOneContact,
  findContacts,
  getContacts,
  patchContact,
  postContact,
  type ContactView,
} from './http/contact-handlers';
export { findContactRefs } from './infrastructure/contact-store';
export { CONTACT_COLORS, initials, type ContactColor } from './domain/contact';

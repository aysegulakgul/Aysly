/** data-portability modülünün dışa açık yüzü (ARCHITECTURE §4.2): JSON dışa aktarma (D-046, D-059). */
export { postExport } from './http/export-handlers';
export { EXPORT_FORMAT, EXPORT_VERSION, type ExportDocument } from './application/export';

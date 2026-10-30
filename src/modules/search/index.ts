/** search modülünün dışa açık yüzü (ARCHITECTURE §4.2): çapraz modül okuma modeli. */
export { getSearch } from './http/search-handlers';
export { SEARCH_TYPES, toPrefixQuery, type SearchHit, type SearchType } from './application/search';
export { createSqlSearchIndex } from './infrastructure/sql-search-index';

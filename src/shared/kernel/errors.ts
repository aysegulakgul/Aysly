/** Domain ve application katmanlarının beklenen hata türleri (ARCHITECTURE §8, API_CONTRACTS §2.4). */
export type FieldIssue = { field: string; reason: string };

export type DomainError =
  | { kind: 'validation'; issues: FieldIssue[] }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'version_conflict'; current?: unknown }
  | { kind: 'business_rule'; rule: string; details?: FieldIssue[] };

export const validationError = (issues: FieldIssue[]): DomainError => ({
  kind: 'validation',
  issues,
});
export const notFound = (): DomainError => ({ kind: 'not_found' });
export const forbidden = (): DomainError => ({ kind: 'forbidden' });
export const businessRule = (rule: string, details?: FieldIssue[]): DomainError =>
  details ? { kind: 'business_rule', rule, details } : { kind: 'business_rule', rule };

import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../domain/permissions';
import { createScope } from '../domain/scope';
import { authorize } from './authorize';

/** ROLES_AND_PERMISSIONS §6.1: kişisel alanın sahibi tüm içerik izinlerine sahiptir (tablo tabanlı). */
describe('BR-PERM-001: izin matrisi (MVP)', () => {
  it.each(PERMISSIONS)('owner → %s izinli', (permission) => {
    expect(authorize(createScope('u', 'w', 'owner'), permission)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('MVP’de yalnızca owner rolü tanımlı', () => {
    expect(Object.keys(ROLE_PERMISSIONS)).toEqual(['owner']);
  });
});

import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/shared/kernel/clock';
import {
  changePassword,
  listSessions,
  requestEmailChange,
  revokeSession,
  updateProfile,
  type AccountStore,
  type Credentials,
} from './account';

const actor = { userId: 'u1', sessionId: 's1' };
const clock = fixedClock(new Date('2026-10-28T09:00:00Z'));

function fakeStore(user = { email: 'elif@ornek.com', emailVerified: true }) {
  const names: string[] = [];
  const store: AccountStore = {
    findUser: async () => user,
    updateName: async (_id, name) => {
      names.push(name);
    },
    listActiveSessions: async () => [
      { id: 's2', createdAt: new Date(1), lastSeenAt: new Date(5), userAgent: null },
      { id: 's1', createdAt: new Date(1), lastSeenAt: new Date(2), userAgent: null },
      { id: 's3', createdAt: new Date(1), lastSeenAt: new Date(9), userAgent: null },
    ],
    deleteSession: async (userId, id) => userId === 'u1' && id === 's2',
    deleteOtherSessions: async () => 0,
  };
  return { store, names };
}

function fakeCredentials(password = 'dogru sifre 2026') {
  const calls: string[] = [];
  const credentials: Credentials = {
    verifyPassword: async (p) => p === password,
    changePassword: async (current) => (current === password ? 'changed' : 'incorrect'),
    requestEmailChange: async (email) => {
      calls.push(email);
    },
  };
  return { credentials, calls };
}

describe('updateProfile', () => {
  it('adı kırpıp kaydeder; boş ad reddedilir', async () => {
    const { store, names } = fakeStore();
    expect(await updateProfile({ store, clock }, actor, { name: '  Elif   Yılmaz ' })).toEqual({
      ok: true,
      value: { name: 'Elif Yılmaz' },
    });
    expect(await updateProfile({ store, clock }, actor, { name: '   ' })).toMatchObject({
      ok: false,
      error: { kind: 'validation', issues: [{ field: 'name', reason: 'required' }] },
    });
    expect(names).toEqual(['Elif Yılmaz']);
  });
});

describe('changePassword', () => {
  it('BR-ACC-002: yeni şifre politikaya uymalı; mevcut şifre yanlışsa reddedilir', async () => {
    const { credentials } = fakeCredentials();
    expect(
      await changePassword(credentials, { currentPassword: 'x', newPassword: 'kisa' }),
    ).toMatchObject({ error: { issues: [{ field: 'newPassword', reason: 'too_short' }] } });
    expect(
      await changePassword(credentials, { currentPassword: 'x', newPassword: 'password123' }),
    ).toMatchObject({ error: { issues: [{ field: 'newPassword', reason: 'too_common' }] } });
    expect(
      await changePassword(credentials, {
        currentPassword: 'yanlis',
        newPassword: 'yeni ve uzun sifre',
      }),
    ).toMatchObject({ error: { issues: [{ field: 'currentPassword', reason: 'incorrect' }] } });
    expect(
      await changePassword(credentials, {
        currentPassword: 'dogru sifre 2026',
        newPassword: 'yeni ve uzun sifre',
      }),
    ).toEqual({ ok: true, value: undefined });
  });
});

describe('requestEmailChange', () => {
  const command = { newEmail: 'Yeni@Ornek.com', currentPassword: 'dogru sifre 2026' };

  it('BR-ACC-004: doğrulanmamış hesap e-posta değiştiremez', async () => {
    const { store } = fakeStore({ email: 'elif@ornek.com', emailVerified: false });
    const { credentials, calls } = fakeCredentials();
    expect(await requestEmailChange({ store, clock }, credentials, actor, command)).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-ACC-004' },
    });
    expect(calls).toEqual([]);
  });

  it('BR-ACC-004: mevcut şifre yanlışsa, adres aynıysa veya geçersizse gönderilmez', async () => {
    const { store } = fakeStore();
    const { credentials, calls } = fakeCredentials();
    const deps = { store, clock };
    expect(
      await requestEmailChange(deps, credentials, actor, { ...command, currentPassword: 'x' }),
    ).toMatchObject({ error: { issues: [{ field: 'currentPassword', reason: 'incorrect' }] } });
    expect(
      await requestEmailChange(deps, credentials, actor, {
        ...command,
        newEmail: 'ELIF@ornek.com',
      }),
    ).toMatchObject({ error: { issues: [{ field: 'newEmail', reason: 'same' }] } });
    expect(
      await requestEmailChange(deps, credentials, actor, { ...command, newEmail: 'gecersiz' }),
    ).toMatchObject({ error: { issues: [{ field: 'newEmail', reason: 'invalid' }] } });
    expect(calls).toEqual([]);
  });

  it('BR-ACC-004: doğrulanmış hesap, doğru şifreyle normalize edilmiş yeni adrese doğrulama ister', async () => {
    const { store } = fakeStore();
    const { credentials, calls } = fakeCredentials();
    expect(await requestEmailChange({ store, clock }, credentials, actor, command)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual(['yeni@ornek.com']);
  });
});

describe('oturumlar', () => {
  it('BR-ACC-006: bu cihaz önce, diğerleri son etkinliğe göre sıralanır', async () => {
    const { store } = fakeStore();
    const sessions = await listSessions({ store, clock }, actor);
    expect(sessions.map((s) => [s.id, s.current])).toEqual([
      ['s1', true],
      ['s3', false],
      ['s2', false],
    ]);
  });

  it('BR-PERM-001: aktörün olmayan oturum bulunamadı döner', async () => {
    const { store } = fakeStore();
    expect(await revokeSession({ store, clock }, actor, 's2')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await revokeSession({ store, clock }, actor, 'baskasinin')).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { badge } from './badge';

describe('BR-INBOX-003: Inbox rozeti', () => {
  it('sıfırda gösterilmez, 99’dan fazlası 99+', () => {
    expect(badge(0)).toBeUndefined();
    expect(badge(3)).toBe('3');
    expect(badge(99)).toBe('99');
    expect(badge(100)).toBe('99+');
  });
});

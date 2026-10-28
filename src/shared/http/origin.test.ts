import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './origin';

const base = 'http://localhost:3000';

describe('Origin kontrolü (SECURITY §6)', () => {
  it('aynı köken kabul edilir', () => {
    expect(isSameOrigin(new Headers({ origin: 'http://localhost:3000' }), base)).toBe(true);
  });

  it('farklı köken reddedilir', () => {
    expect(isSameOrigin(new Headers({ origin: 'https://evil.example' }), base)).toBe(false);
    expect(isSameOrigin(new Headers({ origin: 'http://localhost:3001' }), base)).toBe(false);
  });

  it('Origin yoksa Referer kökenine bakılır', () => {
    expect(isSameOrigin(new Headers({ referer: 'http://localhost:3000/sign-up' }), base)).toBe(
      true,
    );
    expect(isSameOrigin(new Headers({ referer: 'https://evil.example/x' }), base)).toBe(false);
  });

  it('ikisi de yoksa reddedilir', () => {
    expect(isSameOrigin(new Headers(), base)).toBe(false);
  });
});

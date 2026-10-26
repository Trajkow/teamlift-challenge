import {describe, expect, it} from 'vitest';
import {OAUTH_STATE_TTL_MS, OAuthStateStore} from './oauth-state.store.js';

describe('OAuthStateStore', () => {
  it('accepts an issued state once', () => {
    const store = new OAuthStateStore();
    const state = store.issue();
    expect(store.consume(state)).toBe(true);
    expect(store.consume(state)).toBe(false);
  });

  it('rejects unknown and empty states', () => {
    const store = new OAuthStateStore();
    store.issue();
    expect(store.consume('nope')).toBe(false);
    expect(store.consume('')).toBe(false);
    expect(store.consume(undefined)).toBe(false);
  });

  it('rejects an expired state after 10 minutes', () => {
    let now = 1_000;
    const store = new OAuthStateStore(() => now);
    const fresh = store.issue();
    const stale = store.issue();
    now += OAUTH_STATE_TTL_MS - 1;
    expect(store.consume(fresh)).toBe(true);
    now += 2;
    expect(store.consume(stale)).toBe(false);
  });

  it('issues unpredictable values', () => {
    const store = new OAuthStateStore();
    expect(store.issue()).not.toBe(store.issue());
  });
});

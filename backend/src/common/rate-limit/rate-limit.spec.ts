import {describe, expect, it} from 'vitest';
import {trustProxySetting} from './rate-limit.js';

describe('trustProxySetting', () => {
  it('is off by default', () => {
    expect(trustProxySetting(undefined)).toBe(false);
    expect(trustProxySetting('')).toBe(false);
    expect(trustProxySetting('false')).toBe(false);
    expect(trustProxySetting('0')).toBe(false);
  });
  it('parses true, hop counts and address lists', () => {
    expect(trustProxySetting('true')).toBe(true);
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});

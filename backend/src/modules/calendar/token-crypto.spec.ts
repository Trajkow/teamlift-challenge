import {randomBytes} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {decrypt, encrypt, parseTokenKey} from './token-crypto.js';

const key = randomBytes(32);

describe('token-crypto', () => {
  it('round trips and never contains the plaintext', () => {
    const payload = encrypt('1//refresh-token-value', key);
    expect(payload).not.toContain('refresh-token-value');
    expect(payload.split(':')).toHaveLength(3);
    expect(decrypt(payload, key)).toBe('1//refresh-token-value');
  });

  it('uses a fresh IV each time', () => {
    expect(encrypt('same', key)).not.toBe(encrypt('same', key));
  });

  it('fails on tampered ciphertext, tag, a wrong key or a malformed value', () => {
    const [iv, tag, data] = encrypt('secret', key).split(':') as [string, string, string];
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, 'base64');
      buf[0] = buf[0]! ^ 1;
      return buf.toString('base64');
    };
    expect(() => decrypt([iv, tag, flip(data)].join(':'), key)).toThrow();
    expect(() => decrypt([iv, flip(tag), data].join(':'), key)).toThrow();
    expect(() => decrypt([iv, tag, data].join(':'), randomBytes(32))).toThrow();
    expect(() => decrypt('nonsense', key)).toThrow();
  });

  it('parses a 32 byte base64 key only', () => {
    expect(parseTokenKey(key.toString('base64'))).toEqual(key);
    expect(parseTokenKey(randomBytes(16).toString('base64'))).toBeNull();
    expect(parseTokenKey('')).toBeNull();
    expect(parseTokenKey(undefined)).toBeNull();
  });
});

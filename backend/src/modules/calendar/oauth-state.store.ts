import {randomBytes} from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 10 * 60_000;
const MAX_PENDING = 1_000;

/** In-memory CSRF `state` values for the OAuth round trip: random, single use, 10 minute TTL (one backend instance). */
export class OAuthStateStore {
  private readonly pending = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  issue(): string {
    this.sweep();
    if (this.pending.size >= MAX_PENDING) {
      // Drop the oldest entry so a flood of connect calls cannot grow memory without bound.
      const oldest = this.pending.keys().next().value;
      if (oldest !== undefined) this.pending.delete(oldest);
    }
    const state = randomBytes(32).toString('base64url');
    this.pending.set(state, this.now() + OAUTH_STATE_TTL_MS);
    return state;
  }

  /** True once per issued, unexpired state. */
  consume(state: string | undefined): boolean {
    if (!state) return false;
    const expiresAt = this.pending.get(state);
    this.pending.delete(state);
    return expiresAt !== undefined && expiresAt > this.now();
  }

  private sweep() {
    const now = this.now();
    for (const [state, expiresAt] of this.pending) if (expiresAt <= now) this.pending.delete(state);
  }
}

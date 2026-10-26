import {type ExecutionContext, Injectable} from '@nestjs/common';
import {Throttle, ThrottlerGuard, type ThrottlerModuleOptions} from '@nestjs/throttler';
import {AppError} from '../errors/app-error.js';

/**
 * Rate limiting (@nestjs/throttler, in-memory store, single instance). Counters are per route and client IP.
 *
 * Every limit is per minute and read from the environment on each request, so tests and operators can change it:
 *   RATE_LIMIT_ENABLED (default true), RATE_LIMIT_DEFAULT_PER_MIN (120), RATE_LIMIT_BOOKING_PER_MIN (10),
 *   RATE_LIMIT_CONFIRMATION_PER_MIN (10), RATE_LIMIT_HOST_WRITE_PER_MIN (30).
 */

const WINDOW_MS = 60_000;
const RATE_LIMITED_MESSAGE = 'Too many attempts, try again in a minute';

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const rateLimitEnabled = (): boolean => process.env.RATE_LIMIT_ENABLED !== 'false';

export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [{name: 'default', ttl: WINDOW_MS, limit: () => envInt('RATE_LIMIT_DEFAULT_PER_MIN', 120)}],
  skipIf: () => !rateLimitEnabled(),
};

const perMinute = (envName: string, fallback: number) => ({
  limit: () => envInt(envName, fallback),
  ttl: WINDOW_MS,
});

/** Per-route overrides of the default limit. */
export const RateLimit = {
  /** Creating a booking: 10 per minute per client IP. */
  booking: () => Throttle({default: perMinute('RATE_LIMIT_BOOKING_PER_MIN', 10)}),
  /** Confirmation message: 60 per minute per client IP, because the success screen polls it while the AI writes. */
  confirmation: () => Throttle({default: perMinute('RATE_LIMIT_CONFIRMATION_PER_MIN', 60)}),
  /** Host writes (create or delete slots, cancel bookings): 30 per minute per client IP. */
  hostWrite: () => Throttle({default: perMinute('RATE_LIMIT_HOST_WRITE_PER_MIN', 30)}),
};

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http';
  }

  protected async throwThrottlingException(): Promise<void> {
    // Retry-After was already set by the base guard.
    throw new AppError(429, 'RATE_LIMITED', RATE_LIMITED_MESSAGE);
  }
}

/** Express `trust proxy` from `TRUST_PROXY`: unset/false = off, `true`, a hop count, or an address/CIDR list. */
export function trustProxySetting(raw = process.env.TRUST_PROXY): boolean | number | string {
  const v = raw?.trim();
  if (!v || v === 'false' || v === '0') return false;
  if (v === 'true') return true;
  return /^\d+$/.test(v) ? Number(v) : v;
}

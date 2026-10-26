import {type CanActivate, type ExecutionContext, Injectable} from '@nestjs/common';
import {timingSafeEqual} from 'node:crypto';
import {AppError} from '../errors/app-error.js';

/** When `HOST_KEY` is set, requires a matching `X-Host-Key` header. Without it, the host routes are open. */
@Injectable()
export class HostKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.HOST_KEY;
    if (!expected) return true;
    const header = context.switchToHttp().getRequest().headers['x-host-key'];
    const given = Buffer.from(typeof header === 'string' ? header : '');
    const want = Buffer.from(expected);
    // Hash-free comparison needs equal lengths; a length mismatch is rejected up front.
    if (given.length === want.length && timingSafeEqual(given, want)) return true;
    throw new AppError(401, 'HOST_KEY_REQUIRED', 'A valid host key is required');
  }
}

/** For the OAuth connect route only: a full-page navigation can't send `X-Host-Key`, so it also reads `?hostKey=`. */
@Injectable()
export class HostKeyQueryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.HOST_KEY;
    if (!expected) return true;
    const query = context.switchToHttp().getRequest().query?.hostKey;
    const given = Buffer.from(typeof query === 'string' ? query : '');
    const want = Buffer.from(expected);
    if (given.length === want.length && timingSafeEqual(given, want)) return true;
    throw new AppError(401, 'HOST_KEY_REQUIRED', 'A valid host key is required');
  }
}

import {ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger} from '@nestjs/common';
import {AppError} from './app-error.js';
import {collectCodes, isTransientTxError} from './error-codes.js';

export type ErrorBody = {error: string; message: string; [k: string]: unknown};

const PG_CODES: Record<string, {status: number; error: string; message?: string}> = {
  '23P01': {status: 409, error: 'SLOT_OVERLAP', message: 'This slot overlaps one you already published'},
  '23505': {status: 409, error: 'CONFLICT'},
  '23514': {status: 422, error: 'INVALID_STATE'},
  '23503': {status: 422, error: 'INVALID_REFERENCE'},
};

const PRISMA_CODES: Record<string, {status: number; error: string}> = {
  P2002: {status: 409, error: 'CONFLICT'},
  P2025: {status: 404, error: 'NOT_FOUND'},
};

/** Errors thrown by Express' body parser (http-errors): `type` says what went wrong, `status` is a 4xx. */
function mapBodyParserError(exception: unknown): {status: number; body: ErrorBody} | null {
  if (!exception || typeof exception !== 'object') return null;
  const {type, status} = exception as {type?: unknown; status?: unknown};
  if (typeof type !== 'string' || typeof status !== 'number' || status < 400 || status > 499) return null;
  if (type === 'entity.too.large') {
    return {status: 413, body: {error: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large'}};
  }
  if (type === 'entity.parse.failed') {
    return {status: 400, body: {error: 'INVALID_JSON', message: 'The request body is not valid JSON'}};
  }
  if (type.startsWith('encoding.') || type.startsWith('charset.')) {
    return {status: 415, body: {error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported content encoding'}};
  }
  return {status, body: {error: `HTTP_${status}`, message: 'Bad request'}};
}

export function mapError(exception: unknown): {status: number; body: ErrorBody} | null {
  if (exception instanceof AppError) {
    return {status: exception.status, body: {error: exception.code, message: exception.message}};
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    if (status === 429) {
      return {status, body: {error: 'RATE_LIMITED', message: 'Too many attempts, try again in a minute'}};
    }
    if (res && typeof res === 'object' && typeof (res as any).error === 'string' && !('statusCode' in res)) {
      return {status, body: {message: exception.message, ...(res as object)} as ErrorBody};
    }
    return {status, body: {error: `HTTP_${status}`, message: exception.message}};
  }
  const bodyParserError = mapBodyParserError(exception);
  if (bodyParserError) return bodyParserError;
  // The database aborted the transaction (deadlock or serialization failure); the caller can simply try again.
  if (isTransientTxError(exception)) {
    return {
      status: 409,
      body: {error: 'CONCURRENT_MODIFICATION', message: 'The request conflicted with a concurrent change; please retry'},
    };
  }
  const codes = collectCodes(exception);
  for (const code of codes) {
    const hit = PG_CODES[code];
    if (hit) return {status: hit.status, body: {error: hit.error, message: hit.message ?? hit.error}};
  }
  for (const code of codes) {
    const hit = PRISMA_CODES[code];
    if (hit) return {status: hit.status, body: {error: hit.error, message: hit.error}};
  }
  return null;
}

@Catch()
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const mapped = mapError(exception);
    if (mapped) {
      res.status(mapped.status).json(mapped.body);
      return;
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    res.status(500).json({error: 'INTERNAL', message: 'Internal server error'});
  }
}

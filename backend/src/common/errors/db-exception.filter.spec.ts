import {BadRequestException, NotFoundException} from '@nestjs/common';
import {AppError} from './app-error.js';
import {mapError} from './db-exception.filter.js';

// Prisma's driver adapter wraps pg errors; mimic the shapes we may see.
const wrapped = (code: string) => Object.assign(new Error('wrapped'), {cause: {originalCode: code}});
const viaMeta = (code: string) =>
  Object.assign(new Error('wrapped'), {meta: {driverAdapterError: {cause: {originalCode: code}}}});
const prisma = (code: string) => Object.assign(new Error('prisma'), {code});

describe('mapError', () => {
  it('maps AppError', () => {
    expect(mapError(new AppError(409, 'SLOT_TAKEN', 'taken'))).toEqual({
      status: 409,
      body: {error: 'SLOT_TAKEN', message: 'taken'},
    });
  });

  it('maps plain HttpException to HTTP_<status>', () => {
    expect(mapError(new NotFoundException('nope'))).toMatchObject({status: 404, body: {error: 'HTTP_404'}});
  });

  it('maps body-parser errors (413 / bad JSON) instead of 500', () => {
    const err = (type: string, status: number) => Object.assign(new Error('x'), {type, status});
    expect(mapError(err('entity.too.large', 413))).toMatchObject({status: 413, body: {error: 'PAYLOAD_TOO_LARGE'}});
    expect(mapError(err('entity.parse.failed', 400))).toMatchObject({status: 400, body: {error: 'INVALID_JSON'}});
    expect(mapError(err('encoding.unsupported', 415))).toMatchObject({status: 415});
  });

  it('keeps already-shaped HttpException bodies', () => {
    const e = new BadRequestException({error: 'VALIDATION_FAILED', message: 'bad', issues: []});
    expect(mapError(e)).toMatchObject({status: 400, body: {error: 'VALIDATION_FAILED', issues: []}});
  });

  it.each([
    ['23P01', 409, 'SLOT_OVERLAP'],
    ['23505', 409, 'CONFLICT'],
    ['23514', 422, 'INVALID_STATE'],
    ['23503', 422, 'INVALID_REFERENCE'],
  ])('maps pg %s', (code, status, error) => {
    for (const err of [wrapped(code), viaMeta(code), Object.assign(new Error('raw'), {code})]) {
      expect(mapError(err)).toMatchObject({status, body: {error}});
    }
  });

  it('gives SLOT_OVERLAP a human message', () => {
    expect(mapError(wrapped('23P01'))?.body.message).toBe('This slot overlaps one you already published');
  });

  it('maps Prisma P2002 and P2025', () => {
    expect(mapError(prisma('P2002'))).toMatchObject({status: 409, body: {error: 'CONFLICT'}});
    expect(mapError(prisma('P2025'))).toMatchObject({status: 404, body: {error: 'NOT_FOUND'}});
  });

  it.each(['40P01', '40001', 'P2034'])('maps the transient transaction error %s to 409 CONCURRENT_MODIFICATION', (code) => {
    for (const err of [wrapped(code), viaMeta(code), prisma(code)]) {
      expect(mapError(err)).toMatchObject({status: 409, body: {error: 'CONCURRENT_MODIFICATION'}});
    }
  });

  it('returns null for unknown errors (filter turns them into 500 INTERNAL)', () => {
    expect(mapError(new Error('boom'))).toBeNull();
    expect(mapError(prisma('P9999'))).toBeNull();
  });
});

import type {INestApplication} from '@nestjs/common';
import type {NestExpressApplication} from '@nestjs/platform-express';
import {trustProxySetting} from './common/rate-limit/rate-limit.js';

export const APP_BODY_LIMIT = '100kb';

export function frontendOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Shared by main.ts and the e2e harness so tests exercise the real prefix, body limit and CORS setup. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  // Behind a reverse proxy (Render) set TRUST_PROXY=1 so req.ip comes from X-Forwarded-For; off by default.
  express.set('trust proxy', trustProxySetting());
  express.disable('x-powered-by');
  express.useBodyParser('json', {limit: APP_BODY_LIMIT});
  app.setGlobalPrefix('api');
  // The browser goes through the Next proxy, so CORS only matters for dev tools.
  app.enableCors({origin: frontendOrigins()});
}

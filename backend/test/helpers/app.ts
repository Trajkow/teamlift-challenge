import type {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import supertest from 'supertest';
import {AppModule} from '../../src/app.module.js';
import {configureApp} from '../../src/configure-app.js';

export type TestApp = {
  app: INestApplication;
  /** The underlying HTTP server: pass to supertest . */
  server: ReturnType<INestApplication['getHttpServer']>;
  http: ReturnType<typeof supertest>;
};

/** Builds the Nest app exactly like main.ts (prefix, body limit, CORS), listening on an ephemeral port. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile();
  const app = moduleRef.createNestApplication({bodyParser: false});
  configureApp(app);
  // Listen once on an ephemeral port: supertest otherwise calls server.listen(0) per request and
  // leaks listeners on the unbound server (MaxListenersExceededWarning).
  await app.listen(0);
  const server = app.getHttpServer();
  return {app, server, http: supertest(server)};
}

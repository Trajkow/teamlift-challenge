import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import pg from 'pg';
import {loadTestEnv} from './helpers/load-env.js';

/** Recreates the `slot_test` database from the migrations before the e2e run. */
export default async function setup() {
  loadTestEnv();
  const target = new URL(process.env.MIGRATE_DATABASE_URL!);
  const dbName = target.pathname.slice(1);
  if (dbName !== 'slot_test') {
    throw new Error(`Refusing to reset "${dbName}": e2e tests only run against slot_test`);
  }

  const admin = new pg.Client({connectionString: process.env.TEST_ADMIN_DATABASE_URL});
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await admin.end();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'prisma.config.ts'], {
    cwd: resolve(import.meta.dirname, '..'),
    env: process.env,
    stdio: 'pipe',
  });
}

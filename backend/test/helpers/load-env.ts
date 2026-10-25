import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

/** Loads .env.test.local (overrides) then .env.test. Already-set variables win. */
export function loadTestEnv() {
  for (const file of ['.env.test.local', '.env.test']) {
    const path = resolve(import.meta.dirname, '../..', file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Neon needs the direct (non-pooled) URL for migrations; locally both are the same.
    url: process.env['MIGRATE_DATABASE_URL'] ?? process.env['DATABASE_URL'],
  },
});

import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DATABASE_TYPE: z.enum(['sqlite', 'postgres']).default('sqlite'),
  SQLITE_PATH: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const env = envSchema.parse(process.env);

function getSqlitePath(): string {
  if (env.SQLITE_PATH) {
    return env.SQLITE_PATH;
  }
  const projectRoot = path.resolve(__dirname, '../..');
  return path.join(projectRoot, 'data', 'todoist.db');
}

export const config = {
  database: {
    type: env.DATABASE_TYPE,
    url: env.DATABASE_URL,
    sqlitePath: getSqlitePath(),
  },
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export type Config = typeof config;

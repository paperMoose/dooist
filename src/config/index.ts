import { z } from 'zod';
import path from 'node:path';
import os from 'node:os';

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DATABASE_TYPE: z.enum(['sqlite', 'postgres']).default('sqlite'),
  DOOIST_DB_PATH: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const env = envSchema.parse(process.env);

function getSqlitePath(): string {
  if (env.DOOIST_DB_PATH) {
    return env.DOOIST_DB_PATH;
  }
  // Default to ~/.dooist/dooist.db for global accessibility
  return path.join(os.homedir(), '.dooist', 'dooist.db');
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

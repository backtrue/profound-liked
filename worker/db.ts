import { drizzle } from 'drizzle-orm/d1';
import type { Env } from './index';

// Import all schema tables
import * as schema from '../drizzle/schema';

// Create database connection for Workers with D1
export function createDatabase(env: Env) {
    return drizzle(env.DB, { schema });
}

// Export type for use in other files
export type Database = ReturnType<typeof createDatabase>;

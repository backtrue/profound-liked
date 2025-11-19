import { getDb } from './server/db.ts';
import { apiKeys } from './drizzle/schema.ts';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

const keys = await db.select().from(apiKeys);
console.log('API Keys in database:');
console.log(JSON.stringify(keys, null, 2));

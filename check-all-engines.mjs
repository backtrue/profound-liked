import { getDb } from './server/db.ts';
import { targetEngines } from './drizzle/schema.ts';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

const engines = await db.select().from(targetEngines);

console.log('All Target Engines:');
console.log(JSON.stringify(engines, null, 2));

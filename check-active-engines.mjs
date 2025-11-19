import { getDb } from './server/db.ts';
import { targetEngines } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

const engines = await db.select().from(targetEngines)
  .where(eq(targetEngines.isActive, true));

console.log('Active Target Engines:');
console.log(JSON.stringify(engines, null, 2));

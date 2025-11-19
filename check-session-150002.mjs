import { getDb } from './server/db.ts';
import { analysisSessions } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

const sessions = await db.select().from(analysisSessions).where(eq(analysisSessions.id, 150002));
console.log('Session 150002:');
console.log(JSON.stringify(sessions, null, 2));

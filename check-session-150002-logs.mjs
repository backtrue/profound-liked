import { getDb } from './server/db.ts';
import { executionLogs } from './drizzle/schema.ts';
import { eq, desc } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

const logs = await db.select().from(executionLogs)
  .where(eq(executionLogs.sessionId, 150002))
  .orderBy(desc(executionLogs.createdAt))
  .limit(20);

console.log('Session 150002 Execution Logs (last 20):');
console.log(JSON.stringify(logs, null, 2));

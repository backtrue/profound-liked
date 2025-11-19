import { getDb } from './server/db.ts';
import { analysisSessions, executionLogs } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

const sessionId = 150002;

console.log(`Fixing session ${sessionId}...`);

// Update session status to failed
await db.update(analysisSessions)
  .set({
    status: 'failed',
    completedAt: new Date(),
    errorMessage: '沒有啟用的引擎可測試。系統已自動初始化預設引擎，請重新執行分析。',
  })
  .where(eq(analysisSessions.id, sessionId));

console.log(`✓ Updated session ${sessionId} status to 'failed'`);

// Add error log
await db.insert(executionLogs).values({
  sessionId,
  level: 'error',
  message: '分析失敗：沒有啟用的引擎',
  details: {
    reason: 'no_engines',
    fix: '系統已自動初始化預設引擎（ChatGPT、Perplexity、Gemini）',
  },
});

console.log(`✓ Added error log to session ${sessionId}`);

// Verify
const session = await db.select().from(analysisSessions).where(eq(analysisSessions.id, sessionId));
console.log('\nUpdated session:');
console.log(JSON.stringify(session, null, 2));

import { getDb } from './server/db.ts';
import { targetEngines } from './drizzle/schema.ts';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

// Define default engines
const defaultEngines = [
  {
    engineName: 'ChatGPT',
    modelVersion: 'gpt-4o',
    isActive: true,
  },
  {
    engineName: 'Perplexity',
    modelVersion: 'sonar',
    isActive: true,
  },
  {
    engineName: 'Gemini',
    modelVersion: 'gemini-2.0-flash-exp',
    isActive: true,
  },
];

console.log('Initializing default engines...');

for (const engine of defaultEngines) {
  try {
    await db.insert(targetEngines).values(engine);
    console.log(`✓ Created engine: ${engine.engineName} (${engine.modelVersion})`);
  } catch (error) {
    console.error(`✗ Failed to create engine ${engine.engineName}:`, error.message);
  }
}

// Verify
const allEngines = await db.select().from(targetEngines);
console.log('\nAll engines in database:');
console.log(JSON.stringify(allEngines, null, 2));

import { drizzle } from "drizzle-orm/mysql2";
import { sarcasmCorpus } from "../drizzle/schema.ts";
import { allSarcasmExamples } from "./sarcasmCorpusSeed.ts";

const db = drizzle(process.env.DATABASE_URL);

async function initSarcasmCorpus() {
  console.log("開始初始化反串語料庫...");
  
  // Check if corpus already exists
  const existing = await db.select().from(sarcasmCorpus).limit(1);
  if (existing.length > 0) {
    console.log("語料庫已存在，跳過初始化");
    return;
  }
  
  // Insert seed data
  const entries = allSarcasmExamples.map(example => ({
    ...example,
    createdBy: 1, // System user
  }));
  
  await db.insert(sarcasmCorpus).values(entries);
  
  console.log(`✓ 已成功新增 ${entries.length} 筆反串範例`);
  console.log(`  - 台灣：${entries.filter(e => e.market === "taiwan").length} 筆`);
  console.log(`  - 日本：${entries.filter(e => e.market === "japan").length} 筆`);
}

initSarcasmCorpus()
  .then(() => {
    console.log("反串語料庫初始化完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("初始化失敗：", error);
    process.exit(1);
  });
